"use client";

import { useEffect, useState } from "react";

function formatKst(d: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

export function KstClock() {
  const [now, setNow] = useState<string>("");

  useEffect(() => {
    setNow(formatKst(new Date()));
    const id = setInterval(() => setNow(formatKst(new Date())), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!now) return <span className="text-zinc-300">--:--</span>;
  return <span>{now} (KST)</span>;
}
