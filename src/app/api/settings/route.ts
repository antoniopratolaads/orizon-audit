import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DEFAULT_PROMPTS } from "@/lib/constants";

export async function GET() {
  const s = await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
  return NextResponse.json({
    ...s,
    anthropicApiKey: s.anthropicApiKey ? maskKey(s.anthropicApiKey) : "",
    hasApiKey: Boolean(s.anthropicApiKey),
    promptGoogleEcom: s.promptGoogleEcom ?? DEFAULT_PROMPTS.googleEcom,
    promptGoogleLeadgen: s.promptGoogleLeadgen ?? DEFAULT_PROMPTS.googleLeadgen,
    promptMeta: s.promptMeta ?? DEFAULT_PROMPTS.meta,
  });
}

function maskKey(k: string) {
  if (k.length < 10) return "••••";
  return `${k.slice(0, 6)}••••${k.slice(-4)}`;
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const data: Record<string, string | null> = {};
  if (typeof body.anthropicApiKey === "string") {
    // Only update if user provided a real key (not masked one)
    if (body.anthropicApiKey && !body.anthropicApiKey.includes("••••")) {
      data.anthropicApiKey = body.anthropicApiKey.trim();
    } else if (body.anthropicApiKey === "") {
      data.anthropicApiKey = null;
    }
  }
  if (typeof body.promptGoogleEcom === "string")
    data.promptGoogleEcom = body.promptGoogleEcom;
  if (typeof body.promptGoogleLeadgen === "string")
    data.promptGoogleLeadgen = body.promptGoogleLeadgen;
  if (typeof body.promptMeta === "string") data.promptMeta = body.promptMeta;

  await prisma.settings.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  });
  return NextResponse.json({ ok: true });
}
