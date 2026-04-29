import { Redis } from "@upstash/redis";
import { loadClusters } from "./clusters";
import {
  companyTerms,
  loadDirectCompanies,
  loadThresholds,
  loadWatchlist,
  watchlistFlat,
} from "./loaders";
import type { Article } from "./types";
import type { BrokerReport } from "./broker_research";

let redis: Redis | null = null;
const G = globalThis as unknown as {
  __zbriefAccum?: {
    days: Map<string, { companies: Map<string, number>; keywords: Map<string, number> }>;
  };
};
if (!G.__zbriefAccum) G.__zbriefAccum = { days: new Map() };
const memAccum = G.__zbriefAccum;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

const COMPANY_KEY = (c: string) => `zbrief:company:${c}`;
const KEYWORD_KEY = (k: string) => `zbrief:keyword:${k}`;
const ARTICLES_BY_DATE = (d: string) => `zbrief:articles:by_date:${d}`;

function dayKey(d: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
}

function shiftDay(yyyymmdd: string, deltaDays: number): string {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

interface MentionCounts {
  companies: Map<string, number>;
  keywords: Map<string, number>;
}

function countMentions(
  haystacks: string[],
  companies: string[],
  keywords: string[],
): MentionCounts {
  const cc = new Map<string, number>();
  const kc = new Map<string, number>();
  for (const text of haystacks) {
    if (!text) continue;
    const lower = text.toLowerCase();
    for (const c of companies) {
      if (text.includes(c) || (c.includes(" ") === false && lower.includes(c.toLowerCase()))) {
        cc.set(c, (cc.get(c) ?? 0) + 1);
      }
    }
    for (const k of keywords) {
      if (text.includes(k) || lower.includes(k.toLowerCase())) {
        kc.set(k, (kc.get(k) ?? 0) + 1);
      }
    }
  }
  return { companies: cc, keywords: kc };
}

export async function recordDailyMentions(
  articles: Article[],
  brokerReports: BrokerReport[],
): Promise<{ date: string; companies: Map<string, number>; keywords: Map<string, number> }> {
  const date = dayKey(new Date());
  const watch = loadWatchlist();
  const direct = loadDirectCompanies();
  const cfg = loadClusters();

  const companies = [
    direct.primary,
    ...direct.subsidiaries_and_brands,
    ...watchlistFlat(watch).map((w) => w.name),
  ];
  const keywords = cfg.clusters.flatMap((c) => [
    ...(c.keywords_ko ?? []),
    ...(c.keywords_en ?? []),
  ]);

  const haystacks: string[] = [
    ...articles.flatMap((a) => [a.title, a.summary]),
    ...brokerReports.map((r) => r.title),
  ];

  const counts = countMentions(haystacks, companies, keywords);

  const r = getRedis();
  if (r) {
    const pipe = r.multi();
    for (const [name, n] of counts.companies) {
      pipe.zincrby(COMPANY_KEY(name), n, date);
    }
    for (const [kw, n] of counts.keywords) {
      pipe.zincrby(KEYWORD_KEY(kw), n, date);
    }
    pipe.set(ARTICLES_BY_DATE(date), articles.length);
    await pipe.exec();
  } else {
    const slot = memAccum.days.get(date) ?? { companies: new Map(), keywords: new Map() };
    for (const [k, v] of counts.companies) slot.companies.set(k, (slot.companies.get(k) ?? 0) + v);
    for (const [k, v] of counts.keywords) slot.keywords.set(k, (slot.keywords.get(k) ?? 0) + v);
    memAccum.days.set(date, slot);
  }

  return { date, companies: counts.companies, keywords: counts.keywords };
}

async function readSeries(key: string, days: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const r = getRedis();
  if (r) {
    for (const d of days) {
      const score = await r.zscore(key, d);
      if (typeof score === "number") out.set(d, score);
    }
    return out;
  }
  for (const d of days) {
    const slot = memAccum.days.get(d);
    if (!slot) continue;
    if (key.startsWith("zbrief:company:")) {
      const name = key.slice("zbrief:company:".length);
      const v = slot.companies.get(name);
      if (v !== undefined) out.set(d, v);
    } else if (key.startsWith("zbrief:keyword:")) {
      const name = key.slice("zbrief:keyword:".length);
      const v = slot.keywords.get(name);
      if (v !== undefined) out.set(d, v);
    }
  }
  return out;
}

export type AnomalyType = "new_appearance" | "spike" | "direct_mention";

export interface Anomaly {
  type: AnomalyType;
  scope: "company" | "keyword";
  group?: string;
  target: string;
  today: number;
  prev_avg: number;
  ratio: number | null;
}

export async function detectAnomalies(
  todayCounts: { companies: Map<string, number>; keywords: Map<string, number> },
): Promise<Anomaly[]> {
  const t = loadThresholds().anomaly;
  const direct = loadDirectCompanies();
  const watch = loadWatchlist();

  const today = dayKey(new Date());
  const prevDays: string[] = [];
  for (let i = 1; i <= t.comparison_window_days; i++) prevDays.push(shiftDay(today, -i));

  const watchEntries = watchlistFlat(watch);
  const out: Anomaly[] = [];

  for (const we of watchEntries) {
    const todayN = todayCounts.companies.get(we.name) ?? 0;
    if (todayN < t.new_appearance_min && todayN < t.spike_min_today_company) continue;
    const series = await readSeries(COMPANY_KEY(we.name), prevDays);
    const prevTotal = Array.from(series.values()).reduce((s, v) => s + v, 0);
    const prevAvg = prevTotal / t.comparison_window_days;

    if (prevAvg === 0 && todayN >= t.new_appearance_min) {
      out.push({
        type: "new_appearance",
        scope: "company",
        group: we.group,
        target: we.name,
        today: todayN,
        prev_avg: 0,
        ratio: null,
      });
      continue;
    }
    if (todayN >= t.spike_min_today_company && prevAvg > 0 && todayN / prevAvg >= t.spike_ratio) {
      out.push({
        type: "spike",
        scope: "company",
        group: we.group,
        target: we.name,
        today: todayN,
        prev_avg: Number(prevAvg.toFixed(2)),
        ratio: Number((todayN / prevAvg).toFixed(2)),
      });
    }
  }

  for (const d of [direct.primary, ...direct.subsidiaries_and_brands]) {
    const todayN = todayCounts.companies.get(d) ?? 0;
    if (todayN <= 0) continue;
    const series = await readSeries(COMPANY_KEY(d), prevDays);
    const prevTotal = Array.from(series.values()).reduce((s, v) => s + v, 0);
    out.push({
      type: "direct_mention",
      scope: "company",
      target: d,
      today: todayN,
      prev_avg: Number((prevTotal / t.comparison_window_days).toFixed(2)),
      ratio: null,
    });
  }

  for (const [kw] of todayCounts.keywords) {
    const todayN = todayCounts.keywords.get(kw) ?? 0;
    if (todayN < t.spike_min_today_keyword && todayN < t.new_appearance_min) continue;
    const series = await readSeries(KEYWORD_KEY(kw), prevDays);
    const prevTotal = Array.from(series.values()).reduce((s, v) => s + v, 0);
    const prevAvg = prevTotal / t.comparison_window_days;

    if (prevAvg === 0 && todayN >= t.new_appearance_min) {
      out.push({
        type: "new_appearance",
        scope: "keyword",
        target: kw,
        today: todayN,
        prev_avg: 0,
        ratio: null,
      });
      continue;
    }
    if (todayN >= t.spike_min_today_keyword && prevAvg > 0 && todayN / prevAvg >= t.spike_ratio) {
      out.push({
        type: "spike",
        scope: "keyword",
        target: kw,
        today: todayN,
        prev_avg: Number(prevAvg.toFixed(2)),
        ratio: Number((todayN / prevAvg).toFixed(2)),
      });
    }
  }

  return out;
}

export function anomaliesToText(anomalies: Anomaly[]): string {
  if (anomalies.length === 0) return "";
  const lines = anomalies.slice(0, 8).map((a) => {
    if (a.type === "direct_mention") {
      return `- 직접 언급: ${a.target} 오늘 ${a.today}건 (직전 ${a.prev_avg}/일)`;
    }
    if (a.type === "new_appearance") {
      const tag = a.scope === "company" ? `${a.group ?? "비교종목"}` : "키워드";
      return `- 신규 등장 (${tag}): ${a.target} 오늘 ${a.today}건, 직전 7일 평균 0`;
    }
    const tag = a.scope === "company" ? `${a.group ?? "비교종목"}` : "키워드";
    return `- 급증 (${tag}): ${a.target} 오늘 ${a.today}건, 7일 평균 ${a.prev_avg}건 → ${a.ratio}배`;
  });
  return lines.join("\n");
}
