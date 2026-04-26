export interface ModelUsage {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface CostBreakdown {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  usd: number;
}

export interface CostSummary {
  per_call: CostBreakdown[];
  total_usd: number;
  total_krw: number;
  total_input_tokens: number;
  total_output_tokens: number;
}

const USD_TO_KRW = 1400;

const PRICE_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-sonnet-4-5": { input: 3, output: 15 },
};

function priceFor(model: string): { input: number; output: number } {
  if (PRICE_USD_PER_MTOK[model]) return PRICE_USD_PER_MTOK[model];
  if (model.includes("haiku")) return { input: 1, output: 5 };
  if (model.includes("sonnet")) return { input: 3, output: 15 };
  return { input: 3, output: 15 };
}

export function computeCost(usage: ModelUsage): CostBreakdown {
  const p = priceFor(usage.model);
  const cacheCreation = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const usd =
    (usage.input_tokens * p.input) / 1_000_000 +
    (cacheCreation * p.input * 1.25) / 1_000_000 +
    (cacheRead * p.input * 0.1) / 1_000_000 +
    (usage.output_tokens * p.output) / 1_000_000;
  return {
    model: usage.model,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cache_creation_tokens: cacheCreation,
    cache_read_tokens: cacheRead,
    usd,
  };
}

export function summarizeCost(usages: ModelUsage[]): CostSummary {
  const per_call = usages.map(computeCost);
  const total_usd = per_call.reduce((s, c) => s + c.usd, 0);
  const total_input_tokens = usages.reduce(
    (s, u) =>
      s +
      u.input_tokens +
      (u.cache_creation_input_tokens ?? 0) +
      (u.cache_read_input_tokens ?? 0),
    0,
  );
  const total_output_tokens = usages.reduce((s, u) => s + u.output_tokens, 0);
  return {
    per_call,
    total_usd,
    total_krw: total_usd * USD_TO_KRW,
    total_input_tokens,
    total_output_tokens,
  };
}

export function formatKrw(krw: number): string {
  if (krw < 1) return "₩0";
  if (krw < 100) return `₩${krw.toFixed(1)}`;
  return `₩${Math.round(krw).toLocaleString("ko-KR")}`;
}

export function formatUsd(usd: number): string {
  if (usd < 0.001) return "$0";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}

export function formatTokens(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

export const USD_TO_KRW_RATE = USD_TO_KRW;
