// 매체 도메인 → 한글 매체명 매핑. RSS source 필드가 도메인(예: "v.daum.net")으로
// 들어올 때 LLM이 link text에 그대로 박지 않게 정규화.
const MEDIA_ALIASES: Record<string, string> = {
  "v.daum.net": "다음",
  "news.daum.net": "다음",
  "news.naver.com": "네이버",
  "n.news.naver.com": "네이버",
  "hani.co.kr": "한겨레",
  "khan.co.kr": "경향",
  "sisain.co.kr": "시사IN",
  "news.kbs.co.kr": "KBS",
  "imnews.imbc.com": "MBC",
  "enews.imnews.imbc.com": "MBC",
  "news.sbs.co.kr": "SBS",
  "ohmynews.com": "오마이뉴스",
  "voakorea.com": "VOA",
  "bbc.com": "BBC",
  "bbc.co.uk": "BBC",
  "nytimes.com": "NYT",
  "lemonde.fr": "르몽드",
  "reuters.com": "Reuters",
  "bloomberg.com": "Bloomberg",
};

export function normalizeMediaSource(source: string | null | undefined): string {
  if (!source) return "";
  const trimmed = source.trim();
  if (!trimmed) return "";
  if (MEDIA_ALIASES[trimmed]) return MEDIA_ALIASES[trimmed];
  const noWww = trimmed.replace(/^www\./, "");
  if (MEDIA_ALIASES[noWww]) return MEDIA_ALIASES[noWww];
  return trimmed;
}
