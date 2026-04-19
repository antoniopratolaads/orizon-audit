import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AuditEditor } from "./editor-client";

export const dynamic = "force-dynamic";

export default async function AuditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const audit = await prisma.audit.findUnique({
    where: { id },
    include: { client: true },
  });
  if (!audit) notFound();

  return (
    <AuditEditor
      id={audit.id}
      clientName={audit.client.name}
      platform={audit.platform}
      businessType={audit.businessType}
      createdAt={audit.createdAt.toISOString()}
      auditData={JSON.parse(audit.auditData || "{}")}
      status={audit.status}
    />
  );
}
