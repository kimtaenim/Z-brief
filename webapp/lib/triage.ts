import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, MODELS } from "./anthropic";
import type { Article } from "./types";

const TRIAGE_SYSTEM = `당신은 한국 IR 브리핑용 1차 추리기입니다.
입력으로 한 클러스터의 후보 기사 목록을 받습니다.
조건:
- 정원엔시스(에이아이네이션·바스코ICT·젠시스·AX707) 또는 한국 AI 인프라 의사결정자에게 의미있는 2-3건만 고릅니다.
- 단순 광고·중복 보도·이미 알려진 일반 동향은 제외.
- 영문 기사는 한국어 한 문장 요약 + 핵심 영문 용어를 괄호로 병기.
출력은 반드시 JSON 배열만, 각 원소는 {"index": int, "reason": str} 형식.`;

function articlesToPrompt(articles: Article[]): string {
  return articles
    .map((a, i) => `[${i}] (${a.language}) ${a.title} | ${a.source} | ${a.url}`)
    .join("\n");
}

function parsePicks(text: string, target: number, maxIdx: number): { index: number; reason: string }[] {
  const trimmed = text.trim();
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start === -1 || end === -1) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const seen = new Set<number>();
  const out: { index: number; reason: string }[] = [];
  for (const item of arr) {
    if (typeof item !== "object" || item === null) continue;
    const idx = (item as { index?: unknown }).index;
    if (typeof idx !== "number" || idx < 0 || idx >= maxIdx || seen.has(idx)) continue;
    const reason = String((item as { reason?: unknown }).reason ?? "");
    out.push({ index: idx, reason });
    seen.add(idx);
    if (out.length >= target) break;
  }
  return out;
}

export async function triageCluster(
  clusterId: string,
  articles: Article[],
  target = 3,
): Promise<Article[]> {
  if (articles.length === 0) return [];
  const client = getAnthropic();
  if (!client) throw new Error("ANTHROPIC_API_KEY not set");

  const userPrompt = `클러스터: ${clusterId}\n목표 기사 수: 최대 ${target}\n\n후보:\n${articlesToPrompt(articles)}`;

  const resp = await client.messages.create({
    model: MODELS.triage,
    max_tokens: 512,
    system: TRIAGE_SYSTEM,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const picks = parsePicks(text, target, articles.length);
  return picks.map((p) => articles[p.index]).filter(Boolean);
}
