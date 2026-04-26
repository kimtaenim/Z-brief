import { v4 as uuidv4 } from "uuid";
import { loadClusters } from "./clusters";
import { summarizeCost, type ModelUsage } from "./cost";
import { fetchCluster } from "./fetch";
import { filterArticles } from "./filter";
import { mockBrief } from "./mock";
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
  const settings = cfg.global;
  const company = settings.company;
  const terms = [company.name, ...(company.related ?? [])].filter(Boolean);
  const hasKey = !!process.env.ANTHROPIC_API_KEY;

  const selected = normalizeSections(req.sections);
  const userInterest = (req.userInterest ?? "").trim() || null;

  const overviewSelected = selected.includes("overview");
  const clusterIdsNeeded = new Set<string>();
  if (overviewSelected) {
    for (const c of cfg.clusters) clusterIdsNeeded.add(c.id);
  }
  for (const s of selected) {
    const cid = CLUSTER_OF_SECTION[s];
    if (cid) clusterIdsNeeded.add(cid);
  }

  const fetched = await Promise.all(
    cfg.clusters.map((c) =>
      clusterIdsNeeded.has(c.id)
        ? fetchCluster(c.id, c.rss_feeds ?? [])
        : Promise.resolve({ cluster_id: c.id, articles: [], reports: [] }),
    ),
  );
  const allReports: FetchReport[] = fetched.flatMap((f) => f.reports);

  const filteredPerCluster = fetched.map((res) =>
    filterArticles(res.articles, settings.search_window_hours),
  );
  const clusterCounts: Record<string, number> = {};
  cfg.clusters.forEach((c, i) => {
    clusterCounts[c.id] = filteredPerCluster[i].length;
  });

  const usages: ModelUsage[] = [];
  let runs: ClusterRunOutput[];
  let mode: "live" | "mock" = "mock";
  let companyArticles: Article[] = [];
  let fullMarkdown: string;
  let sanitizeReport: { replaced: Record<string, number>; violations: string[] } | undefined;

  if (hasKey) {
    mode = "live";
    runs = await Promise.all(
      cfg.clusters.map(async (c, i) => {
        if (!clusterIdsNeeded.has(c.id)) {
          return { id: c.id, name: c.name, articles: [] };
        }
        const candidates = filteredPerCluster[i].slice(0, settings.results_per_cluster);
        const result = await triageCluster(c.id, candidates, 3);
        usages.push(result.usage);
        return { id: c.id, name: c.name, articles: result.articles };
      }),
    );
    const all = runs.flatMap((r) => r.articles);
    companyArticles = findCompanyArticles(all, terms);

    const summary = await summarizeBrief(runs, companyArticles, {
      selectedSections: selected,
      userInterest,
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

    const raw = mockBrief(runs, companyArticles, allReports, {
      selectedSections: selected,
      userInterest,
    });
    usages.push(
      { model: "claude-haiku-4-5-20251001", input_tokens: 0, output_tokens: 0 },
      { model: "claude-sonnet-4-6", input_tokens: 0, output_tokens: 0 },
    );
    const cleaned = sanitize(raw, cfg.forbidden_patterns?.banned_words ?? ["추천"]);
    fullMarkdown = cleaned.text;
    sanitizeReport = cleaned.report;
  }

  const sections = splitSections(fullMarkdown, selected);
  const cost = summarizeCost(usages);

  return {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    dateKst: nowKstDate(),
    timeKst: nowKstDateTime(),
    sections,
    fullMarkdown,
    meta: {
      mode,
      feedReports: allReports,
      clusterCounts,
      sanitizeReport,
      selectedSections: selected,
      userInterest,
      usages,
      cost,
    },
  };
}
