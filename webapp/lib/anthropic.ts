import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  if (!client) client = new Anthropic({ apiKey: key });
  return client;
}

export const MODELS = {
  triage: "claude-haiku-4-5-20251001",
  summarize: "claude-sonnet-4-6",
} as const;
