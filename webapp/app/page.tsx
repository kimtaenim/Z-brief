"use client";

import { useCallback, useEffect, useState } from "react";
import { GenerateButton } from "@/components/GenerateButton";
import { PasswordGate } from "@/components/PasswordGate";
import { RecentList } from "@/components/RecentList";
import type { RecentSummary } from "@/lib/types";

interface AuthState {
  loading: boolean;
  required: boolean;
  authed: boolean;
}

export default function HomePage() {
  const [auth, setAuth] = useState<AuthState>({ loading: true, required: false, authed: false });
  const [recent, setRecent] = useState<RecentSummary[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);

  const refreshAuth = useCallback(async () => {
    const res = await fetch("/api/login", { cache: "no-store" });
    const data = (await res.json()) as { required: boolean; authed: boolean };
    setAuth({ loading: false, required: data.required, authed: data.authed });
  }, []);

  const refreshRecent = useCallback(async () => {
    setRecentLoading(true);
    try {
      const res = await fetch("/api/recent", { cache: "no-store" });
      const data = (await res.json()) as { items: RecentSummary[]; authed: boolean };
      setRecent(data.items ?? []);
    } finally {
      setRecentLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  useEffect(() => {
    if (auth.authed) refreshRecent();
  }, [auth.authed, refreshRecent]);

  const showGate = !auth.loading && auth.required && !auth.authed;

  return (
    <main className="mx-auto max-w-2xl px-5 pt-12 pb-24 sm:px-6 sm:pt-20">
      <header className="mb-10 sm:mb-14">
        <p className="text-[12px] font-medium uppercase tracking-wider text-text-tertiary">
          KOSDAQ 045510
        </p>
        <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-text sm:text-[36px]">
          정원엔시스 IR Brief
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-text-secondary sm:text-[15px]">
          5개 클러스터 (온프레미스AI / 피지컬AI / 버티컬AI / 보안과PQC / 밸류에이션)에서 48시간 내 보도를 모아 Claude로 요약합니다.
        </p>
      </header>

      <section className="mb-10">
        <GenerateButton onCreated={refreshRecent} />
        <p className="mt-3 text-center text-[12px] text-text-tertiary">
          Haiku로 1차 추리고 Sonnet으로 최종 작성. 1회 약 $0.05~0.15.
        </p>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between px-1">
          <h2 className="text-[13px] font-medium uppercase tracking-wider text-text-tertiary">
            최근 결과
          </h2>
          <span className="text-[12px] text-text-tertiary">
            {recentLoading ? "..." : `${recent.length}건`}
          </span>
        </div>
        <RecentList items={recent} />
      </section>

      {showGate && <PasswordGate onSuccess={refreshAuth} />}
    </main>
  );
}
