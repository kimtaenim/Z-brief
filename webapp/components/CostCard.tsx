"use client";

import { Card } from "@/components/ui/Card";
import { formatKrw, formatTokens, formatUsd, type CostBreakdown, type CostSummary } from "@/lib/cost";

interface Props {
  cost: CostSummary;
  mode: "live" | "mock";
}

function modelShort(model: string): string {
  if (model.includes("haiku")) return "Haiku";
  if (model.includes("sonnet")) return "Sonnet";
  return model;
}

function aggregate(per_call: CostBreakdown[]): CostBreakdown[] {
  const map = new Map<string, CostBreakdown>();
  for (const c of per_call) {
    const k = modelShort(c.model);
    const cur = map.get(k);
    if (cur) {
      cur.input_tokens += c.input_tokens;
      cur.output_tokens += c.output_tokens;
      cur.usd += c.usd;
    } else {
      map.set(k, { ...c, model: k });
    }
  }
  return Array.from(map.values());
}

export function CostCard({ cost, mode }: Props) {
  const lines = aggregate(cost.per_call);
  const isMock = mode === "mock";

  return (
    <Card padding="md">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-[12px] font-medium uppercase tracking-wider text-zinc-500">
          토큰 · 비용
        </h3>
        {isMock && (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-400">
            mock — 청구 없음
          </span>
        )}
      </div>
      <ul className="space-y-1.5 text-[13px]">
        {lines.map((c) => (
          <li key={c.model} className="flex items-baseline justify-between gap-3">
            <span className="text-zinc-700">
              {c.model}
              <span className="ml-2 text-zinc-400">
                in {formatTokens(c.input_tokens)} · out {formatTokens(c.output_tokens)}
              </span>
            </span>
            <span className="tabular-nums text-zinc-500">{formatUsd(c.usd)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-baseline justify-between border-t border-zinc-100 pt-3">
        <span className="text-[13px] font-medium text-zinc-700">
          합계 · 1 USD = ₩1,400
        </span>
        <span className="text-[15px] font-semibold tabular-nums text-blue-600">
          {formatKrw(cost.total_krw)}
        </span>
      </div>
    </Card>
  );
}
