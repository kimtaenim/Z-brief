"use client";

import Link from "next/link";
import type { RecentSummary } from "@/lib/types";

interface Props {
  items: RecentSummary[];
}

export function RecentList({ items }: Props) {
  if (items.length === 0) {
    return (
      <p className="mt-8 text-center text-[13px] text-text-tertiary">
        아직 생성된 브리프가 없습니다.
      </p>
    );
  }
  return (
    <ul className="mt-3 grid grid-cols-1 gap-2.5">
      {items.map((it) => (
        <li key={it.id}>
          <Link
            href={`/result/${it.id}`}
            className="group flex flex-col rounded-2xl border border-border-soft bg-white p-5 transition duration-200 ease-apple hover:border-border hover:shadow-card active:scale-[0.99]"
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[15px] font-medium leading-snug text-text">
                정원엔시스 IR Brief - {it.dateKst}
              </p>
              {it.mode === "mock" && (
                <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-text-tertiary">
                  mock
                </span>
              )}
            </div>
            <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-text-secondary">
              {it.preview}
            </p>
            <p className="mt-3 text-[11px] text-text-tertiary">
              {new Date(it.createdAt).toLocaleString("ko-KR", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
