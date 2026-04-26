"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { recordCumulativeCost } from "@/components/CostFooter";
import type { CostSummary } from "@/lib/cost";
import type { SectionId } from "@/lib/types";

interface Props {
  sections: SectionId[];
  userInterest: string;
  disabled?: boolean;
  onCreated?: () => void;
}

interface GenerateResponse {
  id: string;
  mode: "live" | "mock";
  cost: CostSummary;
  remaining?: number;
  limit?: number;
}

export function GenerateButton({ sections, userInterest, disabled, onCreated }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = async () => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sections,
          userInterest: userInterest.trim() || undefined,
        }),
      });
      if (res.status === 401) {
        setError("로그인이 필요합니다. 페이지를 새로고침 해주세요.");
        return;
      }
      if (res.status === 429) {
        setError("오늘 호출 한도를 초과했습니다.");
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { detail?: string };
        setError(`생성 실패: ${data.detail ?? res.statusText}`);
        return;
      }
      const data = (await res.json()) as GenerateResponse;
      if (data.cost?.total_krw) recordCumulativeCost(data.cost.total_krw);
      onCreated?.();
      router.push(`/result/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setPending(false);
    }
  };

  return (
    <div>
      <Button
        type="button"
        size="lg"
        onClick={handle}
        disabled={disabled || pending || sections.length === 0}
        className="w-full"
      >
        {pending ? <Spinner /> : <SparkIcon />}
        <span>
          {pending
            ? "생성 중… 1~2분 걸립니다"
            : sections.length === 0
            ? "섹션을 1개 이상 선택하세요"
            : `지금 생성 (${sections.length}개 섹션)`}
        </span>
      </Button>
      {error && (
        <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-[13px] text-red-700 ring-1 ring-red-100">
          {error}
        </p>
      )}
    </div>
  );
}

function SparkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}
