import { getAnthropicClient, DEFAULT_MODEL } from "@/lib/anthropic";
import { prisma } from "@/lib/db";
import {
  extractTemplateSchema,
  pickTemplate,
  type TemplateSchema,
} from "@/lib/templates";
import { DEFAULT_PROMPTS } from "@/lib/constants";
import type { ParsedData } from "@/lib/parsers/types";
import type { AuditData } from "@/lib/parsers/types";

async function getSystemPrompt(
  platform: "google" | "meta",
  businessType: "ecom" | "leadgen"
) {
  const s = await prisma.settings.findUnique({ where: { id: 1 } });
  if (platform === "meta") return s?.promptMeta ?? DEFAULT_PROMPTS.meta;
  if (businessType === "leadgen")
    return s?.promptGoogleLeadgen ?? DEFAULT_PROMPTS.googleLeadgen;
  return s?.promptGoogleEcom ?? DEFAULT_PROMPTS.googleEcom;
}

/**
 * Pre-aggregate parsed data before sending to Claude to keep the prompt short.
 * Heavy tabs (Search Terms, Prodotti, PMax Asset, GMC Diagnostica, Per Giorno-Ora)
 * get summarized with top-N rows and aggregate stats instead of dumping the raw rows.
 */
function condensePayload(parsed: ParsedData): ParsedData {
  if (parsed.platform !== "google") return parsed;
  const s = parsed.sections as Record<string, unknown>;

  const condensed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(s)) {
    if (Array.isArray(value)) {
      // Heavy tabs: keep top 30 rows by cost/impressions + count summary
      const HEAVY = [
        "Search Terms",
        "Prodotti",
        "PMax Asset",
        "GMC Diagnostica",
        "Per Giorno-Ora",
        "Keyword + QS",
      ];
      if (HEAVY.includes(key) && value.length > 30) {
        condensed[key] = {
          totalRows: value.length,
          topRows: value.slice(0, 30),
          note: `truncated — showing top 30 of ${value.length}`,
        };
      } else {
        condensed[key] = value;
      }
    } else {
      condensed[key] = value;
    }
  }
  return { ...parsed, sections: condensed };
}

