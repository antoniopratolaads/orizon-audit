import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Plus, FileSpreadsheet } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import {
  formatDateTime,
  businessLabel,
} from "@/lib/format";
import { AvatarInitials } from "@/components/avatar-initials";
import { AuditRowActions } from "./audit-row-actions";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type RowMetrics = {
  budget?: string;
  primaryLabel: string;
  primaryValue?: string;
  secondaryLabel: string;
  secondaryValue?: string;
  counts: { ok: number; warn: number; crit: number; na: number };
  total: number;
};

function extractMetrics(
  platform: string,
  rawData: string,
  auditData: string
): RowMetrics {
  let summary: Record<string, unknown> = {};
  let checklist: { status?: string; type?: string }[] = [];

  try {
    const raw = JSON.parse(rawData || "{}");
    summary = raw?.summary ?? {};
  } catch {}
  try {
    const audit = JSON.parse(auditData || "{}");
    checklist = audit?.checklist ?? [];
  } catch {}

  const counts = { ok: 0, warn: 0, crit: 0, na: 0 };
  for (const c of checklist) {
    if (c.status === "OK") counts.ok++;
    else if (c.status === "Warning") counts.warn++;
    else if (c.status === "Critico") counts.crit++;
    else if (c.status === "N/A" || (!c.status && c.type === "MANUAL")) counts.na++;
  }
  const total = counts.ok + counts.warn + counts.crit + counts.na;

  if (platform === "google") {
    const costo = num(summary["Costo"]);
    const conv = num(summary["Conversioni"]);
    return {
      budget: costo != null ? formatEur(costo) : undefined,
      primaryLabel: "ROAS",
      primaryValue: str(summary["ROAS"]), // already formatted "0.76x"
      secondaryLabel: "Conv.",
      secondaryValue: conv != null ? formatInt(conv) : undefined,
      counts,
      total,
    };
  }
  // meta
  const spent = num(summary.spent);
  const roas = num(summary.roas);
  const purchases = num(summary.purchases);
  return {
    budget: spent != null ? formatEur(spent) : undefined,
    primaryLabel: "ROAS",
    primaryValue: roas ? `${roas.toFixed(2)}x` : undefined,
    secondaryLabel: "Purchases",
    secondaryValue: purchases ? formatInt(purchases) : undefined,
    counts,
    total,
  };
}

function formatEur(n: number): string {
  return n.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}
function formatInt(n: number): string {
  return Math.round(n).toLocaleString("it-IT");
}

function str(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  return String(v);
}
function num(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(",", "."));
    return isNaN(n) ? undefined : n;
  }
  return undefined;
}

function PlatformBadge({ platform }: { platform: string }) {
  if (platform === "google") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
        <span className="size-1.5 rounded-full bg-primary" />
        Google Ads
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-500">
      <span className="size-1.5 rounded-full bg-blue-500" />
      Meta Ads
    </span>
  );
}

function HealthMini({ counts, total }: { counts: RowMetrics["counts"]; total: number }) {
  if (total === 0) {
    return (
      <span className="text-[11px] text-muted-foreground">—</span>
    );
  }
  const pct = (n: number) => (n / total) * 100;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-1.5 w-28 overflow-hidden rounded-full bg-muted">
        {counts.ok > 0 && (
          <div style={{ width: `${pct(counts.ok)}%`, backgroundColor: "var(--status-ok)" }} />
        )}
        {counts.warn > 0 && (
          <div style={{ width: `${pct(counts.warn)}%`, backgroundColor: "var(--status-warn)" }} />
        )}
        {counts.crit > 0 && (
          <div style={{ width: `${pct(counts.crit)}%`, backgroundColor: "var(--status-crit)" }} />
        )}
        {counts.na > 0 && (
          <div style={{ width: `${pct(counts.na)}%`, backgroundColor: "var(--status-na)" }} />
        )}
      </div>
      <div className="flex items-center gap-1.5 text-[10px] font-mono tabular-nums text-muted-foreground">
        <span style={{ color: "var(--status-ok)" }}>{counts.ok}</span>
        <span>·</span>
        <span style={{ color: "var(--status-warn)" }}>{counts.warn}</span>
        <span>·</span>
        <span style={{ color: "var(--status-crit)" }}>{counts.crit}</span>
      </div>
    </div>
  );
}

export default async function AuditsPage() {
  const audits = await prisma.audit.findMany({
    include: { client: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader
        title="Audit"
        description="Tutti gli audit creati dall'agenzia."
        actions={
          <Button asChild size="sm">
            <Link href="/audits/new">
              <Plus className="size-4" /> Nuovo audit
            </Link>
          </Button>
        }
      />

      {audits.length === 0 ? (
        <EmptyState
          icon={FileSpreadsheet}
          title="Nessun audit"
          description="Crea il primo audit per vederlo qui."
          action={
            <Button asChild size="sm">
              <Link href="/audits/new">
                <Plus className="size-4" /> Nuovo audit
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="card-soft overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Cliente</th>
                <th className="px-3 py-2.5 text-left font-medium">Piattaforma</th>
                <th className="px-3 py-2.5 text-right font-medium">Budget</th>
                <th className="px-3 py-2.5 text-right font-medium">ROAS</th>
                <th className="px-3 py-2.5 text-right font-medium">Conv.</th>
                <th className="px-3 py-2.5 text-left font-medium">Health</th>
                <th className="px-3 py-2.5 text-left font-medium">Stato</th>
                <th className="px-3 py-2.5 text-left font-medium">Creato</th>
                <th className="w-10 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {audits.map((a) => {
                const hasData =
                  a.auditData && a.auditData !== "{}" && a.auditData.length > 2;
                const m = extractMetrics(a.platform, a.rawData, a.auditData);
                return (
                  <tr
                    key={a.id}
                    className="group border-b border-border transition-colors last:border-0 hover:bg-accent/40"
                  >
                    <td className="p-0">
                      <Link
                        href={`/audits/${a.id}`}
                        className="flex items-center gap-2.5 px-4 py-3"
                      >
                        <AvatarInitials name={a.client.name} size={34} />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium leading-tight">
                            {a.client.name}
                          </div>
                          <div className="truncate text-[11px] text-muted-foreground leading-tight">
                            {businessLabel(a.businessType)}
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <PlatformBadge platform={a.platform} />
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-[13px] tabular-nums">
                      {m.budget ?? <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-[13px] tabular-nums">
                      {m.primaryValue ?? <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-[13px] tabular-nums">
                      {m.secondaryValue ?? <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-3 py-3">
                      <HealthMini counts={m.counts} total={m.total} />
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          hasData
                            ? "border-[color:var(--status-ok)]/40 bg-[color:var(--status-ok-bg)] text-[color:var(--status-ok)]"
                            : "border-border bg-muted text-muted-foreground"
                        )}
                      >
                        {a.status === "completed"
                          ? "Completato"
                          : hasData
                          ? "Pronto"
                          : "Vuoto"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[12px] text-muted-foreground">
                      {formatDateTime(a.createdAt)}
                    </td>
                    <td className="py-3 pr-3 text-right">
                      <AuditRowActions
                        id={a.id}
                        clientName={a.client.name}
                        hasData={Boolean(hasData)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
