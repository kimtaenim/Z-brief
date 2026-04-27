import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const DATA_DIR = path.resolve(process.cwd(), "data");

function readJson(name: string): unknown {
  const p = path.join(DATA_DIR, name);
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

const BrokerSelectorsSchema = z.object({
  item: z.string(),
  date: z.string().optional().default(""),
  category: z.string().optional().default(""),
  title: z.string(),
  url: z.string(),
  broker: z.string().optional().default(""),
});

const BrokerSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  list_urls: z.array(z.string()).default([]),
  method: z.enum(["html", "json"]).default("html"),
  encoding: z.enum(["utf-8", "euc-kr"]).default("utf-8"),
  user_agent: z.string().optional(),
  request_headers: z.record(z.string()).optional(),
  selectors: BrokerSelectorsSchema,
  url_prefix: z.string().optional().default(""),
  max_items_per_url: z.number().int().positive().default(20),
  max_items_total: z.number().int().positive().default(50),
  date_format: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

const BrokersSchema = z.array(BrokerSchema);

const WatchlistSchema = z.object({
  valuation_peers: z.record(z.array(z.string())),
  notes: z.string().optional(),
});

const DirectCompaniesSchema = z.object({
  primary: z.string(),
  ticker: z.string().optional(),
  market: z.string().optional(),
  subsidiaries_and_brands: z.array(z.string()),
  notes: z.string().optional(),
});

const ThresholdsSchema = z.object({
  anomaly: z.object({
    spike_ratio: z.number().positive(),
    spike_min_today_company: z.number().int().positive(),
    spike_min_today_keyword: z.number().int().positive(),
    comparison_window_days: z.number().int().positive(),
    new_appearance_min: z.number().int().positive(),
  }),
  fetch: z.object({
    results_per_cluster: z.number().int().positive(),
    search_window_hours: z.number().int().positive(),
    broker_timeout_ms: z.number().int().positive(),
    rss_timeout_ms: z.number().int().positive(),
  }),
  summarize: z.object({
    max_tokens: z.number().int().positive(),
    article_summary_chars: z.number().int().positive(),
  }),
  triage: z.object({
    max_tokens: z.number().int().positive(),
    target_keep: z.number().int().positive(),
  }),
  notes: z.string().optional(),
});

const SystemPromptsSchema = z.object({
  triage: z.string(),
  summarize: z.string(),
  notes: z.string().optional(),
});

const MockDataSchema = z.object({
  broker_reports_sample: z.array(
    z.object({
      broker: z.string(),
      title: z.string(),
      category: z.string(),
      report_idx: z.string(),
    }),
  ),
  broker_url_template: z.string(),
  broker_default_source_id: z.string(),
  anomaly_sample: z.object({
    new_appearance_company_index: z.number().int().nonnegative(),
    spike_keyword: z.string(),
    spike_today: z.number().int().positive(),
    spike_prev_avg: z.number().nonnegative(),
    spike_ratio: z.number().positive(),
  }),
  notes: z.string().optional(),
});

export type Broker = z.infer<typeof BrokerSchema>;
export type Watchlist = z.infer<typeof WatchlistSchema>;
export type DirectCompanies = z.infer<typeof DirectCompaniesSchema>;
export type Thresholds = z.infer<typeof ThresholdsSchema>;
export type SystemPrompts = z.infer<typeof SystemPromptsSchema>;
export type MockData = z.infer<typeof MockDataSchema>;

interface DataCache {
  brokers?: Broker[];
  watchlist?: Watchlist;
  directCompanies?: DirectCompanies;
  thresholds?: Thresholds;
  systemPrompts?: SystemPrompts;
  mockData?: MockData;
}

const G = globalThis as unknown as { __zbriefData?: DataCache };
if (!G.__zbriefData) G.__zbriefData = {};
const cache = G.__zbriefData;

function loadAndValidate<S extends z.ZodTypeAny>(file: string, schema: S): z.output<S> {
  const raw = readJson(file);
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `[Z-brief] ${file} 검증 실패:\n${JSON.stringify(result.error.issues, null, 2)}`,
    );
  }
  return result.data;
}

export function loadBrokers(): Broker[] {
  if (!cache.brokers) cache.brokers = loadAndValidate("brokers.json", BrokersSchema);
  return cache.brokers;
}

export function loadWatchlist(): Watchlist {
  if (!cache.watchlist) cache.watchlist = loadAndValidate("watchlist.json", WatchlistSchema);
  return cache.watchlist;
}

export function loadDirectCompanies(): DirectCompanies {
  if (!cache.directCompanies) {
    cache.directCompanies = loadAndValidate("direct_companies.json", DirectCompaniesSchema);
  }
  return cache.directCompanies;
}

export function loadThresholds(): Thresholds {
  if (!cache.thresholds) cache.thresholds = loadAndValidate("thresholds.json", ThresholdsSchema);
  return cache.thresholds;
}

export function loadSystemPrompts(): SystemPrompts {
  if (!cache.systemPrompts) {
    cache.systemPrompts = loadAndValidate("system_prompts.json", SystemPromptsSchema);
  }
  return cache.systemPrompts;
}

export function loadMockData(): MockData {
  if (!cache.mockData) cache.mockData = loadAndValidate("mock_data.json", MockDataSchema);
  return cache.mockData;
}

export function watchlistFlat(w: Watchlist): { name: string; group: string }[] {
  const out: { name: string; group: string }[] = [];
  for (const [group, names] of Object.entries(w.valuation_peers)) {
    for (const name of names) out.push({ name, group });
  }
  return out;
}

export function companyTerms(d: DirectCompanies): string[] {
  return [d.primary, ...(d.subsidiaries_and_brands ?? [])];
}

export function fillTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}
