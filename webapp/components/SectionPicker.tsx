"use client";

import { Tag } from "@/components/ui/Tag";
import { SECTION_DESCRIPTION, SECTION_LABEL, SECTION_ORDER, type SectionId } from "@/lib/types";

interface Props {
  selected: Set<SectionId>;
  onToggle: (id: SectionId) => void;
  onAll: () => void;
  onNone: () => void;
}

export function SectionPicker({ selected, onToggle, onAll, onNone }: Props) {
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between px-1">
        <h2 className="text-[12px] font-medium uppercase tracking-wider text-zinc-500">
          어떤 섹션을 볼까요? ({selected.size}/{SECTION_ORDER.length})
        </h2>
        <div className="flex gap-3 text-[12px]">
          <button type="button" onClick={onAll} className="text-blue-600 hover:underline">
            모두
          </button>
          <button type="button" onClick={onNone} className="text-zinc-500 hover:underline">
            해제
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {SECTION_ORDER.map((id) => (
          <Tag key={id} active={selected.has(id)} onClick={() => onToggle(id)}>
            {SECTION_LABEL[id]}
          </Tag>
        ))}
      </div>
      <ul className="mt-3 space-y-1 px-1 text-[11px] leading-relaxed text-zinc-500">
        {SECTION_ORDER.filter((id) => selected.has(id)).map((id) => (
          <li key={id}>
            <span className="font-medium text-zinc-700">{SECTION_LABEL[id]}</span>
            <span className="text-zinc-400"> · {SECTION_DESCRIPTION[id]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
