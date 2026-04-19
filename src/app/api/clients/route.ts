import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

export async function GET() {
  const clients = await prisma.client.findMany({
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, description: true, createdAt: true },
  });
  return NextResponse.json(clients);
}

const CreateClient = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(""),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = CreateClient.safeParse(body);
  if (!parsed.success) {
    return new NextResponse("Invalid body", { status: 400 });
  }
  const client = await prisma.client.create({
    data: {
      name: parsed.data.name.trim(),
      description: parsed.data.description?.trim() || null,
    },
  });
  return NextResponse.json(client);
}
