"use client";

import { useEffect, useState } from "react";
import { formatKrw } from "@/lib/cost";

const KEY = "zbrief:cumulative-krw";
const LAST_KEY = "zbrief:last-call-krw";
const LAST_AT_KEY = "zbrief:last-call-at";
const LAST_FLASH_MS = 12_000;

export function recordCumulativeCost(krw: number) {
  if (typeof window === "undefined") return;
  const prev = Number.parseFloat(window.localStorage.getItem(KEY) ?? "0");
  const next = (Number.isFinite(prev) ? prev : 0) + krw;
  window.localStorage.setItem(KEY, String(next));
  window.localStorage.setItem(LAST_KEY, String(krw));
  window.localStorage.setItem(LAST_AT_KEY, String(Date.now()));
  window.dispatchEvent(new CustomEvent("zbrief-cost-updated"));
}

export function CostFooter() {
  const [total, setTotal] = useState(0);
  const [last, setLast] = useState<{ krw: number; at: number } | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const read = () => {
      const v = Number.parseFloat(window.localStorage.getItem(KEY) ?? "0");
      setTotal(Number.isFinite(v) ? v : 0);
      const lk = Number.parseFloat(window.localStorage.getItem(LAST_KEY) ?? "");
      const la = Number.parseFloat(window.localStorage.getItem(LAST_AT_KEY) ?? "");
      if (Number.isFinite(lk) && Number.isFinite(la)) setLast({ krw: lk, at: la });
      else setLast(null);
    };
    read();
    window.addEventListener("zbrief-cost-updated", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("zbrief-cost-updated", read);
      window.removeEventListener("storage", read);
    };
  }, []);

  useEffect(() => {
    if (!last) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [last]);

  if (total <= 0) return null;
  const flashing = last && now - last.at < LAST_FLASH_MS;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-30 flex justify-center px-4">
      <div className="pointer-events-auto rounded-full bg-zinc-900/85 px-4 py-1.5 text-[12px] text-white shadow-lg backdrop-blur">
        {flashing && last && (
          <span className="mr-2 text-blue-300">+{formatKrw(last.krw)}</span>
        )}
        누적 비용 {formatKrw(total)}
      </div>
    </div>
  );
}
