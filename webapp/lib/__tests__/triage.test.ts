import { describe, it, expect } from "vitest";
import { parsePicks } from "../triage";

describe("parsePicks", () => {
  it("parses valid JSON array", () => {
    const text = '[{"index": 0, "reason": "relevant"}, {"index": 2, "reason": "important"}]';
    const picks = parsePicks(text, 3, 5);
    expect(picks).toHaveLength(2);
    expect(picks[0]).toEqual({ index: 0, reason: "relevant" });
    expect(picks[1]).toEqual({ index: 2, reason: "important" });
  });

  it("parses JSON wrapped in LLM preamble", () => {
    const text = 'Here are my picks:\n[{"index": 1, "reason": "good"}]';
    const picks = parsePicks(text, 3, 5);
    expect(picks).toHaveLength(1);
    expect(picks[0].index).toBe(1);
  });

  it("returns empty array for malformed JSON", () => {
    expect(parsePicks("not json", 3, 5)).toEqual([]);
    expect(parsePicks("[{broken}", 3, 5)).toEqual([]);
    expect(parsePicks("", 3, 5)).toEqual([]);
  });

  it("filters out indices >= maxIdx", () => {
    const text = '[{"index": 0, "reason": "ok"}, {"index": 5, "reason": "out of range"}]';
    const picks = parsePicks(text, 3, 5);
    expect(picks).toHaveLength(1);
    expect(picks[0].index).toBe(0);
  });

  it("deduplicates repeated indices", () => {
    const text = '[{"index": 1, "reason": "a"}, {"index": 1, "reason": "b"}]';
    expect(parsePicks(text, 3, 5)).toHaveLength(1);
  });

  it("caps result at target", () => {
    const text = '[{"index": 0}, {"index": 1}, {"index": 2}, {"index": 3}]';
    expect(parsePicks(text, 2, 5)).toHaveLength(2);
  });

  it("filters negative indices", () => {
    expect(parsePicks('[{"index": -1, "reason": "neg"}]', 3, 5)).toEqual([]);
  });
});
