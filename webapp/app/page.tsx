"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CostFooter } from "@/components/CostFooter";
import { GenerateButton } from "@/components/GenerateButton";
import { KstClock } from "@/components/KstClock";
import { PasswordGate } from "@/components/PasswordGate";
import { RecentList } from "@/components/RecentList";
import { SectionPicker } from "@/components/SectionPicker";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import direct from "@/data/direct_companies.json";
import { SECTION_ORDER, type RecentSummary, type SectionId } from "@/lib/types";

interface AuthState {
  loading: boolean;
  required: boolean;
  authed: boolean;
}

const DRAFT_KEY = "zbrief:draft";

export default function HomePage() {
  const [auth, setAuth] = useState<AuthState>({ loading: true, required: false, authed: false });
  const [recent, setRecent] = useState<RecentSummary[]>([]);
  const [selected, setSelected] = useState<Set<SectionId>>(() => new Set(SECTION_ORDER));
  const [interest, setInterest] = useState("");
  const [hydrated, setHydrated] = useState(false);

  const refreshAuth = useCallback(async () => {
    const res = await fetch("/api/login", { cache: "no-store" });
    const data = (await res.json()) as { required: boolean; authed: boolean };
    setAuth({ loading: false, required: data.required, authed: data.authed });
  }, []);

  const refreshRecent = useCallback(async () => {
    const res = await fetch("/api/recent", { cache: "no-store" });
    const data = (await res.json()) as { items: RecentSummary[]; authed: boolean };
    setRecent(data.items ?? []);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { sections?: SectionId[]; interest?: string };
        if (Array.isArray(parsed.sections) && parsed.sections.length > 0) {
          setSelected(new Set(parsed.sections));
        }
        if (typeof parsed.interest === "string") setInterest(parsed.interest);
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ sections: Array.from(selected), interest }),
    );
  }, [hydrated, selected, interest]);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  useEffect(() => {
    if (auth.authed) refreshRecent();
  }, [auth.authed, refreshRecent]);

  const showGate = !auth.loading && auth.required && !auth.authed;

  const sectionsArr = useMemo(
    () => SECTION_ORDER.filter((s) => selected.has(s)),
    [selected],
  );

  const toggle = (id: SectionId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-zinc-200/70 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3 sm:px-6">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-400">
              {direct.market} {direct.ticker}
            </p>
            <h1 className="text-[15px] font-semibold tracking-tight text-zinc-900">
              {direct.primary} IR Brief
            </h1>
          </div>
          <div className="text-right text-[11px] tabular-nums text-zinc-500">
            <KstClock />
          </div>
        </div>
      </header>

      <main className="mx-auto min-h-dvh max-w-2xl px-5 pb-32 pt-6 sm:px-6 sm:pt-10">
        <p className="mb-7 text-[13px] leading-relaxed text-zinc-500 sm:text-[14px]">
          5개 클러스터 + 종합. 48시간 내 보도를 모아 Haiku 1차 추리고 Sonnet으로 마무리합니다.
        </p>

        <section className="mb-6">
          <Card padding="md">
            <SectionPicker
              selected={selected}
              onToggle={toggle}
              onAll={() => setSelected(new Set(SECTION_ORDER))}
              onNone={() => setSelected(new Set())}
            />
          </Card>
        </section>

        <section className="mb-6">
          <Card padding="md">
            <label htmlFor="interest" className="mb-3 block text-[12px] font-medium uppercase tracking-wider text-zinc-500">
              오늘의 관심 주제 (선택)
            </label>
            <Textarea
              id="interest"
              rows={3}
              value={interest}
              onChange={(e) => setInterest(e.target.value)}
              placeholder="예: 오늘은 비교종목 IPO·M&A 또는 PQC 표준화 동향 좀 더 깊게"
            />
            <p className="mt-2 text-[11px] text-zinc-400">
              입력하면 Sonnet 프롬프트에 가중치로 추가됩니다. 비우면 무시.
            </p>
          </Card>
        </section>

        <section className="mb-10">
          <GenerateButton
            sections={sectionsArr}
            userInterest={interest}
            onCreated={refreshRecent}
          />
          <p className="mt-3 text-center text-[11px] text-zinc-400">
            1회 약 ₩70~210 (선택 섹션 수에 비례). 환율 1 USD = ₩1,400 고정.
          </p>
        </section>

        <section>
          <div className="mb-3 flex items-baseline justify-between px-1">
            <h2 className="text-[12px] font-medium uppercase tracking-wider text-zinc-500">
              최근 결과
            </h2>
            <Link
              href="/library"
              className="text-[12px] text-blue-600 hover:underline"
            >
              전체 보기
            </Link>
          </div>
          <RecentList items={recent} onDelete={async (id) => {
            const before = recent;
            setRecent((prev) => prev.filter((x) => x.id !== id));
            const res = await fetch(`/api/brief/${id}`, { method: "DELETE" });
            if (!res.ok) setRecent(before);
          }} />
        </section>

        {showGate && <PasswordGate onSuccess={refreshAuth} />}
      </main>

      <CostFooter />
    </>
  );
}
