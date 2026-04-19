import { prisma } from "@/lib/db";
import { getAnthropicClient, DEFAULT_MODEL } from "@/lib/anthropic";
import { NextResponse } from "next/server";
import type { AuditData, ParsedData } from "@/lib/parsers/types";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const audit = await prisma.audit.findUnique({ where: { id } });
  if (!audit) return new NextResponse("Not found", { status: 404 });

  const parsed: ParsedData = JSON.parse(audit.rawData || "{}");
  const current: AuditData = JSON.parse(audit.auditData || "{}");
  const existing = (current.actions ?? [])
    .map((a) => `- [${a.priority}] ${a.area}: ${a.action}`)
    .join("\n");

  const client = await getAnthropicClient();
  const res = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 2000,
    system:
      "Sei un esperto di performance marketing. Analizzi un audit già fatto e suggerisci 3-5 azioni aggiuntive che non sono state ancora coperte, basate sui dati disponibili. Italiano tecnico diretto, numeri sempre.",
    messages: [
      {
        role: "user",
        content: `Piattaforma: ${parsed.platform} (${parsed.businessType})

Azioni già presenti nell'audit:
${existing || "(nessuna)"}

Dati disponibili (estratto):
${JSON.stringify(parsed.summary ?? {}, null, 2).slice(0, 4000)}

Suggerisci 3-5 azioni AGGIUNTIVE (non duplicati). Restituisci SOLO JSON con shape:
{ "actions": [ { "area": "...", "action": "...", "priority": "Alta"|"Media"|"Bassa", "type": "AUTO" } ] }`,
      },
    ],
  });
  const text = res.content.find((c) => c.type === "text");
  if (!text || text.type !== "text")
    return NextResponse.json({ actions: [] });
  const cleaned = text.text.replace(/```(?:json)?/g, "").trim();
  try {
    const m = cleaned.match(/\{[\s\S]*\}/);
    const json = JSON.parse(m ? m[0] : cleaned);
    return NextResponse.json({ actions: json.actions ?? [] });
  } catch {
    return NextResponse.json({ actions: [] });
  }
}
