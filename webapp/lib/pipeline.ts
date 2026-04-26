import { v4 as uuidv4 } from "uuid";
import { loadClusters } from "./clusters";
import { fetchCluster } from "./fetch";
import { filterArticles } from "./filter";
import { mockBrief } from "./mock";
import { sanitize } from "./render";
import { nowKstDate, summarizeBrief } from "./summarize";
import { triageCluster } from "./triage";
import type {
  Article,
  BriefRecord,
  ClusterRunOutput,
  FetchReport,
} from "./types";

function findCompanyArticles(all: Article[], terms: string[]): Article[] {
  return all.filter((a) =>
    terms.some(
      (t) => a.title.includes(t) || (a.summary?.includes(t) ?? false),
    ),
  );
}

export async function runPipeline(): Promise<BriefRecord> {
  const cfg = loadClusters();
  const settings = cfg.global;
  const company = settings.company;
  const terms = [company.name, ...(company.related ?? [])].filter(Boolean);
  const hasKey = !!process.env.ANTHROPIC_API_KEY;

  const fetched = await Promise.all(
    cfg.clusters.map((c) => fetchCluster(c.id, c.rss_feeds ?? [])),
  );
  const allReports: FetchReport[] = fetched.flatMap((f) => f.reports);

  const filteredPerCluster = fetched.map((res) =>
    filterArticles(res.articles, settings.search_window_hours),
  );
  const clusterCounts: Record<string, number> = {};
  cfg.clusters.forEach((c, i) => {
    clusterCounts[c.id] = filteredPerCluster[i].length;
  });

  let runs: ClusterRunOutput[];
  let mode: "live" | "mock" = "mock";
  let companyArticles: Article[] = [];

  if (hasKey) {
    mode = "live";
    runs = await Promise.all(
      cfg.clusters.map(async (c, i) => {
        const candidates = filteredPerCluster[i].slice(0, settings.results_per_cluster);
        const selected = await triageCluster(c.id, candidates, 3);
        return { id: c.id, name: c.name, articles: selected };
      }),
    );
    const all = runs.flatMap((r) => r.articles);
    companyArticles = findCompanyArticles(all, terms);
  } else {
    runs = cfg.clusters.map((c, i) => ({
      id: c.id,
      name: c.name,
      articles: filteredPerCluster[i].slice(0, 3),
    }));
    const all = runs.flatMap((r) => r.articles);
    companyArticles = findCompanyArticles(all, terms);
  }

  let markdown: string;
  let sanitizeReport: { replaced: Record<string, number>; violations: string[] } | undefined;

  if (mode === "live") {
    const raw = await summarizeBrief(runs, companyArticles);
    const { text, report } = sanitize(raw, cfg.forbidden_patterns?.banned_words ?? ["추천"]);
    markdown = text;
    sanitizeReport = report;
  } else {
    const raw = mockBrief(runs, allReports);
    const { text, report } = sanitize(raw, cfg.forbidden_patterns?.banned_words ?? ["추천"]);
    markdown = text;
    sanitizeReport = report;
  }

  const record: BriefRecord = {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    dateKst: nowKstDate(),
    markdown,
    meta: {
      mode,
      feedReports: allReports,
      clusterCounts,
      sanitizeReport,
    },
  };
  return record;
}
