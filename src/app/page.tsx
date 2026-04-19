import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Plus,
  FileSpreadsheet,
  Users,
  Sparkles,
  CalendarDays,
  ArrowRight,
} from "lucide-react";
import { AvatarInitials } from "@/components/avatar-initials";
import { EmptyState } from "@/components/empty-state";
import { formatDate, platformLabel } from "@/lib/format";
import { StatCard } from "@/components/stat-card";
import { Sparkline } from "@/components/charts/sparkline";
import { DonutMini } from "@/components/charts/donut-mini";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalAudits, monthAudits, googleCount, metaCount, activeClients, clients, recent] =
    await Promise.all([
      prisma.audit.count(),
      prisma.audit.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.audit.count({ where: { platform: "google" } }),
      prisma.audit.count({ where: { platform: "meta" } }),
      prisma.client.count({
        where: {
          audits: {
            some: {
              createdAt: {
                gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
              },
            },
          },
        },
      }),
      prisma.client.findMany({
        include: {
          audits: {
            select: {
              id: true,
              platform: true,
              createdAt: true,
              status: true,
              auditData: true,
            },
            orderBy: { createdAt: "desc" },
          },
          _count: { select: { audits: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 12,
      }),
      prisma.audit.findMany({
        include: { client: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

  const hasClients = clients.length > 0;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="bg-mesh -mx-4 -mt-5 px-4 pb-1 pt-5 md:-mx-6 md:-mt-6 md:px-6 md:pb-1 md:pt-6">
        <PageHeader
          title="Overview"
          description={`Panoramica dell'agenzia · ${now.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}`}
          actions={
            <Button asChild size="sm">
              <Link href="/audits/new">
                <Plus className="size-4" /> Nuovo audit
              </Link>
            </Button>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Audit totali"
            value={totalAudits}
            icon={FileSpreadsheet}
            href="/audits"
          />
          <StatCard
            label="Ultimo mese"
            value={monthAudits}
            sub={monthAudits > 0 ? "in corso" : "nessuno"}
            trend={monthAudits > 0 ? "up" : "neutral"}
            icon={CalendarDays}
          />
          <StatCard
            label="Clienti attivi"
            value={activeClients}
            sub="ultimi 90 gg"
            icon={Users}
            href="/clients"
          />
          <PlatformSplitCard google={googleCount} meta={metaCount} />
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Clienti</h2>
            <Link
              href="/clients"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Vedi tutti
            </Link>
          </div>

          {!hasClients ? (
            <EmptyState
              icon={Users}
              title="Nessun cliente ancora"
              description="Crea il primo cliente per iniziare a generare audit."
              action={
                <Button asChild size="sm" variant="outline">
                  <Link href="/clients/new">
                    <Plus className="size-4" /> Nuovo cliente
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {clients.map((c) => {
                const last = c.audits[0];
                const trend = c.audits
                  .slice(0, 6)
                  .reverse()
                  .map((a) => {
                    try {
                      const d = JSON.parse(a.auditData || "{}");
                      const items = (d.checklist ?? []) as {
                        status?: string;
                      }[];
                      if (!items.length) return 0;
                      const ok = items.filter((i) => i.status === "OK").length;
                      const warn = items.filter((i) => i.status === "Warning").length;
                      const crit = items.filter((i) => i.status === "Critico").length;
                      const total = ok + warn + crit || 1;
                      return Math.round(
                        ((ok * 100 + warn * 50) / (total * 100)) * 100
                      );
                    } catch {
                      return 0;
                    }
                  });

                return (
                  <Link
                    key={c.id}
                    href={`/clients/${c.id}`}
                    className="card-interactive group rounded-xl border border-border bg-card p-3 hover:border-primary/40"
                  >
                    <div className="flex items-start gap-3">
                      <AvatarInitials name={c.name} size={38} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {c.name}
                        </div>
                        {c.description && (
                          <div className="truncate text-xs text-muted-foreground">
                            {c.description}
                          </div>
                        )}
                      </div>
                      {trend.length > 1 && (
                        <Sparkline values={trend} width={56} height={20} />
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5 text-[11px] text-muted-foreground">
                      <span>{c._count.audits} audit</span>
                      {last ? (
                        <span className="flex items-center gap-1">
                          <span className="size-1.5 rounded-full bg-primary/60" />
                          {platformLabel(last.platform)} · {formatDate(last.createdAt)}
                        </span>
                      ) : (
                        <span>Nessun audit</span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="card-soft rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Attività recente</h3>
              {recent.length > 0 && (
                <Link
                  href="/audits"
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                >
                  tutte
                </Link>
              )}
            </div>
            {recent.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Nessun audit ancora.
              </div>
            ) : (
              <ol className="relative space-y-3 border-l border-border/80 pl-4">
                {recent.map((a) => (
                  <li key={a.id} className="relative">
                    <span className="absolute -left-[21px] top-1 flex size-3 items-center justify-center">
                      <span className="absolute size-3 rounded-full bg-primary/20" />
                      <span className="size-1.5 rounded-full bg-primary" />
                    </span>
                    <Link
                      href={`/audits/${a.id}`}
                      className="block text-sm hover:text-primary"
                    >
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">
                          {a.client.name}
                        </span>
                        <Badge
                          variant="outline"
                          className="h-4 shrink-0 px-1 text-[9px]"
                        >
                          {platformLabel(a.platform)}
                        </Badge>
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {formatDate(a.createdAt)}
                      </div>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {!hasClients && (
            <div className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
              <Sparkles className="mb-2 size-4 text-primary" />
              <p className="mb-2">
                Appena aggiungi un cliente e generi il primo audit, qui vedrai il
                feed di attività recenti.
              </p>
              <Link
                href="/clients/new"
                className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary"
              >
                Inizia <ArrowRight className="size-3" />
              </Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function PlatformSplitCard({ google, meta }: { google: number; meta: number }) {
  const total = google + meta;
  return (
    <div
      className={cn(
        "card-interactive rounded-xl border border-border bg-card p-4"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
          Per piattaforma
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        {total === 0 ? (
          <div className="font-display text-3xl leading-none tabular-nums">
            —
          </div>
        ) : (
          <DonutMini
            size={64}
            strokeWidth={8}
            slices={[
              {
                label: "Google",
                value: google,
                color: "var(--primary)",
              },
              {
                label: "Meta",
                value: meta,
                color: "color-mix(in oklch, var(--primary) 40%, transparent)",
              },
            ]}
          />
        )}
      </div>
    </div>
  );
}
