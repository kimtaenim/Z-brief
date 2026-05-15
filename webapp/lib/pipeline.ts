import { v4 as uuidv4 } from "uuid";
import {
  anomaliesToText,
  detectAnomalies,
  recordDailyMentions,
  type Anomaly,
} from "./anomaly";
import {
  crawlAllBrokers,
  type BrokerFetchReport,
  type BrokerReport,
} from "./broker_research";
import { loadClusters } from "./clusters";
import { summarizeCost, type ModelUsage } from "./cost";
import { fetchCluster } from "./fetch";
import { filterArticles, filterArticlesByDay } from "./filter";
import {
  companyTerms,
  loadDirectCompanies,
  loadThresholds,
} from "./loaders";
import { mockAnomalies, mockBrief, mockBrokerReports } from "./mock";
import { sanitize } from "./render";
import { splitSections } from "./sections";
import { nowKstDate, nowKstDateTime, summarizeBrief } from "./summarize";
import { triageCluster } from "./triage";
import type {
  Article,
  BriefRecord,
  ClusterRunOutput,
  FetchReport,
  GenerateRequest,
  SectionId,
} from "./types";
import { SECTION_ORDER } from "./types";

function findCompanyArticles(all: Article[], terms: string[]): Article[] {
  return all.filter((a) =>
    terms.some(
      (t) => a.title.includes(t) || (a.summary?.includes(t) ?? false),
    ),
  );
}

function brokerToArticle(report: BrokerReport, clusterId: string): Article {
  return {
    cluster_id: clusterId,
    title: `[${report.broker} 리서치] ${report.title}`,
    url: report.url,
    source: report.broker,
    author: null,
    published: report.date,
    summary: report.category ? `증권사 리포트 카테고리: ${report.category}` : "",
    language: "ko",
  };
}

function matchBrokerReportsToClusters(
  reports: BrokerReport[],
  clusters: ReturnType<typeof loadClusters>["clusters"],
): Map<string, Article[]> {
  const out = new Map<string, Article[]>();
  for (const c of clusters) out.set(c.id, []);

  for (const r of reports) {
    const haystack = `${r.title} ${r.category ?? ""}`.toLowerCase();
    let bestId: string | null = null;
    let bestScore = 0;
    for (const c of clusters) {
      const kws = [...(c.keywords_ko ?? []), ...(c.keywords_en ?? [])];
      let score = 0;
      for (const kw of kws) {
        if (haystack.includes(kw.toLowerCase())) score += 1;
      }
      if (score > bestScore) {
        bestScore = score;
        bestId = c.id;
      }
    }
    if (bestId) out.get(bestId)!.push(brokerToArticle(r, bestId));
  }
  return out;
}

function normalizeSections(req: SectionId[] | undefined): SectionId[] {
  if (!req || req.length === 0) return [...SECTION_ORDER];
  const set = new Set<SectionId>();
  for (const id of req) {
    if (SECTION_ORDER.includes(id)) set.add(id);
  }
  return SECTION_ORDER.filter((id) => set.has(id));
}

const CLUSTER_OF_SECTION: Partial<Record<SectionId, string>> = {
  onprem_ai: "onprem_ai",
  physical_ai: "physical_ai",
  vertical_ai: "vertical_ai",
  security_pqc: "security_pqc",
  valuation: "valuation",
};

