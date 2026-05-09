import { describe, it, expect } from "vitest";
import { withinWindow, dedupByTitle, filterArticles } from "../filter";
import type { Article } from "../types";

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    cluster_id: "test",
    title: "테스트 기사",
    url: "https://example.com",
    source: "테스트",
    author: null,
    published: new Date().toISOString(),
    summary: "",
    language: "ko",
    ...overrides,
  };
}

describe("withinWindow", () => {
  it("includes article published within the window", () => {
    const recent = makeArticle({ published: new Date().toISOString() });
    expect(withinWindow([recent], 24)).toHaveLength(1);
  });

  it("excludes article published outside the window", () => {
    const old = makeArticle({
      published: new Date(Date.now() - 49 * 3600 * 1000).toISOString(),
    });
    expect(withinWindow([old], 48)).toHaveLength(0);
  });

  it("includes article with null published (design: null = pass through)", () => {
    const noDate = makeArticle({ published: null });
    expect(withinWindow([noDate], 24)).toHaveLength(1);
  });

  it("includes article with unparseable date (passes through like null)", () => {
    const invalid = makeArticle({ published: "not-a-date" });
    expect(withinWindow([invalid], 24)).toHaveLength(1);
  });
});

describe("dedupByTitle", () => {
  it("keeps unique titles", () => {
    const a = makeArticle({ title: "AI 시장 동향" });
    const b = makeArticle({ title: "로봇 산업 전망" });
    expect(dedupByTitle([a, b])).toHaveLength(2);
  });

  it("removes exact duplicate title", () => {
    const a = makeArticle({ title: "AI 시장 동향" });
    const b = makeArticle({ title: "AI 시장 동향" });
    expect(dedupByTitle([a, b])).toHaveLength(1);
  });

  it("removes near-duplicate title above 0.85 threshold", () => {
    const a = makeArticle({ title: "삼성전자 AI 칩 출시 발표" });
    const b = makeArticle({ title: "삼성전자 AI 칩 출시 발표." });
    expect(dedupByTitle([a, b])).toHaveLength(1);
  });

  it("keeps titles with similarity below threshold", () => {
    const a = makeArticle({ title: "AI 반도체 시장 분석" });
    const b = makeArticle({ title: "클라우드 컴퓨팅 트렌드 전망" });
    expect(dedupByTitle([a, b])).toHaveLength(2);
  });

  it("skips articles with empty title", () => {
    const empty = makeArticle({ title: "" });
    const valid = makeArticle({ title: "정상 제목" });
    expect(dedupByTitle([empty, valid])).toHaveLength(1);
  });
});

describe("filterArticles", () => {
  it("applies both window and dedup", () => {
    const recent = makeArticle({ title: "최신 기사" });
    const old = makeArticle({
      title: "오래된 기사",
      published: new Date(Date.now() - 49 * 3600 * 1000).toISOString(),
    });
    const dup = makeArticle({ title: "최신 기사" });
    const result = filterArticles([recent, old, dup], 48);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("최신 기사");
  });
});
