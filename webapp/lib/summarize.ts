import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, MODELS } from "./anthropic";
import type { ModelUsage } from "./cost";
import type { Article, ClusterRunOutput, SectionId } from "./types";
import { SECTION_LABEL } from "./types";

const FINAL_SYSTEM = `당신은 정원엔시스 IR Brief 최종 작성자입니다.

출력 형식 (엄격히 준수):
- 가장 위에 제목 한 줄 "# 정원엔시스 IR Brief - YYYY-MM-DD HH:MM (KST)" — 가로줄 금지.
- 그 다음에 사용자가 요청한 섹션을 정확히 같은 헤딩으로 작성:
  ## 종합  (요청된 경우에만)
    그 안에 ### 오늘의 정원엔시스 / ### 오늘의 핵심 기사 / ### 총평 세 소제목.
    오늘의 정원엔시스: 정원엔시스·에이아이네이션·바스코ICT·젠시스·AX707 직접 연관 기업 동향 (없으면 "특이 동향 없음").
    오늘의 핵심 기사: 가장 중요한 2건, "매체명: URL" 형식.
    총평: 1~2문장.
  ## 온프레미스AI / ## 피지컬AI / ## 버티컬AI / ## 보안과PQC / ## 밸류에이션
    각 2~3문장. 사실 + 시사점.
- 요청되지 않은 섹션은 절대 작성하지 마십시오.

문체 규칙:
- 존댓말 또는 명사 종결만 사용.
- "추천" 단어 금지.
- 출처는 매체명만 노출 (기자명 X).
- 영문 용어는 한국어 + 괄호로 영문 병기.
- 절대 금지: 줄표(—), 물결(~), 자기과시 문장, 이모지, 가로줄(---/===/***).

출력은 마크다운 텍스트만. 어떤 추가 설명도 붙이지 마십시오.`;

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

function articlesBlock(name: string, articles: Article[]): string {
  if (articles.length === 0) return `## ${name}\n- (오늘 수집된 기사 없음)`;
  const lines = [`## ${name}`];
  for (const a of articles) {
    lines.push(`- (${a.language}) ${a.title} | ${a.source} | ${a.url}`);
    if (a.summary) lines.push(`  요약: ${a.summary.slice(0, 200)}`);
  }
  return lines.join("\n");
}

export interface SummarizeOptions {
  selectedSections: SectionId[];
  userInterest?: string | null;
}

export interface SummarizeResult {
  markdown: string;
  usage: ModelUsage;
}

export async function summarizeBrief(
  clusters: ClusterRunOutput[],
  companyArticles: Article[],
  opts: SummarizeOptions,
): Promise<SummarizeResult> {
  const client = getAnthropic();
  if (!client) throw new Error("ANTHROPIC_API_KEY not set");

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

  blocks.push("## (참고) 정원엔시스 직접 연관 후보");
  if (companyArticles.length > 0) {
    for (const a of companyArticles) blocks.push(`- ${a.title} | ${a.source} | ${a.url}`);
  } else {
    blocks.push("- (해당 기사 없음)");
  }
  blocks.push("");

  for (const c of clusters) {
    blocks.push(articlesBlock(c.name, c.articles));
    blocks.push("");
  }

  const resp = await client.messages.create({
    model: MODELS.summarize,
    max_tokens: 1800,
    system: [
      {
        type: "text",
        text: FINAL_SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: blocks.join("\n") }],
  });

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