function buildUserPrompt(
  clientName: string,
  parsed: ParsedData,
  schema: TemplateSchema
) {
  const condensed = condensePayload(parsed);
  const dataJson = JSON.stringify(condensed, null, 2);
  const CAP = 120_000;
  const cappedData =
    dataJson.length > CAP ? dataJson.slice(0, CAP) + "\n... [TRONCATO]" : dataJson;

  return `Cliente: ${clientName}
Piattaforma: ${parsed.platform} (${parsed.businessType})
Periodo: ${parsed.period?.start ?? "n/d"} — ${parsed.period?.end ?? "n/d"}

== STRUTTURA TEMPLATE DA COMPILARE ==

CHECKLIST (${schema.checklist.reduce(
    (acc, s) => acc + s.items.length,
    0
  )} checkpoint totali):
${schema.checklist
  .map(
    (s) =>
      `[${s.section}]\n${s.items
        .map((i) => `  - (${i.type}) ${i.checkpoint}`)
        .join("\n")}`
  )
  .join("\n\n")}

KPI METRICHE:
${schema.kpi.map((k) => `  - ${k.metric}${k.note ? ` (${k.note})` : ""}`).join("\n")}

DATI PRESENTAZIONE (slide PPTX):
${schema.presentation
  .map((p) => `  [${p.slide}] (${p.kind}) ${p.field}`)
  .join("\n")}

== DATI GREZZI ESTRATTI ==

${cappedData}

== COMPITO ==

Restituisci SOLO un oggetto JSON valido con questa shape esatta (rispetta le chiavi, non aggiungerne altre, non tradurle):

{
  "executiveSummary": "3-5 frasi, numeri chiave, criticità principali. Italiano tecnico diretto.",
  "kpi": [
    { "metric": "<nome metrica esatto dal template>", "value": "<valore formattato>", "note": "<nota breve opzionale>" }
  ],
  "checklist": [
    {
      "section": "<sezione del template>",
      "checkpoint": "<testo esatto del checkpoint>",
      "type": "AUTO" | "MANUAL",
      "status": "OK" | "Warning" | "Critico" | "N/A" | "",
      "note": "<1-3 frasi con i numeri osservati, vuoto se MANUAL senza dati>",
      "action": "<azione concreta, 1 frase, vuoto se non applicabile>"
    }
  ],
  ${schema.hasConversioni ? `"conversioni": [{ "name":"", "category":"", "type":"", "primary":"", "counting":"", "attribution":"", "note":"" }],` : ""}
  ${schema.hasGMC ? `"gmc": {
    "summary": [{ "metric":"Totale prodotti nel feed", "value":"", "percent":"", "note":"" }],
    "problems": [{ "problem":"", "count":"", "percent":"", "priority":"" }],
    "performance": [{ "metric":"Prodotti con spesa", "value":"", "percent":"", "note":"" }]
  },` : ""}
  "actions": [
    { "n": 1, "area": "", "action": "", "priority": "Alta" | "Media" | "Bassa", "type": "AUTO" | "MANUAL" }
  ],
  "presentation": [
    { "section": "<nome slide>", "field": "<nome esatto campo>", "kind": "AUTO" | "MANUAL", "value": "<testo>", "source": "<opz.>" }
  ]
}

Regole:
- Per "checklist" includi TUTTI i checkpoint della struttura template sopra, nell'ordine dato. Per i MANUAL lascia status/note/action vuoti a meno che i dati estratti non diano indicazioni dirette.
- Per "kpi" compila TUTTE le metriche elencate nel template. Se un valore non è calcolabile usa "—".
- Per "presentation" rispetta TUTTI i campi del template. Se MANUAL lascia "value" vuoto.
- Per "actions" suggerisci massimo 15 azioni, ordinate per priorità (Alta prima).
- Tono: diretto, italiano, numeri sempre presenti, zero fluff.
- Output: SOLO il JSON, niente markdown fences, niente commenti.`;
}

