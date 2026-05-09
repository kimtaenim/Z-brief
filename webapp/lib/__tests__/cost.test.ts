import { describe, it, expect } from "vitest";
import { computeCost, summarizeCost } from "../cost";
import type { ModelUsage } from "../cost";

describe("computeCost", () => {
  it("computes haiku input cost correctly", () => {
    const usage: ModelUsage = {
      model: "claude-haiku-4-5-20251001",
      input_tokens: 1_000_000,
      output_tokens: 0,
    };
    const { usd } = computeCost(usage);
    expect(usd).toBeCloseTo(1.0, 6);
  });

  it("computes haiku output cost correctly", () => {
    const usage: ModelUsage = {
      model: "claude-haiku-4-5-20251001",
      input_tokens: 0,
      output_tokens: 1_000_000,
    };
    const { usd } = computeCost(usage);
    expect(usd).toBeCloseTo(5.0, 6);
  });

  it("computes sonnet input cost correctly", () => {
    const usage: ModelUsage = {
      model: "claude-sonnet-4-6",
      input_tokens: 1_000_000,
      output_tokens: 0,
    };
    const { usd } = computeCost(usage);
    expect(usd).toBeCloseTo(3.0, 6);
  });

  it("computes cache creation at 1.25x input rate", () => {
    const usage: ModelUsage = {
      model: "claude-haiku-4-5-20251001",
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 1_000_000,
    };
    const { usd } = computeCost(usage);
    expect(usd).toBeCloseTo(1.25, 6);
  });

  it("computes cache read at 0.1x input rate", () => {
    const usage: ModelUsage = {
      model: "claude-haiku-4-5-20251001",
      input_tokens: 0,
      output_tokens: 0,
      cache_read_input_tokens: 1_000_000,
    };
    const { usd } = computeCost(usage);
    expect(usd).toBeCloseTo(0.1, 6);
  });

  it("falls back to sonnet price for unknown model", () => {
    const usage: ModelUsage = {
      model: "claude-unknown-model",
      input_tokens: 1_000_000,
      output_tokens: 0,
    };
    const { usd } = computeCost(usage);
    expect(usd).toBeCloseTo(3.0, 6);
  });

  it("returns zero cost for zero tokens", () => {
    const usage: ModelUsage = { model: "claude-haiku-4-5-20251001", input_tokens: 0, output_tokens: 0 };
    expect(computeCost(usage).usd).toBe(0);
  });
});

describe("summarizeCost", () => {
  it("sums multiple usages correctly", () => {
    const usages: ModelUsage[] = [
      { model: "claude-haiku-4-5-20251001", input_tokens: 1_000_000, output_tokens: 0 },
      { model: "claude-sonnet-4-6", input_tokens: 1_000_000, output_tokens: 0 },
    ];
    const summary = summarizeCost(usages);
    expect(summary.total_usd).toBeCloseTo(4.0, 6);
    expect(summary.total_krw).toBeCloseTo(4.0 * 1400, 1);
  });

  it("converts to KRW at 1400 rate", () => {
    const usages: ModelUsage[] = [
      { model: "claude-haiku-4-5-20251001", input_tokens: 100_000, output_tokens: 0 },
    ];
    const summary = summarizeCost(usages);
    expect(summary.total_krw).toBeCloseTo(summary.total_usd * 1400, 4);
  });

  it("counts total tokens including cache tokens", () => {
    const usages: ModelUsage[] = [
      {
        model: "claude-haiku-4-5-20251001",
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 200,
        cache_read_input_tokens: 300,
      },
    ];
    const summary = summarizeCost(usages);
    expect(summary.total_input_tokens).toBe(600);
    expect(summary.total_output_tokens).toBe(50);
  });
});
