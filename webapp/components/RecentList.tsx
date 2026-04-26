"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { formatKrw } from "@/lib/cost";
import type { RecentSummary } from "@/lib/types";

interface Props {
  items: RecentSummary[];
}

export function RecentList({ items }: Props) {
  if (items.length === 0) {
    return (
      <p className="mt-2 px-1 text-[12px] text-zinc-400">
        아직 생성된 브리프가 없습니다.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li key={it.id}>
          <Link href={`/result/${it.id}`} className="block">
            <Card padding="sm" className="transition hover:ring-zinc-300">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[14px] font-medium text-zinc-900">
                  {it.dateKst}
                </p>
                <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                  {it.mode === "mock" ? (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-500">
                      mock
                    </span>
                  ) : (
                    <span className="text-blue-600">{formatKrw(it.costKrw)}</span>
                  )}
                </div>
              </div>
              <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-zinc-500">
                {it.preview}
              </p>
              <p className="mt-2 text-[11px] text-zinc-400">
                {new Date(it.createdAt).toLocaleString("ko-KR", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
