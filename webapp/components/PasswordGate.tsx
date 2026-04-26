"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface Props {
  onSuccess: () => void;
}

export function PasswordGate({ onSuccess }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (data.ok) onSuccess();
      else if (data.error === "wrong_password") setError("비밀번호가 다릅니다.");
      else setError("로그인 실패. 잠시 뒤 다시 시도하세요.");
    } catch {
      setError("네트워크 오류");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-900/40 backdrop-blur-sm sm:items-center">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-t-3xl bg-white p-6 shadow-card sm:rounded-3xl"
      >
        <div className="mb-1 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-blue-50 text-blue-600">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          </span>
          <h2 className="text-[17px] font-semibold tracking-tight text-zinc-900">
            비밀번호 입력
          </h2>
        </div>
        <p className="mb-5 text-[13px] leading-relaxed text-zinc-500">
          정원엔시스 IR Brief 접근에는 비밀번호가 필요합니다.
        </p>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          placeholder="비밀번호"
          className="mb-3"
        />
        {error && <p className="mb-3 text-[13px] text-red-600">{error}</p>}
        <Button
          type="submit"
          disabled={pending || password.length === 0}
          className="w-full"
          size="md"
        >
          {pending ? "확인 중…" : "들어가기"}
        </Button>
      </form>
    </div>
  );
}
