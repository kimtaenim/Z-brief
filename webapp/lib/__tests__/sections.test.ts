import { describe, it, expect } from "vitest";
import { splitSections } from "../sections";
import { SECTION_ORDER } from "../types";

const FULL_MARKDOWN = `# 정원엔시스 IR Brief - 2026-05-09

## 종합
### 오늘의 정원엔시스
- 특이 동향 없음

### 총평
RSS 피드 정상 수신.

## 온프레미스AI
온프레미스 AI 클러스터 내용입니다.

## 피지컬AI
피지컬 AI 클러스터 내용입니다.

## 버티컬AI
버티컬 AI 클러스터 내용입니다.

## 보안과PQC
보안 클러스터 내용입니다.

## 밸류에이션
밸류에이션 클러스터 내용입니다.`;

describe("splitSections", () => {
  it("returns all 6 sections when all selected", () => {
    const sections = splitSections(FULL_MARKDOWN, SECTION_ORDER);
    expect(sections).toHaveLength(7);
  });

  it("marks selected sections correctly", () => {
    const sections = splitSections(FULL_MARKDOWN, ["overview", "onprem_ai"]);
    const overview = sections.find((s) => s.id === "overview");
    const onprem = sections.find((s) => s.id === "onprem_ai");
    const physical = sections.find((s) => s.id === "physical_ai");
    expect(overview?.selected).toBe(true);
    expect(onprem?.selected).toBe(true);
    expect(physical?.selected).toBe(false);
  });

  it("parses overview section content correctly", () => {
    const sections = splitSections(FULL_MARKDOWN, SECTION_ORDER);
    const overview = sections.find((s) => s.id === "overview");
    expect(overview?.markdown).toContain("오늘의 정원엔시스");
    expect(overview?.markdown).toContain("총평");
  });

  it("does not include h1 title in any section", () => {
    const sections = splitSections(FULL_MARKDOWN, SECTION_ORDER);
    for (const s of sections) {
      expect(s.markdown).not.toContain("IR Brief - 2026");
    }
  });

  it("returns empty markdown for unmatched section header variant", () => {
    const malformed = `## 종합 (요약)\n내용\n\n## 온프레미스AI\n온프레미스 내용`;
    const sections = splitSections(malformed, SECTION_ORDER);
    const overview = sections.find((s) => s.id === "overview");
    expect(overview?.markdown).toBe("");
  });

  it("handles empty markdown input", () => {
    const sections = splitSections("", SECTION_ORDER);
    expect(sections).toHaveLength(7);
    for (const s of sections) {
      expect(s.markdown).toBe("");
    }
  });

  it("h3 subsections stay within their h2 parent", () => {
    const sections = splitSections(FULL_MARKDOWN, SECTION_ORDER);
    const overview = sections.find((s) => s.id === "overview");
    expect(overview?.markdown).toContain("### 오늘의 정원엔시스");
    const onprem = sections.find((s) => s.id === "onprem_ai");
    expect(onprem?.markdown).not.toContain("### 오늘의 정원엔시스");
  });
});
