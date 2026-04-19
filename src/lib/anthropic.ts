import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";

export async function getAnthropicClient() {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const apiKey = settings?.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Claude API key non configurata. Vai in Settings per aggiungerla."
    );
  }
  return new Anthropic({ apiKey });
}

// Sonnet 4.6: best quality/cost ratio for structured analysis
export const DEFAULT_MODEL = "claude-sonnet-4-6";
