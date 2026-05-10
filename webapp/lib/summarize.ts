import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, MODELS } from "./anthropic";
import { withRetry } from "./retry";
import {
  companyTerms,
  fillTemplate,
  loadDirectCompanies,
  loadSystemPrompts,
  loadThresholds,
} from "./loaders";
import type { ModelUsage } from "./cost";
import type { BrokerReport } from "./broker_research";
import type { Article, ClusterRunOutput, SectionId } from "./types";
import { SECTION_LABEL } from "./types";

function nowKstDate(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

function nowKstDateTime(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

function articlesBlock(name: string, articles: Article[], cap: number): string {
  if (articles.length === 0) return `## ${name}\n- (오늘 수집된 기사 없음)`;
  const lines = [`## ${name}`];
  for (const a of articles) {
    lines.push(`- (${a.language}) ${a.title} | ${a.source} | ${a.url}`);
    if (a.summary) lines.push(`  요약: ${a.summary.slice(0, cap)}`);
  }
  return lines.join("\n");
}

function brokerReportsBlock(reports: BrokerReport[]): string {
  if (reports.length === 0) return "";
  const top = reports.slice(0, 30);
  const lines = ["## (참고) 오늘의 증권사 리서치 제목"];
  for (const r of top) {
    const date = r.date ? `[${r.date}]` : "";
    const cat = r.category ? `${r.category}` : "";
    lines.push(`- ${date} ${cat} ${r.broker}: ${r.title} | ${r.url}`.replace(/\s+/g, " ").trim());
  }
  return lines.join("\n");
}

export function buildSummarizeSystem(): string {
  const direct = loadDirectCompanies();
  const prompts = loadSystemPrompts();
  return fillTemplate(prompts.summarize, {
    PRIMARY_COMPANY: direct.primary,
    COMPANY_TERMS: companyTerms(direct).join("·"),
  });
}

export interface SummarizeOptions {
  selectedSections: SectionId[];
  userInterest?: string | null;
  anomaliesText?: string;
}

export interface SummarizeResult {
  markdown: string;
  usage: ModelUsage;
}

export async function summarizeBrief(
  clusters: ClusterRunOutput[],
  companyArticles: Article[],
  brokerReports: BrokerReport[],
  opts: SummarizeOptions,
): Promise<SummarizeResult> {
  const client = getAnthropic();
  if (!client) throw new Error("ANTHROPIC_API_KEY not set");

  const direct = loadDirectCompanies();
  const t = loadThresholds();
  const dateTimeKst = nowKstDateTime();

  const requestedNames = opts.selectedSections.map((s) => SECTION_LABEL[s]);
  const blocks: string[] = [
    `오늘 KST 일시: ${dateTimeKst}`,
    "",
    `요청된 섹션 (이 섹션만 작성, 다른 섹션 작성 금지): ${requestedNames.join(", ")}`,
    "",
  ];

  if (opts.userInterest && opts.userInterest.trim().length > 0) {
    blocks.push("## 오늘의 사용자 관심 주제 (있다면 우선순위 가중)");
    blocks.push(opts.userInterest.trim());
    blocks.push("");
  }

  if (opts.anomaliesText && opts.anomaliesText.trim().length > 0) {
    blocks.push("## 오늘의 특이사항 (자동 감지)");
    blocks.push(opts.anomaliesText.trim());
    blocks.push("");
  }

  const broker = brokerReportsBlock(brokerReports);
  if (broker) {
    blocks.push(broker);
    blocks.push("");
  }

  blocks.push(`## (참고) ${direct.primary} 직접 연관 후보`);
  if (companyArticles.length > 0) {
    for (const a of companyArticles) blocks.push(`- ${a.title} | ${a.source} | ${a.url}`);
  } else {
    blocks.push("- (해당 기사 없음)");
  }
  blocks.push("");

  for (const c of clusters) {
    blocks.push(articlesBlock(c.name, c.articles, t.summarize.article_summary_chars));
    blocks.push("");
  }

  // WHY withRetry + delayMs 1000:
  // summarize는 파이프라인의 마지막 단계이자 가장 비싼 호출(Sonnet)이다.
  // 이 단계에서 실패하면 앞선 triage 5회 호출 비용이 전부 낭비된다.
  // triage(500ms)보다 긴 1000ms delay를 주는 것은 Sonnet의 처리 시간이 더 길어
  // 서버 측 과부하에서 회복하는 데 더 많은 시간이 필요하기 때문이다.
  const resp = await withRetry(() => client.messages.create({
    model: MODELS.summarize,
    max_tokens: t.summarize.max_tokens,
    system: [
      {
        type: "text",
        text: buildSummarizeSystem(),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: blocks.join("\n") }],
  }), { delayMs: 1000 });

  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  return {
    markdown: text,
    usage: {
      model: MODELS.summarize,
      input_tokens: resp.usage.input_tokens,
      output_tokens: resp.usage.output_tokens,
      cache_creation_input_tokens: resp.usage.cache_creation_input_tokens ?? undefined,
      cache_read_input_tokens: resp.usage.cache_read_input_tokens ?? undefined,
    },
  };
}

export { nowKstDate, nowKstDateTime };
