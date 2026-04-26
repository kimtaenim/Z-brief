"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { use } from "react";
import { BriefMarkdown } from "@/components/BriefMarkdown";
import type { BriefRecord } from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ResultPage({ params }: PageProps) {
  const { id } = use(params);
  const [record, setRecord] = useState<BriefRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  const copy = async () => {
    if (!record) return;
    await navigator.clipboard.writeText(record.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <main className="mx-auto max-w-2xl px-5 pt-8 pb-24 sm:px-6 sm:pt-12">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="rounded-full bg-white px-3 py-1.5 text-[13px] text-text-secondary ring-1 ring-border-soft transition hover:text-text"
        >
          ← 처음으로
        </Link>
        {record && (
          <button
            type="button"
            onClick={copy}
            className="rounded-full bg-white px-3 py-1.5 text-[13px] text-text-secondary ring-1 ring-border-soft transition hover:text-text"
          >
            {copied ? "복사됨" : "마크다운 복사"}
          </button>
        )}
      </div>

      {error && (
        <p className="rounded-2xl bg-white p-5 text-[14px] text-danger ring-1 ring-border-soft">
          {error}
        </p>
      )}

      {!record && !error && (
        <p className="text-center text-[13px] text-text-tertiary">불러오는 중…</p>
      )}

      {record && (
        <article className="rounded-3xl bg-white p-6 shadow-card ring-1 ring-border-soft sm:p-8">
          {record.meta.mode === "mock" && (
            <p className="mb-4 inline-block rounded-full bg-surface-2 px-3 py-1 text-[11px] text-text-tertiary">
              mock 모드 — ANTHROPIC_API_KEY 미설정 상태
            </p>
          )}
          <BriefMarkdown markdown={record.markdown} />
          {record.meta.feedReports.some((r) => !r.ok) && (
            <details className="mt-8 rounded-2xl bg-surface-2 p-4 text-[12px] text-text-secondary">
              <summary className="cursor-pointer font-medium text-text">
                깨진 RSS 피드 ({record.meta.feedReports.filter((r) => !r.ok).length}건)
              </summary>
              <ul className="mt-3 space-y-1.5">
                {record.meta.feedReports
                  .filter((r) => !r.ok)
                  .map((r) => (
                    <li key={r.feed} className="break-all">
                      <span className="text-text-tertiary">{r.cluster_id}:</span> {r.feed}
                      <br />
                      <span className="text-danger">{r.error}</span>
                    </li>
                  ))}
              </ul>
            </details>
          )}
        </article>
      )}
    </main>
  );
}
