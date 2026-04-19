import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArrowRight, type LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  href,
  trend,
  className,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  href?: string;
  trend?: "up" | "down" | "neutral";
  className?: string;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between">
        <div className="space-y-0.5">
          <div className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            {label}
          </div>
        </div>
        {Icon && (
          <div className="flex size-7 items-center justify-center rounded-md bg-muted/60 text-muted-foreground">
            <Icon className="size-3.5" />
          </div>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="font-display text-3xl leading-none tabular-nums">
          {value}
        </div>
        {sub && (
          <div
            className={cn(
              "text-xs",
              trend === "up"
                ? "text-[color:var(--status-ok)]"
                : trend === "down"
                ? "text-[color:var(--status-crit)]"
                : "text-muted-foreground"
            )}
          >
            {sub}
          </div>
        )}
      </div>
      {href && (
        <div className="mt-3 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          Vedi dettaglio <ArrowRight className="size-3" />
        </div>
      )}
    </>
  );

  const base =
    "card-interactive block rounded-xl border border-border bg-card p-4";

  if (href) {
    return (
      <Link
        href={href}
        className={cn(base, "hover:border-primary/40", className)}
      >
        {content}
      </Link>
    );
  }
  return <div className={cn(base, className)}>{content}</div>;
}
