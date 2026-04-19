import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const audit = await prisma.audit.findUnique({
    where: { id },
    include: { client: true },
  });
  if (!audit) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json({
    ...audit,
    rawData: JSON.parse(audit.rawData || "{}"),
    auditData: JSON.parse(audit.auditData || "{}"),
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.auditData !== undefined)
    data.auditData = JSON.stringify(body.auditData);
  if (body.status) data.status = body.status;
  if (body.auditor !== undefined) data.auditor = body.auditor;
  const audit = await prisma.audit.update({ where: { id }, data });
  return NextResponse.json({ id: audit.id, status: audit.status });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.audit.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
