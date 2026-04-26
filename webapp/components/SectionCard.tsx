"use client";

import { BriefMarkdown } from "@/components/BriefMarkdown";
import { CopyButton } from "@/components/CopyButton";
import { Card } from "@/components/ui/Card";
import type { SectionContent } from "@/lib/types";

interface Props {
  section: SectionContent;
}

export function SectionCard({ section }: Props) {
  if (!section.selected) {
    return (
      <Card padding="md" className="opacity-60">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-zinc-500">
            {section.name}
          </h3>
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] text-zinc-400">
            건너뜀
          </span>
        </div>
        <p className="mt-2 text-[12px] text-zinc-400">
          이 섹션은 선택되지 않아 생성되지 않았습니다.
        </p>
      </Card>
    );
  }

  return (
    <Card padding="md">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold tracking-tight text-zinc-900">
          {section.name}
        </h3>
        <CopyButton text={section.markdown} label="복사" />
      </div>
      {section.markdown ? (
        <BriefMarkdown markdown={stripFirstHeading(section.markdown)} />
      ) : (
        <p className="text-[13px] text-zinc-400">
          (생성된 내용이 비어있습니다.)
        </p>
      )}
    </Card>
  );
}

function stripFirstHeading(md: string): string {
  return md.replace(/^##\s+[^\n]+\n?/, "");
}