export async function generateAuditData(input: {
  clientName: string;
  parsed: ParsedData;
  onProgress?: (stage: string) => void;
  onToken?: (chunk: string) => void;
}): Promise<AuditData> {
  const { clientName, parsed, onProgress, onToken } = input;
  onProgress?.("Carico template e genero schema...");
  const templateKind = pickTemplate(parsed.platform, parsed.businessType);
  const schema = await extractTemplateSchema(templateKind);

  onProgress?.("Invio a Claude (streaming attivo)...");
  const client = await getAnthropicClient();
  const systemPrompt = await getSystemPrompt(parsed.platform, parsed.businessType);
  const userPrompt = buildUserPrompt(clientName, parsed, schema);

  // Streaming: forward each delta to the client so the UI feels alive
  let fullText = "";
  let lastReport = Date.now();
  const stream = client.messages.stream({
    model: DEFAULT_MODEL,
    max_tokens: 32000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  stream.on("text", (textDelta) => {
    fullText += textDelta;
    if (onToken) onToken(textDelta);
    // Report progress stages by rough chunks of tokens
    const now = Date.now();
    if (now - lastReport > 4000) {
      onProgress?.(`Claude sta generando... (${fullText.length} caratteri)`);
      lastReport = now;
    }
  });

  const final = await stream.finalMessage();

  onProgress?.("Parso risposta...");
  const textBlock = final.content.find((c) => c.type === "text");
  const raw = (
    (textBlock && textBlock.type === "text" ? textBlock.text : "") || fullText
  ).trim();

  console.log("[ai-pipeline] Claude raw response length:", raw.length);
  console.log("[ai-pipeline] Claude stop_reason:", final.stop_reason);
  console.log("[ai-pipeline] Claude usage:", JSON.stringify(final.usage));

  if (!raw) {
    throw new Error(
      "Claude non ha prodotto nessun testo (risposta vuota). Controlla API key e limiti."
    );
  }
  const cleaned = stripCodeFences(raw);
  let json: unknown;
  let parseError: Error | null = null;
  let recovered = false;
  try {
    json = JSON.parse(cleaned);
  } catch (e1) {
    parseError = e1 as Error;
    // Try 1: extract the first {...} block
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        json = JSON.parse(m[0]);
        parseError = null;
      } catch {
        // Try 2: recover from truncation by auto-closing braces/brackets
        try {
          const repaired = repairTruncatedJson(m[0]);
          json = JSON.parse(repaired);
          parseError = null;
          recovered = true;
          console.warn("[ai-pipeline] JSON was truncated — recovered via auto-close");
        } catch (e3) {
          parseError = e3 as Error;
        }
      }
    }
  }

  if (parseError || !json) {
    console.error("[ai-pipeline] JSON parse failed:", parseError?.message);
    console.error("[ai-pipeline] First 500 chars:", cleaned.slice(0, 500));
    console.error("[ai-pipeline] Last 500 chars:", cleaned.slice(-500));
    // Return a partial AuditData so the raw response is preserved and
    // the user can see what Claude produced and recover from the editor.
    return {
      header: {
        cliente: clientName,
        accountId: parsed.accountId,
        periodo: parsed.period
          ? `${parsed.period.start ?? "?"} → ${parsed.period.end ?? "?"}`
          : undefined,
        dataAudit: new Date().toLocaleDateString("it-IT"),
      },
      executiveSummary:
        `[JSON Claude non parsabile — ${parseError?.message ?? "unknown"}]\n\nRisposta raw:\n${cleaned.slice(0, 4000)}`,
      kpi: [],
      checklist: [],
      actions: [],
      presentation: [],
    };
  }

  // Deterministic KPI + GMC summary computed server-side from parsed data.
  // Claude's output is merged on top (notes it may add), but the base values
  // always come from the raw XLSX so the KPI sheet is never empty.
  const computedKpi = computeKpi(parsed);
  const computedGmc = computeGmcSummary(parsed);

  const claudeKpi = ((json as { kpi?: AuditData["kpi"] }).kpi ??
    []) as AuditData["kpi"];
  const mergedKpi = mergeKpi(computedKpi, claudeKpi);

  const claudeGmc = (json as { gmc?: AuditData["gmc"] }).gmc;
  const mergedGmc = mergeGmc(computedGmc, claudeGmc);

  const auditData: AuditData = {
    header: {
      cliente: clientName,
      accountId: parsed.accountId,
      periodo: parsed.period
        ? `${parsed.period.start ?? "?"} → ${parsed.period.end ?? "?"}`
        : undefined,
      dataAudit: new Date().toLocaleDateString("it-IT"),
    },
    executiveSummary: (json as { executiveSummary?: string }).executiveSummary,
    kpi: mergedKpi,
    checklist: (json as { checklist: unknown[] }).checklist as AuditData["checklist"],
    conversioni: (json as { conversioni?: unknown[] }).conversioni as AuditData["conversioni"],
    gmc: mergedGmc,
    actions: (json as { actions: unknown[] }).actions as AuditData["actions"],
    presentation: (json as { presentation: unknown[] }).presentation as AuditData["presentation"],
  };

  if (recovered) {
    auditData.executiveSummary =
      "[NOTA: risposta Claude troncata — recuperati automaticamente i dati parziali. Alcune sezioni potrebbero essere incomplete.]\n\n" +
      (auditData.executiveSummary ?? "");
  }

  onProgress?.("Completato.");
  return auditData;
}

