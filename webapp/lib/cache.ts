import { Redis } from "@upstash/redis";
import type { BriefRecord, RecentSummary } from "./types";

const TTL_SECONDS = 60 * 60 * 24 * 7;

let redis: Redis | null = null;

const G = globalThis as unknown as {
  __zbriefMemBriefs?: Map<string, BriefRecord>;
  __zbriefMemOrder?: string[];
};
const memBriefs: Map<string, BriefRecord> =
  G.__zbriefMemBriefs ?? (G.__zbriefMemBriefs = new Map());
const memOrder: string[] =
  G.__zbriefMemOrder ?? (G.__zbriefMemOrder = []);

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

const briefKey = (id: string) => `zbrief:brief:${id}`;
const recentKey = "zbrief:recent";

function toSummary(record: BriefRecord): RecentSummary {
  const overview = record.sections.find((s) => s.id === "overview" && s.markdown);
  const fallback = record.sections.find((s) => s.markdown);
  const preview = (overview?.markdown ?? fallback?.markdown ?? record.fullMarkdown ?? "")
    .replace(/^#.*$/gm, "")
    .replace(/\n+/g, " ")
    .trim()
    .slice(0, 180);
  return {
    id: record.id,
    createdAt: record.createdAt,
    dateKst: record.dateKst,
    preview,
    mode: record.meta.mode,
    costKrw: record.meta.cost.total_krw,
  };
}

const MAX_HISTORY = 50;

export async function saveBrief(record: BriefRecord): Promise<void> {
  const r = getRedis();
  const summary = toSummary(record);
  if (r) {
    await r.set(briefKey(record.id), JSON.stringify(record), { ex: TTL_SECONDS });
    await r.lpush(recentKey, JSON.stringify(summary));
    await r.ltrim(recentKey, 0, MAX_HISTORY - 1);
  } else {
    memBriefs.set(record.id, record);
    memOrder.unshift(record.id);
    while (memOrder.length > MAX_HISTORY) memOrder.pop();
  }
}

export async function deleteBrief(id: string): Promise<boolean> {
  const r = getRedis();
  if (r) {
    const exists = await r.exists(briefKey(id));
    if (!exists) return false;

    // WHY multi(): 기존 구현은 del(briefKey) → del(recentKey) → rpush를 순차 실행했다.
    // del(briefKey) 성공 후 나머지가 실패하면 brief는 없는데 목록에는 남는 "좀비 항목"이
    // 생긴다. multi()로 쓰기 연산을 하나의 트랜잭션으로 묶어 원자성을 보장한다.
    // 읽기(lrange)는 트랜잭션 밖에서 수행한다 — Redis multi()는 read-modify-write
    // 패턴을 지원하지 않으므로, 읽기 후 쓰기의 원자성만 보장하는 최선의 접근이다.
    const list = (await r.lrange(recentKey, 0, MAX_HISTORY - 1)) as Array<string | RecentSummary>;
    const kept = list
      .map((v) => (typeof v === "string" ? (JSON.parse(v) as RecentSummary) : v))
      .filter((s) => s.id !== id);

    const pipe = r.multi();
    pipe.del(briefKey(id));
    pipe.del(recentKey);
    if (kept.length > 0) {
      pipe.rpush(recentKey, ...kept.map((s) => JSON.stringify(s)));
    }
    await pipe.exec();
    return true;
  }
  if (!memBriefs.has(id)) return false;
  memBriefs.delete(id);
  const idx = memOrder.indexOf(id);
  if (idx >= 0) memOrder.splice(idx, 1);
  return true;
}

export async function loadBrief(id: string): Promise<BriefRecord | null> {
  const r = getRedis();
  if (r) {
    const raw = await r.get<string | BriefRecord>(briefKey(id));
    if (!raw) return null;
    return typeof raw === "string" ? (JSON.parse(raw) as BriefRecord) : raw;
  }
  return memBriefs.get(id) ?? null;
}

export async function listRecent(limit = 5): Promise<RecentSummary[]> {
  const r = getRedis();
  if (r) {
    const items = (await r.lrange(recentKey, 0, limit - 1)) as Array<string | RecentSummary>;
    return items.map((v) => (typeof v === "string" ? (JSON.parse(v) as RecentSummary) : v));
  }
  return memOrder.slice(0, limit).map((id) => toSummary(memBriefs.get(id)!));
}

export async function listAll(): Promise<RecentSummary[]> {
  return listRecent(MAX_HISTORY);
}
