import { prisma } from "@/lib/db";
import { fillTemplate } from "@/lib/xlsx-fill";
import { pickTemplate } from "@/lib/templates";
import type { Platform, BusinessType } from "@/lib/constants";
import type { AuditData } from "@/lib/parsers/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const audit = await prisma.audit.findUnique({
    where: { id },
    include: { client: true },
  });
  if (!audit) return new Response("Not found", { status: 404 });

  const auditData: AuditData = JSON.parse(audit.auditData || "{}");
  // Ensure at least header is populated so the template is usable even
  // if the AI generation didn't complete.
  if (!auditData.header) {
    auditData.header = {
      cliente: audit.client.name,
      dataAudit: new Date().toLocaleDateString("it-IT"),
    };
  }
  auditData.kpi = auditData.kpi ?? [];
  auditData.checklist = auditData.checklist ?? [];
  auditData.actions = auditData.actions ?? [];
  auditData.presentation = auditData.presentation ?? [];

  const templateKind = pickTemplate(
    audit.platform as Platform,
    audit.businessType as BusinessType
  );
  const buffer = await fillTemplate(templateKind, auditData);

  const safeName = audit.client.name.replace(/[^\w\s-]/g, "").trim();
  const date = new Date().toISOString().slice(0, 10);
  const filename = `ORIZON_Audit_${safeName || "Cliente"}_${audit.platform}_${date}.xlsx`;

  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