/** Compute base KPI values directly from parsed data — never empty. */
function computeKpi(parsed: ParsedData): AuditData["kpi"] {
  if (parsed.platform === "google") {
    const s = (parsed.summary ?? {}) as Record<string, unknown>;
    const v = (k: string) => s[k] ?? "";
    return [
      { metric: "Budget spent", value: String(v("Costo")), note: "Tab Riepilogo" },
      { metric: "Impressioni", value: String(v("Impressioni")), note: "Tab Riepilogo" },
      { metric: "Clic", value: String(v("Clic")), note: "Tab Riepilogo" },
      { metric: "CTR", value: String(v("CTR")), note: "Tab Riepilogo" },
      { metric: "CPC medio", value: String(v("CPC Medio")), note: "Tab Riepilogo" },
      { metric: "Conversioni", value: String(v("Conversioni")), note: "Tab Riepilogo" },
      { metric: "Valore conversioni", value: String(v("Valore Conv.")), note: "Tab Riepilogo" },
      { metric: "ROAS", value: String(v("ROAS")), note: "Valore / Costo" },
      { metric: "Conv. Rate", value: String(v("Conv. Rate")), note: "Conversioni / Clic" },
      { metric: "Auto-tagging", value: String(v("Auto-tagging")), note: "Tab Riepilogo" },
      {
        metric: "Campagne attive",
        value: String(
          Array.isArray((parsed.sections as Record<string, unknown>)["Campagne Attive"])
            ? ((parsed.sections as Record<string, unknown>)["Campagne Attive"] as unknown[]).length
            : ""
        ),
        note: "Tab Campagne Attive",
      },
      {
        metric: "Campagne in pausa",
        value: String(
          Array.isArray((parsed.sections as Record<string, unknown>)["Campagne in Pausa"])
            ? ((parsed.sections as Record<string, unknown>)["Campagne in Pausa"] as unknown[]).length
            : ""
        ),
        note: "Tab Campagne in Pausa",
      },
    ];
  }

  // Meta
  const s = (parsed.summary ?? {}) as Record<string, unknown>;
  const eur = (n: unknown) =>
    typeof n === "number" && n > 0 ? `€${n.toFixed(2)}` : "";
  const n = (v: unknown) =>
    typeof v === "number" ? v.toLocaleString("it-IT") : String(v ?? "");
  const pct = (v: unknown) =>
    typeof v === "number" ? `${v.toFixed(2)}%` : String(v ?? "");
  return [
    { metric: "Budget spent", value: eur(s.spent) },
    { metric: "Reach", value: n(s.reach) },
    { metric: "Impressions", value: n(s.impressions) },
    {
      metric: "Frequenza",
      value: typeof s.frequency === "number" ? s.frequency.toFixed(2) : "",
    },
    { metric: "Link clicks", value: n(s.clicks) },
    { metric: "CTR (link)", value: pct(s.ctrLink) },
    { metric: "CPC (link)", value: eur(s.cpcLink) },
    { metric: "Purchases", value: n(s.purchases) },
    { metric: "Lead", value: n(s.leads) },
    { metric: "CPL", value: eur(s.cpl) },
    { metric: "CPA Purchase", value: eur(s.cpa) },
    {
      metric: "ROAS",
      value: typeof s.roas === "number" && s.roas > 0 ? `${s.roas.toFixed(2)}x` : "",
    },
    { metric: "Content Views", value: n(s.contentViews) },
    { metric: "Add to Cart", value: n(s.atc) },
    { metric: "Checkouts initiated", value: n(s.checkouts) },
    { metric: "Landing Page Views", value: n(s.landingViews) },
  ];
}

function mergeKpi(
  base: AuditData["kpi"],
  claude: AuditData["kpi"]
): AuditData["kpi"] {
  const norm = (s: string) => s.trim().toLowerCase();
  const claudeMap = new Map(claude.map((k) => [norm(k.metric), k]));
  return base.map((b) => {
    const c = claudeMap.get(norm(b.metric));
    if (!c) return b;
    return {
      metric: b.metric,
      value: b.value && String(b.value).trim() && String(b.value) !== "—"
        ? b.value
        : c.value,
      note: c.note || b.note,
    };
  });
}

