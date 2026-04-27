import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import iconv from "iconv-lite";
import { loadBrokers, loadThresholds, type Broker } from "./loaders";

export interface BrokerReport {
  broker: string;
  source_id: string;
  title: string;
  url: string;
  date: string | null;
  category: string | null;
}

export interface BrokerFetchReport {
  broker_id: string;
  broker_name: string;
  ok: boolean;
  count: number;
  error: string | null;
}

export interface BrokerCrawlResult {
  reports: BrokerReport[];
  fetch_reports: BrokerFetchReport[];
}

function parseSelector(spec: string): { sel: string; attr: string | null } {
  const at = spec.lastIndexOf("@");
  if (at === -1) return { sel: spec, attr: null };
  return { sel: spec.slice(0, at), attr: spec.slice(at + 1) };
}

function extract(
  $: cheerio.CheerioAPI,
  el: cheerio.Cheerio<AnyNode>,
  spec: string,
): string {
  if (!spec) return "";
  const { sel, attr } = parseSelector(spec);
  const target = sel ? el.find(sel).first() : el;
  if (!target.length) return "";
  if (attr) return (target.attr(attr) ?? "").trim();
  return target.text().trim().replace(/\s+/g, " ");
}

function absolutize(url: string, prefix: string): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (!prefix) return url;
  if (url.startsWith("/")) return prefix.replace(/\/$/, "") + url;
  return prefix.replace(/\/$/, "") + "/" + url;
}

async function fetchHtml(
  url: string,
  broker: Broker,
  timeoutMs: number,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": broker.user_agent ?? "Z-brief/0.1",
        ...(broker.request_headers ?? {}),
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (broker.encoding === "euc-kr") {
      const buf = Buffer.from(await res.arrayBuffer());
      return iconv.decode(buf, "euc-kr");
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function crawlOne(
  broker: Broker,
  timeoutMs: number,
): Promise<{ reports: BrokerReport[]; report: BrokerFetchReport }> {
  if (!broker.enabled || broker.list_urls.length === 0) {
    return {
      reports: [],
      report: {
        broker_id: broker.id,
        broker_name: broker.name,
        ok: false,
        count: 0,
        error: "disabled",
      },
    };
  }

  const all: BrokerReport[] = [];
  let lastErr: string | null = null;

  for (const url of broker.list_urls) {
    try {
      const html = await fetchHtml(url, broker, timeoutMs);
      const $ = cheerio.load(html);
      const items = $(broker.selectors.item);
      let count = 0;
      items.each((_, raw) => {
        if (count >= broker.max_items_per_url) return false;
        const el = $(raw);
        const title = extract($, el, broker.selectors.title);
        const link = absolutize(extract($, el, broker.selectors.url), broker.url_prefix);
        if (!title || !link) return;
        const date = extract($, el, broker.selectors.date) || null;
        const category = extract($, el, broker.selectors.category) || null;
        const brokerName = extract($, el, broker.selectors.broker) || broker.name;
        all.push({
          broker: brokerName,
          source_id: broker.id,
          title,
          url: link,
          date,
          category,
        });
        count += 1;
      });
    } catch (err) {
      lastErr = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    }
  }

  const dedup = dedupReports(all).slice(0, broker.max_items_total);
  return {
    reports: dedup,
    report: {
      broker_id: broker.id,
      broker_name: broker.name,
      ok: dedup.length > 0,
      count: dedup.length,
      error: dedup.length === 0 ? lastErr ?? "no_items" : null,
    },
  };
}

function dedupReports(reports: BrokerReport[]): BrokerReport[] {
  const seen = new Set<string>();
  const out: BrokerReport[] = [];
  for (const r of reports) {
    const key = r.url || `${r.broker}:${r.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

export async function crawlAllBrokers(): Promise<BrokerCrawlResult> {
  const brokers = loadBrokers();
  const { fetch: fetchCfg } = loadThresholds();
  const enabled = brokers.filter((b) => b.enabled);

  const results = await Promise.all(
    enabled.map((b) => crawlOne(b, fetchCfg.broker_timeout_ms)),
  );

  const reports = results.flatMap((r) => r.reports);
  const fetch_reports: BrokerFetchReport[] = brokers.map((b) => {
    const found = results.find((r) => r.report.broker_id === b.id);
    return (
      found?.report ?? {
        broker_id: b.id,
        broker_name: b.name,
        ok: false,
        count: 0,
        error: "disabled",
      }
    );
  });

  return { reports, fetch_reports };
}