export async function runPipeline(req: GenerateRequest): Promise<BriefRecord> {
  const cfg = loadClusters();
  const direct = loadDirectCompanies();
  const t = loadThresholds();
  const terms = companyTerms(direct);
  const hasKey = !!process.env.ANTHROPIC_API_KEY;

  const selected = normalizeSections(req.sections);
  const userInterest = (req.userInterest ?? "").trim() || null;
  const anchorDate = req.anchorDate?.match(/^\d{4}-\d{2}-\d{2}$/) ? req.anchorDate : null;
  const overviewSelected = selected.includes("overview");

  const clusterIdsNeeded = new Set<string>();
  if (overviewSelected) for (const c of cfg.clusters) clusterIdsNeeded.add(c.id);
  for (const s of selected) {
    const cid = CLUSTER_OF_SECTION[s];
    if (cid) clusterIdsNeeded.add(cid);
  }

  const fetchPromise = Promise.all(
    cfg.clusters.map((c) =>
      clusterIdsNeeded.has(c.id)
        ? fetchCluster(c.id, c.rss_feeds ?? [])
        : Promise.resolve({ cluster_id: c.id, articles: [], reports: [] }),
    ),
  );
  const brokerPromise = crawlAllBrokers();

  const [fetched, brokerCrawl] = await Promise.all([fetchPromise, brokerPromise]);
  const allReports: FetchReport[] = fetched.flatMap((f) => f.reports);

  let brokerReports: BrokerReport[] = brokerCrawl.reports;
  const brokerFetchReports: BrokerFetchReport[] = brokerCrawl.fetch_reports;
  if (!hasKey && brokerReports.length === 0) {
    brokerReports = mockBrokerReports();
  }

  const filteredPerCluster = fetched.map((res) =>
    anchorDate
      ? filterArticlesByDay(res.articles, anchorDate)
      : filterArticles(res.articles, t.fetch.search_window_hours),
  );

  const brokerByCluster = matchBrokerReportsToClusters(brokerReports, cfg.clusters);
  cfg.clusters.forEach((c, i) => {
    const matched = brokerByCluster.get(c.id) ?? [];
    if (matched.length > 0) filteredPerCluster[i] = [...filteredPerCluster[i], ...matched];
  });

  const clusterCounts: Record<string, number> = {};
  cfg.clusters.forEach((c, i) => {
    clusterCounts[c.id] = filteredPerCluster[i].length;
  });

  const usages: ModelUsage[] = [];
  let runs: ClusterRunOutput[];
  let mode: "live" | "mock" = "mock";
  let companyArticles: Article[] = [];
  let anomalies: Anomaly[] = [];
  let fullMarkdown: string;
  let sanitizeReport: { replaced: Record<string, number>; violations: string[] } | undefined;

  if (hasKey) {
    mode = "live";
    runs = await Promise.all(
      cfg.clusters.map(async (c, i) => {
        if (!clusterIdsNeeded.has(c.id)) {
          return { id: c.id, name: c.name, articles: [] };
        }
        const candidates = filteredPerCluster[i].slice(0, t.fetch.results_per_cluster);
        const result = await triageCluster(c.id, candidates, t.triage.target_keep);
        usages.push(result.usage);
        return { id: c.id, name: c.name, articles: result.articles };
      }),
    );
    const all = runs.flatMap((r) => r.articles);
    companyArticles = findCompanyArticles(all, terms);

    // WHY Redis 체크: detectAnomalies()는 과거 N일간의 언급 이력을 Redis에서 읽어
    // 오늘 수치와 비교해 급증/신규 등장을 감지한다.
    // Redis가 없으면 anomaly.ts는 in-memory(memAccum)로 fallback하지만,
    // Vercel 서버리스 환경에서 메모리는 cold start마다 초기화되어 이력이 항상 0이다.
    // 결과: 기준값이 없어 거의 모든 항목이 "신규 등장"으로 잘못 분류된다.
    // 기능이 작동하는 것처럼 보이지만 실제로는 의미 없는 데이터를 생성한다.
    // Redis가 설정된 경우에만 anomaly를 실행해 이 허위 표시를 방지한다.
    const hasRedis = !!(
      process.env.UPSTASH_REDIS_REST_URL &&
      process.env.UPSTASH_REDIS_REST_TOKEN
    );
    if (overviewSelected && hasRedis) {
      const todayCounts = await recordDailyMentions(all, brokerReports);
      anomalies = await detectAnomalies(todayCounts);
    }

    const summary = await summarizeBrief(runs, companyArticles, brokerReports, {
      selectedSections: selected,
      userInterest,
      anomaliesText: anomaliesToText(anomalies),
      anchorDate,
    });
    usages.push(summary.usage);

    const cleaned = sanitize(summary.markdown, cfg.forbidden_patterns?.banned_words ?? ["추천"]);
    fullMarkdown = cleaned.text;
    sanitizeReport = cleaned.report;
  } else {
    runs = cfg.clusters.map((c, i) => ({
      id: c.id,
      name: c.name,
      articles: filteredPerCluster[i].slice(0, 3),
    }));
    const all = runs.flatMap((r) => r.articles);
    companyArticles = findCompanyArticles(all, terms);

    if (overviewSelected) anomalies = mockAnomalies();

    const raw = mockBrief(runs, companyArticles, allReports, anomalies, brokerReports, {
      selectedSections: selected,
      userInterest,
    });

    const clusterSelected = selected.filter((s) => s !== "overview").length;
    const triageInputBase = 250;
    const triageInputCached = 200;
    const triageOutput = 120;
    const summarizeInput = 400 + 600 * (selected.length / SECTION_ORDER.length);
    const summarizeCacheCreation = 700;
    const summarizeOutput = Math.round(250 * selected.length);

    if (clusterSelected > 0) {
      usages.push({
        model: "claude-haiku-4-5-20251001",
        input_tokens: triageInputBase,
        output_tokens: triageOutput,
        cache_creation_input_tokens: 250,
      });
      for (let i = 1; i < clusterSelected; i++) {
        usages.push({
          model: "claude-haiku-4-5-20251001",
          input_tokens: triageInputCached,
          output_tokens: triageOutput,
          cache_read_input_tokens: 250,
        });
      }
    }
    usages.push({
      model: "claude-sonnet-4-6",
      input_tokens: Math.round(summarizeInput),
      output_tokens: summarizeOutput,
      cache_creation_input_tokens: summarizeCacheCreation,
    });

    const cleaned = sanitize(raw, cfg.forbidden_patterns?.banned_words ?? ["추천"]);
    fullMarkdown = cleaned.text;
    sanitizeReport = cleaned.report;
  }

  const sections = splitSections(fullMarkdown, selected);
  const cost = summarizeCost(usages);

  return {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    dateKst: anchorDate ?? nowKstDate(),
    timeKst: nowKstDateTime(),
    sections,
    fullMarkdown,
    meta: {
      mode,
      feedReports: allReports,
      brokerReports: brokerFetchReports,
      brokerItems: brokerReports,
      anomalies,
      clusterCounts,
      sanitizeReport,
      selectedSections: selected,
      userInterest,
      anchorDate,
      usages,
      cost,
    },
  };
}