function computeGmcSummary(parsed: ParsedData): AuditData["gmc"] | undefined {
  if (parsed.platform !== "google") return undefined;
  const sections = parsed.sections as Record<string, unknown>;
  const gmcRiepilogo = sections["GMC Riepilogo"];
  if (!gmcRiepilogo || typeof gmcRiepilogo !== "object") return undefined;
  const r = gmcRiepilogo as Record<string, unknown>;

  const summary: { metric: string; value: string | number; percent?: string; note?: string }[] = [];
  const total = asNumber(r["Totale prodotti"] ?? r["Totale"] ?? r["Prodotti totali"]);

  const addRow = (metric: string, rawKeys: string[], note?: string) => {
    for (const k of rawKeys) {
      if (r[k] != null && r[k] !== "") {
        const v = r[k];
        const num = asNumber(v);
        summary.push({
          metric,
          value: String(v),
          percent:
            total && num != null ? `${((num / total) * 100).toFixed(1)}%` : undefined,
          note,
        });
        return;
      }
    }
  };

  addRow("Totale prodotti nel feed", ["Totale prodotti", "Totale", "Prodotti totali"], "Base 100%");
  addRow("Prodotti approvati", ["Approvati", "Approved"], "Mostrati ai clienti");
  addRow("Prodotti non idonei", ["Non idonei", "Disapproved", "Disapprovati"], "Non mostrati");
  addRow("Eligible limited", ["Eligible Limited", "EligibleLimited", "Approvati con limitazioni"]);

  return {
    summary,
    problems: [],
    performance: [],
  };
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[.,\s]/g, (m) => (m === "," ? "." : "")));
    return isNaN(n) ? null : n;
  }
  return null;
}

function mergeGmc(
  base: AuditData["gmc"] | undefined,
  claude: AuditData["gmc"] | undefined
): AuditData["gmc"] | undefined {
  if (!base && !claude) return undefined;
  if (!base) return claude;
  if (!claude) return base;
  // Use computed numbers, Claude's problems + performance analysis
  return {
    summary: base.summary.length ? base.summary : claude.summary,
    problems: claude.problems?.length ? claude.problems : base.problems,
    performance: claude.performance?.length ? claude.performance : base.performance,
  };
}

function stripCodeFences(s: string): string {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  return s;
}

/**
 * Repair a truncated JSON string by closing unclosed braces, brackets and
 * strings. Also drops any trailing partial token (like a half-written key).
 * Good enough to salvage Claude responses that hit max_tokens mid-array.
 */
function repairTruncatedJson(src: string): string {
  let s = src.trim();

  // If cut off in the middle of a string, close it
  const stack: string[] = [];
  let inString = false;
  let escape = false;
  let lastGoodIndex = -1;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      if (!inString) lastGoodIndex = i;
      continue;
    }
    if (inString) continue;
    if (ch === "{" || ch === "[") {
      stack.push(ch === "{" ? "}" : "]");
    } else if (ch === "}" || ch === "]") {
      stack.pop();
      lastGoodIndex = i;
    } else if (ch === "," || ch === ":") {
      lastGoodIndex = i;
    } else if (!/\s/.test(ch)) {
      lastGoodIndex = i;
    }
  }

  // If we ended inside a string, truncate to before it and close the string
  if (inString) {
    const lastQuote = s.lastIndexOf('"');
    // Keep the string but close it cleanly
    s = s.slice(0, lastQuote + 1) + '"';
    inString = false;
  }

  // Drop trailing partial tokens after last structural character
  // (e.g. a half-written key: "actio  -> drop)
  if (lastGoodIndex >= 0 && lastGoodIndex < s.length - 1) {
    s = s.slice(0, lastGoodIndex + 1);
  }

  // Remove trailing commas like ",\n" before appending closers
  s = s.replace(/[,\s]+$/, "");

  // Close remaining open brackets/braces
  while (stack.length > 0) {
    s += stack.pop();
  }

  return s;
}
