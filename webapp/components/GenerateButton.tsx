"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  onCreated?: () => void;
}

export function GenerateButton({ onCreated }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = async () => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", { method: "POST" });
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
      const data = (await res.json()) as { id: string };
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
      <button
        type="button"
        onClick={handle}
        disabled={pending}
        className="group flex w-full items-center justify-center gap-3 rounded-3xl bg-mint-deep px-6 py-5 text-[16px] font-medium text-white shadow-card transition duration-200 ease-apple hover:bg-mint-bright active:scale-[0.99] disabled:opacity-60 sm:py-6 sm:text-[17px]"
      >
        {pending ? <Spinner /> : <SparkIcon />}
        <span>{pending ? "생성 중… 1~2분 걸립니다" : "지금 생성"}</span>
      </button>
      {error && (
        <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-[13px] text-danger ring-1 ring-border-soft">
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
