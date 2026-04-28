"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { formatKrw } from "@/lib/cost";
import type { RecentSummary } from "@/lib/types";

interface Props {
  items: RecentSummary[];
  onDelete?: (id: string) => Promise<void> | void;
  emptyMessage?: string;
}

export function RecentList({ items, onDelete, emptyMessage }: Props) {
  if (items.length === 0) {
    return (
      <p className="mt-2 px-1 text-[12px] text-zinc-400">
        {emptyMessage ?? "아직 생성된 브리프가 없습니다."}
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <RecentItem key={it.id} item={it} onDelete={onDelete} />
      ))}
    </ul>
  );
}

function RecentItem({
  item,
  onDelete,
}: {
  item: RecentSummary;
  onDelete?: (id: string) => Promise<void> | void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onDelete) return;
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
      return;
    }
    setDeleting(true);
    try {
      await onDelete(item.id);
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <li className="relative">
      <Link href={`/result/${item.id}`} className="block">
        <Card padding="sm" className="transition hover:ring-zinc-300">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[14px] font-medium text-zinc-900">
              {item.dateKst}
            </p>
            <div className="flex items-center gap-2 text-[11px] text-zinc-400">
              {item.mode === "mock" ? (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-500">
                  mock
                </span>
              ) : (
                <span className="text-blue-600">{formatKrw(item.costKrw)}</span>
              )}
            </div>
          </div>
          <p className="mt-1.5 line-clamp-2 pr-8 text-[12px] leading-relaxed text-zinc-500">
            {item.preview}
          </p>
          <p className="mt-2 text-[11px] text-zinc-400">
            {new Date(item.createdAt).toLocaleString("ko-KR", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </Card>
      </Link>
      {onDelete && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          aria-label={confirming ? "한 번 더 눌러 삭제" : "이 브리프 삭제"}
          className={`absolute right-3 top-3 inline-flex h-7 items-center gap-1 rounded-full px-2 text-[11px] font-medium transition active:scale-[0.96] disabled:opacity-50 ${
            confirming
              ? "bg-red-600 text-white shadow-soft"
              : "bg-zinc-50 text-zinc-400 ring-1 ring-zinc-200 hover:text-red-600 hover:ring-red-200"
          }`}
        >
          {deleting ? (
            <span>삭제 중…</span>
          ) : confirming ? (
            <>
              <TrashIcon />
              한 번 더
            </>
          ) : (
            <TrashIcon />
          )}
        </button>
      )}
    </li>
  );
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}
