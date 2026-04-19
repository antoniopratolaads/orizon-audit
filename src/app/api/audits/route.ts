import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseUpload } from "@/lib/parsers";
import type { Platform, BusinessType } from "@/lib/constants";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
  const clientId = url.searchParams.get("clientId");
  const audits = await prisma.audit.findMany({
    where: clientId ? { clientId } : undefined,
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 200),
    include: { client: true },
  });
  return NextResponse.json(
    audits.map((a) => ({
      id: a.id,
      clientId: a.clientId,
      clientName: a.client.name,
      platform: a.platform,
      businessType: a.businessType,
      status: a.status,
      createdAt: a.createdAt,
    }))
  );
}

export async function POST(req: Request) {
  const form = await req.formData();
  const clientId = String(form.get("clientId") ?? "");
  const platform = String(form.get("platform") ?? "") as Platform;
  const businessType = String(form.get("businessType") ?? "") as BusinessType;
  const auditor = String(form.get("auditor") ?? "") || null;
  const file = form.get("file") as File | null;

  if (!clientId || !platform || !businessType || !file) {
    return new NextResponse("Missing fields", { status: 400 });
  }
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return new NextResponse("Client not found", { status: 404 });

  const parsed = await parseUpload(platform, businessType, file);

  const audit = await prisma.audit.create({
    data: {
      clientId,
      platform,
      businessType,
      auditor,
      periodStart: parsed.period?.start
        ? new Date(parsed.period.start)
        : null,
      periodEnd: parsed.period?.end ? new Date(parsed.period.end) : null,
      rawData: JSON.stringify(parsed),
      auditData: "{}",
    },
  });

  return NextResponse.json({ id: audit.id });
}
