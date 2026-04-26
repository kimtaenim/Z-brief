import type { ClusterRunOutput, FetchReport } from "./types";
import { nowKstDate } from "./summarize";

export function mockBrief(clusters: ClusterRunOutput[], reports: FetchReport[]): string {
  const date = nowKstDate();
  const parts: string[] = [
    `# 정원엔시스 IR Brief - ${date} (KST)`,
    "",
    "## 오늘의 정원엔시스",
    "특이 동향 없음 (mock 모드)",
    "",
  ];
  for (const c of clusters) {
    parts.push(`## ${c.name}`);
    if (c.articles.length > 0) {
      const top = c.articles.slice(0, 2);
      parts.push(
        `${top.map((a) => a.title).join(" / ")} 등 ${c.articles.length}건이 후보로 수집되었습니다. mock 모드라 실제 LLM 요약은 생략됩니다.`,
      );
    } else {
      parts.push("오늘 수집된 기사가 없습니다.");
    }
    parts.push("");
  }
  parts.push("## 오늘의 핵심 기사");
  const all = clusters.flatMap((c) => c.articles).slice(0, 2);
  if (all.length > 0) {
    for (const a of all) parts.push(`- ${a.source}: ${a.url}`);
  } else {
    parts.push("- (수집된 기사 없음)");
  }
  parts.push("");
  parts.push("## 총평");
  const okFeeds = reports.filter((r) => r.ok).length;
  const totalFeeds = reports.length;
  parts.push(
    `RSS 피드 ${okFeeds}/${totalFeeds}개 정상. ANTHROPIC_API_KEY 설정 시 Haiku/Sonnet 호출이 적용됩니다.`,
  );
  return parts.join("\n");
}
