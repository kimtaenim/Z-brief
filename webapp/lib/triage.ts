import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, MODELS } from "./anthropic";
import type { ModelUsage } from "./cost";
import { withRetry } from "./retry";
import {
  companyTerms,
  fillTemplate,
  loadDirectCompanies,
  loadSystemPrompts,
  loadThresholds,
} from "./loaders";
import type { Article } from "./types";

function buildTriageSystem(): string {
  const direct = loadDirectCompanies();
  const prompts = loadSystemPrompts();
  return fillTemplate(prompts.triage, {
    PRIMARY_COMPANY: direct.primary,
    COMPANY_TERMS: companyTerms(direct).join("·"),
  });
}

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

export interface TriageResult {
  articles: Article[];
  usage: ModelUsage;
}

export async function triageCluster(
  clusterId: string,
  articles: Article[],
  target?: number,
): Promise<TriageResult> {
  const t = loadThresholds().triage;
  const targetKeep = target ?? t.target_keep;

  if (articles.length === 0) {
    return {
      articles: [],
      usage: { model: MODELS.triage, input_tokens: 0, output_tokens: 0 },
    };
  }
  const client = getAnthropic();
  if (!client) throw new Error("ANTHROPIC_API_KEY not set");

  const userPrompt = `클러스터: ${clusterId}\n목표 기사 수: 최대 ${targetKeep}\n\n후보:\n${articlesToPrompt(articles)}`;

  // WHY withRetry: Anthropic API는 트래픽 급증 시 529를 반환한다.
  // 재시도 없으면 일시 오류가 전체 파이프라인 실패로 이어진다.
  // triage는 클러스터당 1회 호출이므로 5개 클러스터 중 1개만 실패해도 전체가 죽는다.
  const resp = await withRetry(() => client.messages.create({
    model: MODELS.triage,
    max_tokens: t.max_tokens,
    system: [
      {
        type: "text",
        text: buildTriageSystem(),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
  }));

  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const picks = parsePicks(text, targetKeep, articles.length);
  const selected = picks.map((p) => articles[p.index]).filter(Boolean);

  return {
    articles: selected,
    usage: {
      model: MODELS.triage,
      input_tokens: resp.usage.input_tokens,
      output_tokens: resp.usage.output_tokens,
      cache_creation_input_tokens: resp.usage.cache_creation_input_tokens ?? undefined,
      cache_read_input_tokens: resp.usage.cache_read_input_tokens ?? undefined,
    },
  };
}
