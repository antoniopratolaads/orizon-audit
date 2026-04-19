import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";
import { AvatarInitials } from "@/components/avatar-initials";
import { EmptyState } from "@/components/empty-state";
import { formatDate, platformLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    include: {
      audits: {
        select: { id: true, platform: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      _count: { select: { audits: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title="Clienti"
        description="Anagrafica clienti dell'agenzia."
        actions={
          <Button asChild size="sm">
            <Link href="/clients/new">
              <Plus className="size-4" /> Nuovo cliente
            </Link>
          </Button>
        }
      />

      {clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nessun cliente"
          description="Aggiungi il primo cliente per iniziare."
          action={
            <Button asChild size="sm">
              <Link href="/clients/new">
                <Plus className="size-4" /> Nuovo cliente
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {clients.map((c) => {
            const last = c.audits[0];
            return (
              <Link
                key={c.id}
                href={`/clients/${c.id}`}
                className="group rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-accent/40"
              >
                <div className="flex items-start gap-3">
                  <AvatarInitials name={c.name} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{c.name}</div>
                    {c.description && (
                      <div className="truncate text-xs text-muted-foreground">
                        {c.description}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{c._count.audits} audit</span>
                  {last ? (
                    <span>
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
    </div>
  );
}
