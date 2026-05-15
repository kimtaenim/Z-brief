import type { Anomaly } from "./anomaly";
import type { BrokerFetchReport, BrokerReport } from "./broker_research";
import type { CostSummary, ModelUsage } from "./cost";

export interface Article {
  cluster_id: string;
  title: string;
  url: string;
  source: string;
  author: string | null;
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

export type SectionId =
  | "overview"
  | "onprem_ai"
  | "physical_ai"
  | "vertical_ai"
  | "security_pqc"
  | "valuation";

export interface SectionContent {
  id: SectionId;
  name: string;
  markdown: string;
  selected: boolean;
}

export interface BriefRecord {
  id: string;
  createdAt: string;
  dateKst: string;
  timeKst: string;
  sections: SectionContent[];
  fullMarkdown: string;
  meta: {
    mode: "live" | "mock";
    feedReports: FetchReport[];
    brokerReports: BrokerFetchReport[];
    brokerItems: BrokerReport[];
    anomalies: Anomaly[];
    clusterCounts: Record<string, number>;
    sanitizeReport?: { replaced: Record<string, number>; violations: string[] };
    selectedSections: SectionId[];
    userInterest: string | null;
    anchorDate: string | null;
    usages: ModelUsage[];
    cost: CostSummary;
  };
}

export interface RecentSummary {
  id: string;
  createdAt: string;
  dateKst: string;
  preview: string;
  mode: "live" | "mock";
  costKrw: number;
}

export interface GenerateRequest {
  sections: SectionId[];
  userInterest?: string;
  anchorDate?: string; // YYYY-MM-DD (KST). 미지정 시 24h 롤링.
}

export const SECTION_ORDER: SectionId[] = [
  "overview",
  "onprem_ai",
  "physical_ai",
  "vertical_ai",
  "security_pqc",
  "valuation",
];

export const SECTION_LABEL: Record<SectionId, string> = {
  overview: "종합",
  onprem_ai: "온프레미스AI",
  physical_ai: "피지컬AI",
  vertical_ai: "버티컬AI",
  security_pqc: "보안과PQC",
  valuation: "밸류에이션",
};

export const SECTION_DESCRIPTION: Record<SectionId, string> = {
  overview: "회사 직접 동향 + 특이사항 + 증권사 모닝브리프 + 핵심 기사 + 총평",
  onprem_ai: "프라이빗 LLM, AI 어플라이언스, 소버린 AI",
  physical_ai: "로봇, 스마트팩토리, 비전 AI",
  vertical_ai: "의료·법률·언론·교육 등 도메인 LLM",
  security_pqc: "사이버 보안, AI 보안, 양자내성암호",
  valuation: "AI 인프라 멀티플, MSP·IDC, M&A·IPO",
};
