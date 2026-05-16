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

// WHY URL ID 치환: Google News URL이 ~80 tokens. cluster마다 출처 1줄 박으면
// output 토큰이 호출당 수백 tokens 추가됨. LLM에는 짧은 ID(artN)만 보여주고
// 서버 후처리에서 ID → 실제 URL 치환. output 토큰 절감 + input 토큰도 줄음.
function articlesBlock(name: string, articles: Article[], cap: number, idFn: (url: string) => string): string {
  if (articles.length === 0) return `## ${name}\n- (오늘 수집된 기사 없음)`;
  const lines = [`## ${name}`];
  for (const a of articles) {
    const id = idFn(a.url);
    lines.push(`- [${id}] (${a.language}) ${a.title} | ${a.source}`);
    if (a.summary) lines.push(`  요약: ${a.summary.slice(0, cap)}`);
  }
  return lines.join("\n");
}

function brokerReportsBlock(reports: BrokerReport[], idFn: (url: string) => string): string {
  if (reports.length === 0) return "";
  const top = reports.slice(0, 10);
  const lines = ["## (참고) 오늘의 증권사 리서치 제목"];
  for (const r of top) {
    const id = idFn(r.url);
    const date = r.date ? `[${r.date}]` : "";
    const cat = r.category ? `${r.category}` : "";
    lines.push(`- [${id}] ${date} ${cat} ${r.broker}: ${r.title}`.replace(/\s+/g, " ").trim());
  }
  return lines.join("\n");
}

// WHY sanitizeLinkText: 기사 제목에 "[주간 IPO]" 같은 nested 대괄호가 들어가면
// markdown 링크 파서가 깨져 raw URL이 그대로 화면 노출됨.
// expandUrls 직전에 (artN) 패턴 직전 link text 안의 [/]를 「/」로 swap해
// markdown 링크 구조를 보존한다. LLM이 입력 article title을 그대로 복사할 때
// 발생하는 회귀를 코드 단에서 막는 fallback.
function sanitizeLinkText(md: string): string {
  const re = /\(art\d+\)/g;
  let result = "";
  let lastEnd = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    const parenStart = m.index;
    if (md[parenStart - 1] !== "]") continue;
    const bracketEnd = parenStart - 1;
    let depth = 0;
    let bracketStart = -1;
    for (let j = bracketEnd - 1; j >= lastEnd; j--) {
      const ch = md[j];
      if (ch === "]") depth++;
      else if (ch === "[") {
        if (depth === 0) {
          bracketStart = j;
          break;
        }
        depth--;
      }
    }
    if (bracketStart < 0) continue;
    result += md.slice(lastEnd, bracketStart + 1);
    const linkText = md.slice(bracketStart + 1, bracketEnd);
    result += linkText.replace(/\[/g, "「").replace(/\]/g, "」");
    result += md.slice(bracketEnd, m.index + m[0].length);
    lastEnd = m.index + m[0].length;
  }
  result += md.slice(lastEnd);
  return result;
}

function expandUrls(markdown: string, urlMap: Map<string, string>): string {
  return markdown.replace(/\(art(\d+)\)/g, (m, n: string) => {
    const url = urlMap.get(`art${n}`);
    return url ? `(${url})` : m;
  });
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
  anchorDate?: string | null;
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
  const dateLine = opts.anchorDate
    ? `조회 날짜 (KST): ${opts.anchorDate} (그날 00:00~24:00 보도 기준, 생성 시각 ${dateTimeKst})`
    : `오늘 KST 일시: ${dateTimeKst} (직전 24시간 롤링)`;
  const blocks: string[] = [
    dateLine,
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

  const urlMap = new Map<string, string>();
  let counter = 0;
  const idFn = (url: string): string => {
    const id = `art${++counter}`;
    urlMap.set(id, url);
    return id;
  };

  const broker = brokerReportsBlock(brokerReports, idFn);
  if (broker) {
    blocks.push(broker);
    blocks.push("");
  }

  blocks.push(`## (참고) ${direct.primary} 직접 연관 후보`);
  if (companyArticles.length > 0) {
    for (const a of companyArticles) {
      const id = idFn(a.url);
      blocks.push(`- [${id}] ${a.title} | ${a.source}`);
    }
  } else {
    blocks.push("- (해당 기사 없음)");
  }
  blocks.push("");

  for (const c of clusters) {
    blocks.push(articlesBlock(c.name, c.articles, t.summarize.article_summary_chars, idFn));
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

  const rawText = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const text = expandUrls(sanitizeLinkText(rawText), urlMap);

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
