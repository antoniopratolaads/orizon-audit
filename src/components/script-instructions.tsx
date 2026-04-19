"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Copy,
  Download,
  Check,
  Terminal,
  FileText,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const META_COLUMNS = [
  "Campaign name",
  "Ad set name",
  "Ad name",
  "Placement",
  "Delivery status",
  "Reach",
  "Impressions",
  "Frequency",
  "Results",
  "Amount spent (EUR)",
  "CTR (link click-through rate)",
  "Link clicks",
  "CPC (link)",
  "Content views",
  "Adds to cart",
  "Checkouts initiated",
  "Purchases",
  "Purchase ROAS (return on ad spend)",
  "Reporting starts",
  "Reporting ends",
];

const META_VIDEO_COLUMNS = [
  "Video plays at 3 seconds",
  "Video plays at 15 seconds",
  "ThruPlays",
  "Hook rate (opzionale, calcolata)",
  "Hold rate (opzionale, calcolata)",
];

export function ScriptInstructions({
  platform,
}: {
  platform: "google" | "meta";
}) {
  if (platform === "google") return <GoogleScriptPanel />;
  return <MetaInstructionsPanel />;
}

function GoogleScriptPanel() {
  const [code, setCode] = React.useState<string>("");
  const [loading, setLoading] = React.useState(true);
  const [expanded, setExpanded] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    fetch("/scripts/orizon-audit-google-ads.js")
      .then((r) => r.text())
      .then((t) => {
        setCode(t);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Script copiato");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossibile copiare. Scarica il file.");
    }
  }

  const lineCount = code.split("\n").length;
  const kb = (code.length / 1024).toFixed(0);

  return (
    <div className="mt-4 rounded-xl border border-border bg-card/60">
      <div className="flex items-start gap-3 border-b border-border p-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <Terminal className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-medium">
            Non hai ancora l&apos;XLSX? Usa questo script Google Ads
          </h4>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Copia/incolla in Google Ads per estrarre i dati dell&apos;account.
            Genera un Google Sheet con 23 tab che esporti come XLSX.
          </p>
        </div>
      </div>

      <ol className="grid gap-0 divide-y divide-border text-xs sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Step
          n={1}
          title="Apri Strumenti → Script"
          description="Google Ads → Strumenti e impostazioni → Bulk actions → Scripts. Clicca + per nuovo script."
        />
        <Step
          n={2}
          title="Incolla, preview, run"
          description="Incolla il codice, clicca Preview per autorizzare, poi Run. Attendi 2-5 min."
        />
        <Step
          n={3}
          title="Apri il Google Sheet e scarica XLSX"
          description="Nel log vedi l'URL del Sheet generato. File → Download → .xlsx."
        />
      </ol>

      <div className="border-t border-border p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <FileText className="size-3.5" />
            <span className="font-mono">
              orizon-audit-google-ads.js
            </span>
            {!loading && (
              <span className="text-muted-foreground/60">
                · {lineCount} righe · {kb} KB
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-[11px]"
              onClick={copy}
              disabled={loading || !code}
            >
              {copied ? (
                <Check className="size-3" />
              ) : (
                <Copy className="size-3" />
              )}
              {copied ? "Copiato" : "Copia"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-[11px]"
              asChild
            >
              <a
                href="/scripts/orizon-audit-google-ads.js"
                download="orizon-audit-google-ads.js"
              >
                <Download className="size-3" />
                Scarica
              </a>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 text-[11px]"
              onClick={() => setExpanded((v) => !v)}
              disabled={loading || !code}
            >
              {expanded ? (
                <ChevronUp className="size-3" />
              ) : (
                <ChevronDown className="size-3" />
              )}
              {expanded ? "Nascondi" : "Mostra"}
            </Button>
          </div>
        </div>

        {expanded && !loading && (
          <pre
            className={cn(
              "mt-2 max-h-80 overflow-auto rounded-md border border-border bg-muted/40 p-3",
              "font-mono text-[11px] leading-relaxed text-foreground/80"
            )}
          >
            <code>{code}</code>
          </pre>
        )}
        {!expanded && !loading && (
          <div className="mt-1 rounded-md border border-dashed border-border bg-muted/20 p-2 font-mono text-[10px] text-muted-foreground">
            {code.split("\n").slice(0, 4).join("\n")}
            <div className="mt-1 text-center text-muted-foreground/60">
              ···
            </div>
          </div>
        )}
        {loading && (
          <div className="mt-2 h-16 animate-pulse rounded-md bg-muted/40" />
        )}
      </div>
    </div>
  );
}

function MetaInstructionsPanel() {
  return (
    <div className="mt-4 rounded-xl border border-border bg-card/60">
      <div className="flex items-start gap-3 border-b border-border p-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <FileText className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-medium">
            Come esportare il CSV da Meta Ads Manager
          </h4>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Export manuale da Ads Manager, livello <strong>Ad</strong> con
            breakdown per <strong>Placement</strong>.
          </p>
        </div>
        <a
          href="https://adsmanager.facebook.com/adsmanager/reporting"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 text-[11px] text-primary hover:underline"
        >
          Apri Ads Manager
          <ExternalLink className="size-3" />
        </a>
      </div>

      <ol className="grid gap-0 divide-y divide-border text-xs sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        <Step
          n={1}
          title="Livello Ad + Placement"
          description="Reporting → Livello Ads. Breakdown → Delivery → Placement."
        />
        <Step
          n={2}
          title="Attribution window"
          description="Imposta 7-day click + 1-day view (default). Trovi il selettore sopra la tabella, vicino al periodo."
        />
        <Step
          n={3}
          title="Periodo"
          description="Ultimi 90 giorni o custom range. Deve coincidere con quello dell'audit."
        />
        <Step
          n={4}
          title="Export CSV"
          description="Export → Export table data → Comma-separated (.csv)."
        />
      </ol>

      <div className="border-t border-border p-4 space-y-3">
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <Info className="size-3.5" />
            Colonne base obbligatorie
          </div>
          <div className="flex flex-wrap gap-1.5">
            {META_COLUMNS.map((c) => (
              <span
                key={c}
                className="rounded-md border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px]"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <Info className="size-3.5" />
            Colonne video (per Hook rate / Hold rate)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {META_VIDEO_COLUMNS.map((c) => (
              <span
                key={c}
                className="rounded-md border border-border bg-[color:var(--status-warn-bg)] px-1.5 py-0.5 font-mono text-[10px] text-[color:var(--status-warn)]"
              >
                {c}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Senza queste colonne Hook rate e Hold rate verranno lasciate vuote
            nell&apos;audit. L&apos;app calcola Hook = <code>Video plays at
            3 seconds / Impressions</code> e Hold = <code>Video plays at 15
            seconds / Video plays at 3 seconds</code>. Se Meta ti offre le
            colonne <code>Hook rate</code> e <code>Hold rate</code> dirette,
            attivale pure — l&apos;app le rileva automaticamente.
          </p>
        </div>
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  description,
}: {
  n: number;
  title: string;
  description: string;
}) {
  return (
    <div className="p-4">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 font-mono text-[10px] font-semibold text-primary">
          {n}
        </span>
        <span className="text-xs font-medium">{title}</span>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
