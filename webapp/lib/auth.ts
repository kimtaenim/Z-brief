import { Redis } from "@upstash/redis";
import { cookies } from "next/headers";

const COOKIE_NAME = "zbrief_auth";
const COOKIE_TTL = 60 * 60 * 24;
const DAY_SECONDS = 60 * 60 * 24;

let redis: Redis | null = null;

const G = globalThis as unknown as {
  __zbriefMemCounter?: Map<string, { count: number; resetAt: number }>;
};
const memCounter: Map<string, { count: number; resetAt: number }> =
  G.__zbriefMemCounter ?? (G.__zbriefMemCounter = new Map());

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

export function getAuthPassword(): string | null {
  const pw = process.env.AUTH_PASSWORD?.trim();
  return pw && pw.length > 0 ? pw : null;
}

export function dailyLimit(): number {
  const raw = process.env.DAILY_LIMIT;
  const n = raw ? Number.parseInt(raw, 10) : 10;
  return Number.isFinite(n) && n > 0 ? n : 10;
}

export async function isAuthed(): Promise<boolean> {
  const required = getAuthPassword();
  if (!required) return true;
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  return !!token && token === simpleToken(required);
}

export async function setAuthCookie(): Promise<void> {
  const required = getAuthPassword();
  if (!required) return;
  const store = await cookies();
  store.set(COOKIE_NAME, simpleToken(required), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_TTL,
    path: "/",
  });
}

function simpleToken(pw: string): string {
  let hash = 5381;
  for (let i = 0; i < pw.length; i++) hash = ((hash << 5) + hash + pw.charCodeAt(i)) | 0;
  return `t${(hash >>> 0).toString(36)}`;
}

export async function checkAndIncrementQuota(ip: string): Promise<{ ok: boolean; remaining: number; limit: number }> {
  const limit = dailyLimit();
  const r = getRedis();
  const dayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const key = `zbrief:quota:${dayKey}:${ip}`;

  if (r) {
    const count = (await r.incr(key)) as number;
    if (count === 1) await r.expire(key, DAY_SECONDS);
    const remaining = Math.max(0, limit - count);
    return { ok: count <= limit, remaining, limit };
  }

  const now = Date.now();
  const slot = memCounter.get(key);
  if (!slot || slot.resetAt < now) {
    memCounter.set(key, { count: 1, resetAt: now + DAY_SECONDS * 1000 });
    return { ok: true, remaining: limit - 1, limit };
  }
  slot.count += 1;
  return { ok: slot.count <= limit, remaining: Math.max(0, limit - slot.count), limit };
}
