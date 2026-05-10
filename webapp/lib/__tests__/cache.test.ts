import { describe, it, expect } from "vitest";
import { saveBrief, loadBrief, deleteBrief, listRecent } from "../cache";
import type { BriefRecord } from "../types";
import { SECTION_ORDER } from "../types";

// UPSTASH 환경변수가 없으면 메모리 fallback 경로로 실행됨

function makeRecord(id: string): BriefRecord {
  return {
    id,
    createdAt: new Date().toISOString(),
    dateKst: "2026-05-10",
    timeKst: "2026-05-10 09:00",
    sections: SECTION_ORDER.map((sid) => ({
      id: sid,
      name: sid,
      markdown: sid === "overview" ? "## 종합\n테스트" : "",
      selected: sid === "overview",
    })),
    fullMarkdown: "# 테스트",
    meta: {
      mode: "mock",
      feedReports: [],
      brokerReports: [],
      brokerItems: [],
      anomalies: [],
      clusterCounts: {},
      selectedSections: ["overview"],
      userInterest: null,
      usages: [],
      cost: { total_usd: 0, total_krw: 0, total_input_tokens: 0, total_output_tokens: 0 },
    },
  };
}

const p = `cache-test-${Date.now()}`;

describe("cache memory fallback", () => {
  it("save and load round-trip", async () => {
    const r = makeRecord(`${p}-1`);
    await saveBrief(r);
    const loaded = await loadBrief(`${p}-1`);
    expect(loaded?.id).toBe(`${p}-1`);
    expect(loaded?.dateKst).toBe("2026-05-10");
  });

  it("load returns null for unknown id", async () => {
    expect(await loadBrief("never-exists-xyz")).toBeNull();
  });

  it("delete removes record", async () => {
    const r = makeRecord(`${p}-2`);
    await saveBrief(r);
    expect(await deleteBrief(`${p}-2`)).toBe(true);
    expect(await loadBrief(`${p}-2`)).toBeNull();
  });

  it("delete returns false for nonexistent", async () => {
    expect(await deleteBrief("never-saved-xyz")).toBe(false);
  });

  it("listRecent includes saved record", async () => {
    const r = makeRecord(`${p}-3`);
    await saveBrief(r);
    const recent = await listRecent(50);
    const found = recent.find((s) => s.id === `${p}-3`);
    expect(found?.mode).toBe("mock");
    expect(found?.dateKst).toBe("2026-05-10");
  });

  it("listRecent respects limit", async () => {
    expect((await listRecent(1)).length).toBeLessThanOrEqual(1);
  });
});
