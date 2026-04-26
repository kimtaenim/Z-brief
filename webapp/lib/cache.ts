import { Redis } from "@upstash/redis";
import type { BriefRecord, RecentSummary } from "./types";

const TTL_SECONDS = 60 * 60 * 24 * 7;

let redis: Redis | null = null;
const memBriefs = new Map<string, BriefRecord>();
const memOrder: string[] = [];

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

export async function saveBrief(record: BriefRecord): Promise<void> {
  const r = getRedis();
  const summary: RecentSummary = {
    id: record.id,
    createdAt: record.createdAt,
    dateKst: record.dateKst,
    preview: record.markdown.slice(0, 200).replace(/\n+/g, " "),
    mode: record.meta.mode,
  };
  if (r) {
    await r.set(briefKey(record.id), JSON.stringify(record), { ex: TTL_SECONDS });
    await r.lpush(recentKey, JSON.stringify(summary));
    await r.ltrim(recentKey, 0, 19);
  } else {
    memBriefs.set(record.id, record);
    memOrder.unshift(record.id);
    while (memOrder.length > 20) memOrder.pop();
  }
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
  return memOrder.slice(0, limit).map((id) => {
    const rec = memBriefs.get(id)!;
    return {
      id: rec.id,
      createdAt: rec.createdAt,
      dateKst: rec.dateKst,
      preview: rec.markdown.slice(0, 200).replace(/\n+/g, " "),
      mode: rec.meta.mode,
    };
  });
}
