import { anomaliesToText, type Anomaly } from "./anomaly";
import type { BrokerReport } from "./broker_research";
import {
  fillTemplate,
  loadDirectCompanies,
  loadMockData,
  loadWatchlist,
  watchlistFlat,
} from "./loaders";
import { nowKstDateTime } from "./summarize";
import type { Article, ClusterRunOutput, FetchReport, SectionId } from "./types";
import { SECTION_LABEL, SECTION_ORDER } from "./types";

interface MockOptions {
  selectedSections: SectionId[];
  userInterest: string | null;
}

function clusterMock(name: string, articles: Article[], userInterest: string | null): string {
  const top = articles.slice(0, 2);
  const focus = userInterest
    ? `사용자 관심 주제 "${userInterest}"를 반영해 ${name}의 흐름을 살펴봅니다. `
    : "";
  if (top.length === 0) {
    return `${focus}오늘 ${name} 클러스터에서 RSS 신규 기사가 수집되지 않았습니다. 보강 출처(web_search) 추가가 필요합니다.`;
  }
  const titles = top.map((a) => a.title).join(" / ");
  return `${focus}${name} 클러스터에서 ${articles.length}건이 후보로 잡혔으며, 대표 기사는 "${titles}" 입니다. mock 모드라 실제 LLM 요약은 생략됩니다.`;
}

export function mockBrokerReports(): BrokerReport[] {
  const md = loadMockData();
  const today = nowKstDateTime().slice(0, 10);
  return md.broker_reports_sample.map((r) => ({
    broker: r.broker,
    source_id: md.broker_default_source_id,
    title: r.title,
    url: fillTemplate(md.broker_url_template, { REPORT_IDX: r.report_idx }),
    date: today,
    category: r.category,
  }));
}

export function mockAnomalies(): Anomaly[] {
  const watch = loadWatchlist();
  const flat = watchlistFlat(watch);
  const direct = loadDirectCompanies();
  const md = loadMockData();
  const idx = Math.min(md.anomaly_sample.new_appearance_company_index, flat.length - 1);
  const target = flat[idx];
  const out: Anomaly[] = [];
  if (target) {
    out.push({
      type: "new_appearance",
      scope: "company",
      group: target.group,
      target: target.name,
      today: 2,
      prev_avg: 0,
      ratio: null,
    });
  }
  out.push({
    type: "spike",
    scope: "keyword",
    target: md.anomaly_sample.spike_keyword,
    today: md.anomaly_sample.spike_today,
    prev_avg: md.anomaly_sample.spike_prev_avg,
    ratio: md.anomaly_sample.spike_ratio,
  });
  out.push({
    type: "direct_mention",
    scope: "company",
    target: direct.primary,
    today: 1,
    prev_avg: 0.14,
    ratio: null,
  });
  return out;
}

export function mockBrief(
  clusters: ClusterRunOutput[],
  companyArticles: Article[],
  reports: FetchReport[],
  anomalies: Anomaly[],
  brokerReports: BrokerReport[],
  opts: MockOptions,
): string {
  const direct = loadDirectCompanies();
  const dt = nowKstDateTime();
  const out: string[] = [`# ${direct.primary} IR Brief - ${dt} (KST)`, ""];
  const selected = new Set(opts.selectedSections);

  if (selected.has("overview")) {
    out.push("## 종합");
    out.push(`### 오늘의 ${direct.primary}`);
    if (companyArticles.length > 0) {
      for (const a of companyArticles.slice(0, 3)) out.push(`- ${a.title} (${a.source})`);
    } else {
      out.push("특이 동향 없음 (mock).");
    }
    out.push("");

    const anomalyText = anomaliesToText(anomalies);
    if (anomalyText) {
      out.push("### 오늘의 특이사항");
      out.push(anomalyText);
      out.push("");
    }

    if (brokerReports.length > 0) {
      out.push("### 오늘의 증권사 모닝브리프");
      for (const r of brokerReports.slice(0, 5)) {
        out.push(`- ${r.broker}: ${r.title}`);
      }
      out.push("");
    }

    out.push("### 오늘의 핵심 기사");
    const all = clusters.flatMap((c) => c.articles).slice(0, 2);
    if (all.length > 0) {
      for (const a of all) out.push(`- ${a.source}: ${a.url}`);
    } else {
      out.push("- (수집된 기사 없음)");
    }
    out.push("");

    out.push("### 총평");
    const okFeeds = reports.filter((r) => r.ok).length;
    const totalFeeds = reports.length;
    const interestNote = opts.userInterest
      ? ` 관심 주제 "${opts.userInterest}" 반영 시 다음 단계 분석에서 가중됩니다.`
      : "";
    out.push(
      `RSS 피드 ${okFeeds}/${totalFeeds}개 정상 수신.${interestNote} ANTHROPIC_API_KEY 설정 시 Haiku/Sonnet 호출이 적용됩니다.`,
    );
    out.push("");
  }

  for (const id of SECTION_ORDER) {
    if (id === "overview") continue;
    if (!selected.has(id)) continue;
    const cluster = clusters.find((c) => c.id === id);
    out.push(`## ${SECTION_LABEL[id]}`);
    out.push(clusterMock(SECTION_LABEL[id], cluster?.articles ?? [], opts.userInterest));
    out.push("");
  }

  return out.join("\n");
}
