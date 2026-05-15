"use client";

import { Card } from "@/components/ui/Card";

interface Props {
  value: string;       // YYYY-MM-DD (KST)
  todayKst: string;    // YYYY-MM-DD (KST)
  onChange: (v: string) => void;
}

export function DatePicker({ value, todayKst, onChange }: Props) {
  const isToday = value === todayKst;
  return (
    <Card padding="md">
      <label htmlFor="anchor-date" className="mb-3 block text-[12px] font-medium uppercase tracking-wider text-zinc-500">
        조회 날짜 {isToday && <span className="ml-1 text-blue-600 normal-case tracking-normal">· 오늘 (직전 24h 롤링)</span>}
      </label>
      <div className="flex items-center gap-2">
        <input
          id="anchor-date"
          type="date"
          value={value}
          max={todayKst}
          onChange={(e) => onChange(e.target.value || todayKst)}
          className="flex-1 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-[15px] text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        />
        {!isToday && (
          <button
            type="button"
            onClick={() => onChange(todayKst)}
            className="rounded-full bg-zinc-100 px-3 py-2 text-[12px] font-medium text-zinc-700 transition hover:bg-zinc-200 active:scale-[0.97]"
          >
            오늘로
          </button>
        )}
      </div>
      <p className="mt-2 text-[11px] text-zinc-400">
        과거 날짜 선택 시 그날 KST 00:00~24:00 보도만. 오늘 선택 시 직전 24시간 롤링.
      </p>
    </Card>
  );
}
