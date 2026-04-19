import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Plus, FileSpreadsheet } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { AvatarInitials } from "@/components/avatar-initials";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  formatDateTime,
  platformLabel,
  businessLabel,
} from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      audits: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!client) notFound();

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title={client.name}
        description={client.description ?? undefined}
        actions={
          <Button asChild size="sm">
            <Link href={`/audits/new?clientId=${client.id}`}>
              <Plus className="size-4" /> Nuovo audit
            </Link>
          </Button>
        }
      />

      <div className="mb-5 flex items-center gap-3 rounded-lg border border-border bg-card p-3">
        <AvatarInitials name={client.name} size={44} />
        <div className="flex-1">
          <div className="text-sm font-medium">{client.name}</div>
          <div className="text-xs text-muted-foreground">
            {client.audits.length} audit · creato {formatDateTime(client.createdAt)}
          </div>
        </div>
      </div>

      <Tabs defaultValue="audits">
        <TabsList>
          <TabsTrigger value="audits">Audit ({client.audits.length})</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
        </TabsList>
        <TabsContent value="audits" className="pt-4">
          {client.audits.length === 0 ? (
            <EmptyState
              icon={FileSpreadsheet}
              title="Nessun audit"
              description="Crea il primo audit per questo cliente."
              action={
                <Button asChild size="sm">
                  <Link href={`/audits/new?clientId=${client.id}`}>
                    <Plus className="size-4" /> Nuovo audit
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Piattaforma</th>
                    <th className="px-3 py-2 text-left font-medium">Tipo</th>
                    <th className="px-3 py-2 text-left font-medium">Stato</th>
                    <th className="px-3 py-2 text-left font-medium">Creato</th>
                  </tr>
                </thead>
                <tbody>
                  {client.audits.map((a) => (
                    <tr
                      key={a.id}
                      className="border-b border-border last:border-0 hover:bg-accent/30"
                    >
                      <td className="px-3 py-2">
                        <Link
                          href={`/audits/${a.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {platformLabel(a.platform)}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {businessLabel(a.businessType)}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          variant={a.status === "completed" ? "default" : "outline"}
                          className="text-[10px]"
                        >
                          {a.status === "completed" ? "Completato" : "Draft"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {formatDateTime(a.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
        <TabsContent value="overview" className="pt-4">
          <div className="rounded-lg border border-border bg-card p-4 text-sm">
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                  Nome
                </dt>
                <dd>{client.name}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                  Creato il
                </dt>
                <dd>{formatDateTime(client.createdAt)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                  Descrizione
                </dt>
                <dd>{client.description ?? "—"}</dd>
              </div>
            </dl>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
