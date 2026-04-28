import Parser from "rss-parser";
import type { Article, ClusterFetchResult, FetchReport } from "./types";

const parser = new Parser({
  timeout: 10_000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
    Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
  },
});

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function guessLang(text: string): "ko" | "en" {
  if (!text) return "ko";
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (code !== undefined && code >= 0xac00 && code <= 0xd7a3) return "ko";
  }
  return "en";
}

async function fetchOne(
  cluster_id: string,
  feed: string,
): Promise<{ articles: Article[]; report: FetchReport }> {
  try {
    const parsed = await parser.parseURL(feed);
    const articles: Article[] = (parsed.items ?? []).map((item) => ({
      cluster_id,
      title: (item.title ?? "").trim(),
      url: (item.link ?? "").trim(),
      source: hostOf(item.link ?? "") || feed,
      published: item.isoDate ?? item.pubDate ?? null,
      summary: ((item.contentSnippet ?? item.content ?? item.summary ?? "") as string).trim(),
      language: guessLang(item.title ?? ""),
    }));
    return {
      articles,
      report: { cluster_id, feed, ok: true, count: articles.length, error: null },
    };
  } catch (err) {
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return {
      articles: [],
      report: { cluster_id, feed, ok: false, count: 0, error: message },
    };
  }
}

export async function fetchCluster(
  cluster_id: string,
  feeds: string[],
): Promise<ClusterFetchResult> {
  const results = await Promise.all(feeds.map((f) => fetchOne(cluster_id, f)));
  const articles = results.flatMap((r) => r.articles);
  const reports = results.map((r) => r.report);
  return { cluster_id, articles, reports };
}
