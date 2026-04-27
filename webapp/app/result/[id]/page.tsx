"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { CostCard } from "@/components/CostCard";
import { CostFooter } from "@/components/CostFooter";
import { SectionCard } from "@/components/SectionCard";
import { Card } from "@/components/ui/Card";
import direct from "@/data/direct_companies.json";
import type { BriefRecord } from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ResultPage({ params }: PageProps) {
  const { id } = use(params);
  const [record, setRecord] = useState<BriefRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await fetch(`/api/brief/${id}`, { cache: "no-store" });
      if (!active) return;
      if (res.status === 401) {
        setError("로그인이 필요합니다.");
        return;
      }
      if (!res.ok) {
        setError("브리프를 불러오지 못했습니다.");
        return;
      }
      const data = (await res.json()) as BriefRecord;
      setRecord(data);
    })();
    return () => {
      active = false;
    };
  }, [id]);

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
          <div className="text-right text-[11px] tabular-nums text-zinc-500">
            {record ? `${record.timeKst} (KST)` : ""}
          </div>
        </div>
      </header>

      <main className="mx-auto min-h-dvh max-w-2xl px-5 pb-32 pt-6 sm:px-6 sm:pt-10">
        {error && (
          <Card padding="md" className="text-[14px] text-red-600">
            {error}
          </Card>
        )}

        {!record && !error && (
          <p className="mt-10 text-center text-[13px] text-zinc-400">불러오는 중…</p>
        )}

        {record && (
          <>
            <div className="mb-6">
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-400">
                {direct.primary} · {direct.market} {direct.ticker}
              </p>
              <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-zinc-900 sm:text-[26px]">
                IR Brief — {record.dateKst}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-zinc-500">
                <span>생성: {record.timeKst} (KST)</span>
                {record.meta.mode === "mock" && (
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500">
                    mock
                  </span>
                )}
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-600">
                  {record.meta.selectedSections.length}개 섹션
                </span>
              </div>
              {record.meta.userInterest && (
                <p className="mt-3 rounded-2xl bg-blue-50 px-4 py-3 text-[12px] leading-relaxed text-blue-900">
                  <span className="font-medium">관심 주제:</span> {record.meta.userInterest}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <CopyButton text={record.fullMarkdown} label="전체 마크다운 복사" size="md" />
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-blue-600 px-4 py-2 text-[13px] font-medium text-white transition active:scale-[0.97]"
                >
                  다시 생성
                </Link>
              </div>
            </div>

            <div className="mb-6">
              <CostCard cost={record.meta.cost} mode={record.meta.mode} />
            </div>

            <div className="space-y-4">
              {record.sections.map((s) => (
                <SectionCard key={s.id} section={s} />
              ))}
            </div>

            {record.meta.feedReports.some((r) => !r.ok) && (
              <details className="mt-6 rounded-2xl bg-white p-4 text-[12px] text-zinc-600 ring-1 ring-zinc-200">
                <summary className="cursor-pointer font-medium text-zinc-800">
                  깨진 RSS 피드 ({record.meta.feedReports.filter((r) => !r.ok).length}건)
                </summary>
                <ul className="mt-3 space-y-1.5">
                  {record.meta.feedReports
                    .filter((r) => !r.ok)
                    .map((r) => (
                      <li key={r.feed} className="break-all">
                        <span className="text-zinc-400">{r.cluster_id}:</span> {r.feed}
                        <br />
                        <span className="text-red-600">{r.error}</span>
                      </li>
                    ))}
                </ul>
              </details>
            )}
          </>
        )}
      </main>

      <CostFooter />
    </>
  );
}
