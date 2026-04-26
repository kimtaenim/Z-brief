import { SECTION_LABEL, SECTION_ORDER, type SectionContent, type SectionId } from "./types";

const NAME_TO_ID: Record<string, SectionId> = {};
for (const id of SECTION_ORDER) {
  NAME_TO_ID[SECTION_LABEL[id]] = id;
}

export function splitSections(
  fullMarkdown: string,
  selected: SectionId[],
): SectionContent[] {
  const lines = fullMarkdown.split(/\r?\n/);
  const buckets: Partial<Record<SectionId, string[]>> = {};
  let current: SectionId | null = null;

  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m && !line.startsWith("###")) {
      const name = m[1].trim();
      const id = NAME_TO_ID[name];
      if (id) {
        current = id;
        if (!buckets[id]) buckets[id] = [];
        buckets[id]!.push(line);
        continue;
      }
    }
    if (current) {
      buckets[current]!.push(line);
    }
  }

  const selectedSet = new Set<SectionId>(selected);
  return SECTION_ORDER.map((id) => {
    const lines = buckets[id];
    const markdown = lines ? lines.join("\n").trim() : "";
    return {
      id,
      name: SECTION_LABEL[id],
      markdown,
      selected: selectedSet.has(id),
    };
  });
}
