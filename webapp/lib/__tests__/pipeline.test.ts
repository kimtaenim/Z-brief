import { describe, it, expect } from "vitest";
import {
  findCompanyArticles,
  brokerToArticle,
  normalizeSections,
  matchBrokerReportsToClusters,
} from "../pipeline";
import { SECTION_ORDER } from "../types";
import type { Article } from "../types";
import type { BrokerReport } from "../broker_research";

function makeArticle(o: Partial<Article> = {}): Article {
  return {
    cluster_id: "onprem_ai",
    title: "테스트 기사",
    url: "https://example.com",
    source: "테스트매체",
    author: null,
    published: null,
    summary: "",
    language: "ko",
    ...o,
  };
}

const clusters = [
  { id: "onprem_ai", name: "온프레미스AI", keywords_ko: ["온프레미스AI"], keywords_en: ["on-premise"] },
  { id: "valuation", name: "밸류에이션", keywords_ko: ["AI IPO"], keywords_en: ["AI IPO"] },
// eslint-disable-next-line @typescript-eslint/no-explicit-any
] as any;

describe("findCompanyArticles", () => {
  it("matches by title", () => {
    const result = findCompanyArticles(
      [makeArticle({ title: "정원엔시스 AI 도입" }), makeArticle({ title: "삼성전자 실적" })],
      ["정원엔시스"],
    );
    expect(result).toHaveLength(1);
    expect(result[0].title).toContain("정원엔시스");
  });

  it("matches by summary", () => {
    const result = findCompanyArticles(
      [makeArticle({ summary: "바스코ICT 관련 내용" })],
      ["바스코ICT"],
    );
    expect(result).toHaveLength(1);
  });

  it("returns empty when no match", () => {
    expect(findCompanyArticles([makeArticle()], ["정원엔시스"])).toHaveLength(0);
  });
});

describe("normalizeSections", () => {
  it("returns full SECTION_ORDER when undefined", () => {
    expect(normalizeSections(undefined)).toEqual(SECTION_ORDER);
  });

  it("returns full SECTION_ORDER when empty array", () => {
    expect(normalizeSections([])).toEqual(SECTION_ORDER);
  });

  it("preserves SECTION_ORDER sort regardless of input order", () => {
    const result = normalizeSections(["valuation", "overview"]);
    expect(result.indexOf("overview")).toBeLessThan(result.indexOf("valuation"));
  });

  it("filters invalid section ids", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = normalizeSections(["overview", "invalid_section" as any]);
    expect(result).not.toContain("invalid_section");
    expect(result).toContain("overview");
  });
});

describe("brokerToArticle", () => {
  it("converts BrokerReport to Article shape", () => {
    const report: BrokerReport = {
      broker: "미래에셋",
      source_id: "mirae",
      title: "AI 인프라 전망",
      url: "https://broker.example.com/1",
      date: "2026-05-10",
      category: "IT",
    };
    const article = brokerToArticle(report, "valuation");
    expect(article.cluster_id).toBe("valuation");
    expect(article.title).toContain("미래에셋");
    expect(article.title).toContain("AI 인프라 전망");
    expect(article.source).toBe("미래에셋");
  });
});

describe("matchBrokerReportsToClusters", () => {
  it("routes report to cluster by keyword match", () => {
    const reports: BrokerReport[] = [
      { broker: "A증권", source_id: "a", title: "AI IPO 전망", url: "http://a.com", date: null, category: null },
    ];
    const map = matchBrokerReportsToClusters(reports, clusters);
    expect(map.get("valuation")).toHaveLength(1);
    expect(map.get("onprem_ai")).toHaveLength(0);
  });

  it("returns empty arrays for all clusters when no reports", () => {
    const map = matchBrokerReportsToClusters([], clusters);
    for (const c of clusters) expect(map.get(c.id)).toHaveLength(0);
  });
});
