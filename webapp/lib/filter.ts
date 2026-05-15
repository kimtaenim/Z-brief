import { compareTwoStrings } from "string-similarity";
import type { Article } from "./types";

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

// KST 일자 (YYYY-MM-DD) → 그 날 00:00 KST의 UTC ms.
// KST = UTC+9 이므로 그 날 00:00 KST = 전날 15:00 UTC.
function kstDayStartMs(yyyyMmDd: string): number {
  const m = yyyyMmDd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error(`invalid date: ${yyyyMmDd}`);
  const [, y, mo, d] = m;
  // Date.UTC(Y, M-1, D, H, m, s) — Date.UTC는 month 0-indexed
  // KST 00:00 = UTC -9시간 (전날 15:00 UTC)
  return Date.UTC(Number(y), Number(mo) - 1, Number(d), -9, 0, 0);
}

export function withinWindow(articles: Article[], hours: number): Article[] {
  const cutoff = Date.now() - hours * 3600 * 1000;
  return articles.filter((a) => {
    const dt = parseDate(a.published);
    return dt === null || dt.getTime() >= cutoff;
  });
}

export function withinKstDay(articles: Article[], anchorDate: string): Article[] {
  const start = kstDayStartMs(anchorDate);
  const end = start + 24 * 3600 * 1000;
  return articles.filter((a) => {
    const dt = parseDate(a.published);
    if (dt === null) return true; // published 못 읽으면 keep (보수적)
    const t = dt.getTime();
    return t >= start && t < end;
  });
}

export function dedupByTitle(articles: Article[], threshold = 0.85): Article[] {
  const out: Article[] = [];
  for (const art of articles) {
    const title = art.title.trim();
    if (!title) continue;
    const dup = out.some((kept) => compareTwoStrings(title, kept.title) >= threshold);
    if (!dup) out.push(art);
  }
  return out;
}

export function filterArticles(articles: Article[], windowHours: number): Article[] {
  return dedupByTitle(withinWindow(articles, windowHours));
}

export function filterArticlesByDay(articles: Article[], anchorDate: string): Article[] {
  return dedupByTitle(withinKstDay(articles, anchorDate));
}
