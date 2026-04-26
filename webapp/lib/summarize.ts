import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, MODELS } from "./anthropic";
import type { Article, ClusterRunOutput } from "./types";

const FINAL_SYSTEM = `당신은 정원엔시스 IR Brief 최종 작성자입니다.

출력 형식 (엄격히 준수):
- 제목: "정원엔시스 IR Brief - YYYY-MM-DD (KST)"
- 가로줄(---, ===, ***) 절대 사용 금지
- 상단 섹션: "오늘의 정원엔시스" — 정원엔시스·에이아이네이션·바스코ICT·젠시스·AX707 직접 연관 기업 동향 (없으면 "특이 동향 없음")
- 본문: 5개 클러스터 순서로 (온프레미스AI -> 피지컬AI -> 버티컬AI -> 보안과PQC -> 밸류에이션). 각 클러스터 2-3문장.
- 하단 "오늘의 핵심 기사": 가장 중요한 2건, "매체명: URL" 형식
- 총평: 1-2문장

문체 규칙:
- 존댓말 또는 명사 종결만 사용
- "추천" 단어 금지
- 출처는 매체명만 노출 (기자명 X)
- 영문 용어는 한국어 + 괄호로 영문 병기
- 절대 금지: 줄표(—), 물결(~), 자기과시 문장, 이모지, 가로줄

출력은 마크다운 텍스트만. 어떤 추가 설명도 붙이지 마십시오.`;

function nowKstDate(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

function articlesBlock(name: string, articles: Article[]): string {
  if (articles.length === 0) return `## ${name}\n- (오늘 수집된 기사 없음)`;
  const lines = [`## ${name}`];
  for (const a of articles) {
    lines.push(`- (${a.language}) ${a.title} | ${a.source} | ${a.url}`);
    if (a.summary) lines.push(`  요약: ${a.summary.slice(0, 300)}`);
  }
  return lines.join("\n");
}

export async function summarizeBrief(
  clusters: ClusterRunOutput[],
  companyArticles: Article[],
): Promise<string> {
  const client = getAnthropic();
  if (!client) throw new Error("ANTHROPIC_API_KEY not set");

  const dateKst = nowKstDate();
  const blocks: string[] = [`오늘 KST 날짜: ${dateKst}`, "", "## (참고) 정원엔시스 직접 연관 후보"];
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
    max_tokens: 2048,
    system: FINAL_SYSTEM,
    messages: [{ role: "user", content: blocks.join("\n") }],
  });

  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return text;
}

export { nowKstDate };
