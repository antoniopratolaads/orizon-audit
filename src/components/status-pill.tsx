import { cn } from "@/lib/utils";
import type { AuditStatus } from "@/lib/constants";

const styles: Record<string, string> = {
  OK: "bg-[color:var(--status-ok-bg)] text-[color:var(--status-ok)] ring-[color:var(--status-ok)]/30",
  Warning:
    "bg-[color:var(--status-warn-bg)] text-[color:var(--status-warn)] ring-[color:var(--status-warn)]/30",
  Critico:
    "bg-[color:var(--status-crit-bg)] text-[color:var(--status-crit)] ring-[color:var(--status-crit)]/30",
  "N/A": "bg-[color:var(--status-na-bg)] text-[color:var(--status-na)] ring-[color:var(--status-na)]/30",
};

export function StatusPill({
  status,
  className,
}: {
  status?: AuditStatus | string | null;
  className?: string;
}) {
  const s = status ?? "N/A";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        styles[s] ?? styles["N/A"],
        className
      )}
    >
      <span
        className="size-1.5 rounded-full"
        style={{
          backgroundColor:
            s === "OK"
              ? "var(--status-ok)"
              : s === "Warning"
              ? "var(--status-warn)"
              : s === "Critico"
              ? "var(--status-crit)"
              : "var(--status-na)",
        }}
      />
      {s}
    </span>
  );
}

export function HealthBar({
  ok,
  warn,
  crit,
  na = 0,
  className,
}: {
  ok: number;
  warn: number;
  crit: number;
  na?: number;
  className?: string;
}) {
  const total = ok + warn + crit + na;
  if (total === 0)
    return (
      <div className={cn("text-xs text-muted-foreground", className)}>
        Nessun checkpoint
      </div>
    );
  const pct = (n: number) => (n / total) * 100;
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        {ok > 0 && (
          <div
            style={{ width: `${pct(ok)}%`, backgroundColor: "var(--status-ok)" }}
          />
        )}
        {warn > 0 && (
          <div
            style={{
              width: `${pct(warn)}%`,
              backgroundColor: "var(--status-warn)",
            }}
          />
        )}
        {crit > 0 && (
          <div
            style={{
              width: `${pct(crit)}%`,
              backgroundColor: "var(--status-crit)",
            }}
          />
        )}
        {na > 0 && (
          <div
            style={{
              width: `${pct(na)}%`,
              backgroundColor: "var(--status-na)",
            }}
          />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-[11px]">
        <Dot color="var(--status-ok)" label={`OK ${ok}`} />
        <Dot color="var(--status-warn)" label={`Warning ${warn}`} />
        <Dot color="var(--status-crit)" label={`Critico ${crit}`} />
        {na > 0 && <Dot color="var(--status-na)" label={`N/A ${na}`} />}
      </div>
    </div>
  );
}

function Dot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="tabular-nums">{label}</span>
    </span>
  );
}
