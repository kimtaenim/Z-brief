/**
 * cache-delete.test.ts — deleteBrief 원자성 TDD: 구현 전에 먼저 작성
 *
 * WHY 이 테스트가 필요한가:
 *   기존 deleteBrief()는 Redis에서 두 단계로 삭제를 수행한다.
 *   1단계: briefKey 삭제
 *   2단계: recentKey 목록에서 해당 항목 제거 (del + rpush)
 *   1단계 성공 후 2단계 실패 시 brief는 사라졌는데 목록에는 남는 "좀비 항목"이 생긴다.
 *   메모리 fallback 경로에서 이 일관성을 먼저 검증한다.
 */

import { describe, it, expect } from "vitest";
import { saveBrief, loadBrief, deleteBrief, listRecent } from "../cache";
import type { BriefRecord } from "../types";
import { SECTION_ORDER } from "../types";

function makeRecord(id: string): BriefRecord {
  return {
    id,
    createdAt: new Date().toISOString(),
    dateKst: "2026-05-10",
    timeKst: "2026-05-10 10:00",
    sections: SECTION_ORDER.map((sid) => ({
      id: sid,
      name: sid,
      markdown: "",
      selected: false,
    })),
    fullMarkdown: "# 테스트",
    meta: {
      mode: "mock",
      feedReports: [],
      brokerReports: [],
      brokerItems: [],
      anomalies: [],
      clusterCounts: {},
      selectedSections: [],
      userInterest: null,
      usages: [],
      cost: { total_usd: 0, total_krw: 0, total_input_tokens: 0, total_output_tokens: 0 },
    },
  };
}

const p = `del-atomic-${Date.now()}`;

describe("deleteBrief 원자성 (메모리 fallback)", () => {
  it("삭제 후 loadBrief가 null을 반환한다", async () => {
    const r = makeRecord(`${p}-1`);
    await saveBrief(r);
    await deleteBrief(`${p}-1`);
    expect(await loadBrief(`${p}-1`)).toBeNull();
  });

  it("삭제 후 listRecent에서도 제거된다 — 좀비 항목 없음", async () => {
    // WHY: 이 테스트가 핵심이다. brief는 없는데 목록에는 남아있으면 안 된다.
    const r = makeRecord(`${p}-2`);
    await saveBrief(r);
    await deleteBrief(`${p}-2`);
    const recent = await listRecent(50);
    const zombie = recent.find((s) => s.id === `${p}-2`);
    expect(zombie).toBeUndefined();
  });

  it("여러 brief 중 하나만 삭제해도 나머지는 listRecent에 남는다", async () => {
    const a = makeRecord(`${p}-3a`);
    const b = makeRecord(`${p}-3b`);
    await saveBrief(a);
    await saveBrief(b);
    await deleteBrief(`${p}-3a`);
    const recent = await listRecent(50);
    expect(recent.find((s) => s.id === `${p}-3a`)).toBeUndefined();
    expect(recent.find((s) => s.id === `${p}-3b`)).toBeDefined();
  });

  it("존재하지 않는 id 삭제 시 false를 반환하고 목록을 오염시키지 않는다", async () => {
    const before = await listRecent(50);
    const result = await deleteBrief(`${p}-nonexistent`);
    const after = await listRecent(50);
    expect(result).toBe(false);
    expect(after.length).toBe(before.length);
  });
});
