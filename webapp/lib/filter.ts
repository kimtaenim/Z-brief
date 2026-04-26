import { compareTwoStrings } from "string-similarity";
import type { Article } from "./types";

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function withinWindow(articles: Article[], hours: number): Article[] {
  const cutoff = Date.now() - hours * 3600 * 1000;
  return articles.filter((a) => {
    const dt = parseDate(a.published);
    return dt === null || dt.getTime() >= cutoff;
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
