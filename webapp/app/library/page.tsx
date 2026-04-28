"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RecentList } from "@/components/RecentList";
import direct from "@/data/direct_companies.json";
import type { RecentSummary } from "@/lib/types";

export default function LibraryPage() {
  const [items, setItems] = useState<RecentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/library", { cache: "no-store" });
      if (!res.ok) {
        setError("불러오지 못했습니다.");
        return;
      }
      const data = (await res.json()) as { items: RecentSummary[]; authed: boolean };
      if (!data.authed) {
        setError("로그인이 필요합니다.");
        return;
      }
      setItems(data.items ?? []);
    } catch {
      setError("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string) => {
    const before = items;
    setItems((prev) => prev.filter((x) => x.id !== id));
    try {
      const res = await fetch(`/api/brief/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setItems(before);
        setError(`삭제 실패 [${res.status}]`);
      }
    } catch {
      setItems(before);
      setError("삭제 실패: 네트워크 오류");
    }
  };

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-zinc-200/70 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-5 py-3 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] text-zinc-600 ring-1 ring-zinc-200 transition hover:text-zinc-900 hover:ring-zinc-300"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            처음으로
          </Link>
          <p className="text-[11px] text-zinc-500">
            {direct.primary} · 보관함
          </p>
        </div>
      </header>

      <main className="mx-auto min-h-dvh max-w-2xl px-5 pb-32 pt-6 sm:px-6 sm:pt-10">
        <div className="mb-6">
          <h1 className="text-[22px] font-semibold tracking-tight text-zinc-900 sm:text-[26px]">
            브리프 보관함
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">
            지금까지 생성한 브리프 (최대 50건). 휴지통 두 번 누르면 삭제됩니다. 삭제해도 특이사항 누적 카운터는 유지돼 anomaly 감지가 일관됩니다.
          </p>
        </div>

        {error && (
          <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-[13px] text-red-700 ring-1 ring-red-100">
            {error}
          </p>
        )}

        {loading ? (
          <p className="mt-6 text-center text-[13px] text-zinc-400">불러오는 중…</p>
        ) : (
          <RecentList items={items} onDelete={handleDelete} emptyMessage="보관된 브리프가 없습니다." />
        )}
      </main>
    </>
  );
}
