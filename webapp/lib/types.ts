export interface Article {
  cluster_id: string;
  title: string;
  url: string;
  source: string;
  published: string | null;
  summary: string;
  language: "ko" | "en";
}

export interface FetchReport {
  cluster_id: string;
  feed: string;
  ok: boolean;
  count: number;
  error: string | null;
}

export interface ClusterFetchResult {
  cluster_id: string;
  articles: Article[];
  reports: FetchReport[];
}

export interface ClusterConfig {
  id: string;
  name: string;
  keywords_ko?: string[];
  keywords_en?: string[];
  sources?: string[];
  rss_feeds?: string[];
  focus?: string;
  peers_kr?: string[];
  peers_global?: string[];
}

export interface GlobalConfig {
  search_window_hours: number;
  results_per_cluster: number;
  llm_triage: string;
  llm_final: string;
  cache_ttl_minutes: number;
  default_language: string;
  english_handling: string;
  company: { name: string; related: string[] };
}

export interface ClustersFile {
  global: GlobalConfig;
  clusters: ClusterConfig[];
  forbidden_patterns?: {
    banned_words?: string[];
    replacements?: Record<string, string>;
  };
}

export interface ClusterRunOutput {
  id: string;
  name: string;
  articles: Article[];
}

export interface BriefRecord {
  id: string;
  createdAt: string;
  dateKst: string;
  markdown: string;
  meta: {
    mode: "live" | "mock";
    feedReports: FetchReport[];
    clusterCounts: Record<string, number>;
    sanitizeReport?: { replaced: Record<string, number>; violations: string[] };
  };
}

export interface RecentSummary {
  id: string;
  createdAt: string;
  dateKst: string;
  preview: string;
  mode: "live" | "mock";
}
