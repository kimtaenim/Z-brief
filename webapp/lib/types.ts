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
  | "pr_ir"
  | "server_it_infra"
  | "energy_ai"
  | "medical_ai"
  | "physical_ai"
  | "security_pqc"
  | "knowledge_onto"
  | "deep_learning_mlops";

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
  "pr_ir",
  "server_it_infra",
  "energy_ai",
  "medical_ai",
  "physical_ai",
  "security_pqc",
  "knowledge_onto",
  "deep_learning_mlops",
];

export const SECTION_LABEL: Record<SectionId, string> = {
  overview: "종합",
  pr_ir: "회사 PR과 IR",
  server_it_infra: "서버와 IT 인프라",
  energy_ai: "에너지AI",
  medical_ai: "의료AI",
  physical_ai: "피지컬AI와 로봇",
  security_pqc: "보안과 PQC",
  knowledge_onto: "지식과 온톨로지",
  deep_learning_mlops: "딥러닝과 MLOps",
};

export const SECTION_DESCRIPTION: Record<SectionId, string> = {
  overview: "회사 직접 동향 + 특이사항 + 증권사 모닝브리프 + 핵심 기사 + 총평",
  pr_ir: "정원엔시스·자회사·기술특례·IPO·코스닥 AI",
  server_it_infra: "서버·온프레미스·IT/AI 인프라·MSP 시장",
  energy_ai: "EMS·BEMS·FEMS·DCIM, 데이터센터 에너지",
  medical_ai: "의료영상·진단·신약개발·임상·헬스케어 AI",
  physical_ai: "휴머노이드·자율주행·산업·협동 로봇",
  security_pqc: "사이버 보안·AI 보안·PQC·NIST 표준",
  knowledge_onto: "지식 그래프·온톨로지·시맨틱 검색·Palantir",
  deep_learning_mlops: "딥러닝 모델·MLOps·AI 인프라 학습/배포/운영",
};
