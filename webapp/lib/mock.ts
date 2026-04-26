import { nowKstDateTime } from "./summarize";
import type { Article, ClusterRunOutput, FetchReport, SectionId } from "./types";
import { SECTION_LABEL, SECTION_ORDER } from "./types";

interface MockOptions {
  selectedSections: SectionId[];
  userInterest: string | null;
}

function clusterMock(name: string, articles: Article[], userInterest: string | null): string {
  const top = articles.slice(0, 2);
  const focus = userInterest
    ? `사용자 관심 주제 "${userInterest}"를 반영해 ${name}의 흐름을 살펴봅니다. `
    : "";
  if (top.length === 0) {
    return `${focus}오늘 ${name} 클러스터에서 RSS 신규 기사가 수집되지 않았습니다. 보강 출처(web_search) 추가가 필요합니다.`;
  }
  const titles = top.map((a) => a.title).join(" / ");
  return `${focus}${name} 클러스터에서 ${articles.length}건이 후보로 잡혔으며, 대표 기사는 "${titles}" 입니다. mock 모드라 실제 LLM 요약은 생략됩니다.`;
}

export function mockBrief(
  clusters: ClusterRunOutput[],
  companyArticles: Article[],
  reports: FetchReport[],
  opts: MockOptions,
): string {
  const dt = nowKstDateTime();
  const out: string[] = [`# 정원엔시스 IR Brief - ${dt} (KST)`, ""];
  const selected = new Set(opts.selectedSections);

  if (selected.has("overview")) {
    out.push("## 종합");
    out.push("### 오늘의 정원엔시스");
    if (companyArticles.length > 0) {
      for (const a of companyArticles.slice(0, 3)) out.push(`- ${a.title} (${a.source})`);
    } else {
      out.push("특이 동향 없음 (mock).");
    }
    out.push("");
    out.push("### 오늘의 핵심 기사");
    const all = clusters.flatMap((c) => c.articles).slice(0, 2);
    if (all.length > 0) {
      for (const a of all) out.push(`- ${a.source}: ${a.url}`);
    } else {
      out.push("- (수집된 기사 없음)");
    }
    out.push("");
    out.push("### 총평");
    const okFeeds = reports.filter((r) => r.ok).length;
    const totalFeeds = reports.length;
    const interestNote = opts.userInterest
      ? ` 관심 주제 "${opts.userInterest}" 반영 시 다음 단계 분석에서 가중됩니다.`
      : "";
    out.push(
      `RSS 피드 ${okFeeds}/${totalFeeds}개 정상 수신.${interestNote} ANTHROPIC_API_KEY 설정 시 Haiku/Sonnet 호출이 적용됩니다.`,
    );
    out.push("");
  }

  for (const id of SECTION_ORDER) {
    if (id === "overview") continue;
    if (!selected.has(id)) continue;
    const cluster = clusters.find((c) => c.id === id);
    out.push(`## ${SECTION_LABEL[id]}`);
    out.push(clusterMock(SECTION_LABEL[id], cluster?.articles ?? [], opts.userInterest));
    out.push("");
  }

  return out.join("\n");
}
