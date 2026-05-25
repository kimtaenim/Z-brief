import { describe, it, expect } from "vitest";
import { splitSections } from "../sections";
import { SECTION_ORDER } from "../types";

const FULL_MARKDOWN = `# 정원엔시스 IR Brief - 2026-05-09

## 종합
### 오늘의 정원엔시스
- 특이 동향 없음

### 총평
RSS 피드 정상 수신.

## 회사 PR과 IR
PR/IR 클러스터 내용입니다.

## 서버와 IT 인프라
서버 인프라 내용입니다.

## 에너지AI
에너지 클러스터 내용입니다.

## 의료AI
의료 클러스터 내용입니다.

## 피지컬AI와 로봇
로봇 클러스터 내용입니다.

## 보안과 PQC
보안 클러스터 내용입니다.

## 지식과 온톨로지
지식 클러스터 내용입니다.

## 딥러닝과 MLOps
딥러닝 클러스터 내용입니다.`;

describe("splitSections", () => {
  it("returns all 9 sections when all selected", () => {
    const sections = splitSections(FULL_MARKDOWN, SECTION_ORDER);
    expect(sections).toHaveLength(9);
  });

  it("marks selected sections correctly", () => {
    const sections = splitSections(FULL_MARKDOWN, ["overview", "pr_ir"]);
    const overview = sections.find((s) => s.id === "overview");
    const pr = sections.find((s) => s.id === "pr_ir");
    const physical = sections.find((s) => s.id === "physical_ai");
    expect(overview?.selected).toBe(true);
    expect(pr?.selected).toBe(true);
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
    const malformed = `## 종합 (요약)\n내용\n\n## 회사 PR과 IR\nPR 내용`;
    const sections = splitSections(malformed, SECTION_ORDER);
    const overview = sections.find((s) => s.id === "overview");
    expect(overview?.markdown).toBe("");
  });

  it("handles empty markdown input", () => {
    const sections = splitSections("", SECTION_ORDER);
    expect(sections).toHaveLength(9);
    for (const s of sections) {
      expect(s.markdown).toBe("");
    }
  });

  it("h3 subsections stay within their h2 parent", () => {
    const sections = splitSections(FULL_MARKDOWN, SECTION_ORDER);
    const overview = sections.find((s) => s.id === "overview");
    expect(overview?.markdown).toContain("### 오늘의 정원엔시스");
    const pr = sections.find((s) => s.id === "pr_ir");
    expect(pr?.markdown).not.toContain("### 오늘의 정원엔시스");
  });
});
