import { prisma } from "@/lib/db";
import { generateAuditData } from "@/lib/ai-pipeline";
import type { AuditData, ParsedData } from "@/lib/parsers/types";

function countStatuses(checklist: AuditData["checklist"]) {
  const c = { ok: 0, warn: 0, crit: 0, na: 0 };
  for (const x of checklist) {
    if (x.status === "OK") c.ok++;
    else if (x.status === "Warning") c.warn++;
    else if (x.status === "Critico") c.crit++;
    else if (x.status === "N/A" || x.type === "MANUAL") c.na++;
  }
  return c;
}

export const maxDuration = 300; // 5 min, server function timeout hint

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const audit = await prisma.audit.findUnique({
    where: { id },
    include: { client: true },
  });
  if (!audit) return new Response("Not found", { status: 404 });

  const parsed: ParsedData = JSON.parse(audit.rawData);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
            )
          );
        } catch {
          closed = true;
        }
      };

      // Heartbeat every 3s so the client knows we are alive during Claude's long wait
      const start = Date.now();
      const heartbeat = setInterval(() => {
        const seconds = Math.floor((Date.now() - start) / 1000);
        send("heartbeat", { elapsed: seconds });
      }, 3000);

      try {
        send("stage", { message: "Parsing e preparazione dati..." });
        const auditData = await generateAuditData({
          clientName: audit.client.name,
          parsed,
          onProgress: (m) => send("stage", { message: m }),
          onToken: (chunk) => send("token", { chunk }),
        });

        send("stage", { message: "Salvataggio..." });
        await prisma.audit.update({
          where: { id },
          data: {
            auditData: JSON.stringify(auditData),
            status: "draft",
          },
        });

        // Always send done with summary so the client can show a preview modal
        send("done", {
          ok: true,
          summary: {
            executiveSummary: auditData.executiveSummary ?? "",
            counts: countStatuses(auditData.checklist ?? []),
            actionsCount: (auditData.actions ?? []).length,
            topActions: (auditData.actions ?? []).slice(0, 3),
            kpiCount: (auditData.kpi ?? []).length,
            presentationCount: (auditData.presentation ?? []).length,
          },
        });
      } catch (err) {
        console.error("[generate] fatal error:", err);
        send("error", {
          message: err instanceof Error ? err.message : "Errore",
        });
      } finally {
        clearInterval(heartbeat);
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
