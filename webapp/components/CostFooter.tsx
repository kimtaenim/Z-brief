"use client";

import { useEffect, useState } from "react";
import { formatKrw } from "@/lib/cost";

const KEY = "zbrief:cumulative-krw";

export function recordCumulativeCost(krw: number) {
  if (typeof window === "undefined") return;
  const prev = Number.parseFloat(window.localStorage.getItem(KEY) ?? "0");
  const next = (Number.isFinite(prev) ? prev : 0) + krw;
  window.localStorage.setItem(KEY, String(next));
  window.dispatchEvent(new CustomEvent("zbrief-cost-updated"));
}

export function CostFooter() {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const read = () => {
      const v = Number.parseFloat(window.localStorage.getItem(KEY) ?? "0");
      setTotal(Number.isFinite(v) ? v : 0);
    };
    read();
    window.addEventListener("zbrief-cost-updated", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("zbrief-cost-updated", read);
      window.removeEventListener("storage", read);
    };
  }, []);

  if (total <= 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-30 flex justify-center px-4">
      <div className="pointer-events-auto rounded-full bg-zinc-900/85 px-4 py-1.5 text-[12px] text-white shadow-lg backdrop-blur">
        누적 비용 {formatKrw(total)}
      </div>
    </div>
  );
}
