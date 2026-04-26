from __future__ import annotations

import os
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from .fetch import Article


FINAL_SYSTEM = """당신은 정원엔시스 IR Brief 최종 작성자입니다.

출력 형식 (엄격히 준수):
- 제목: "정원엔시스 IR Brief - YYYY-MM-DD (KST)"
- 가로줄(---, ===, ***) 절대 사용 금지
- 상단 섹션: "오늘의 정원엔시스" — 정원엔시스·에이아이네이션·바스코ICT·젠시스·AX707 직접 연관 기업 동향 (없으면 "특이 동향 없음")
- 본문: 5개 클러스터 순서로 (온프레미스AI -> 피지컬AI -> 버티컬AI -> 보안과PQC -> 밸류에이션). 각 클러스터 2-3문장.
- 하단 "오늘의 핵심 기사": 가장 중요한 2건, "매체명: URL" 형식
- 총평: 1-2문장

문체 규칙:
- 존댓말 또는 명사 종결만 사용
- "추천" 단어 금지
- 출처는 매체명만 노출 (기자명 X)
- 영문 용어는 한국어 + 괄호로 영문 병기
- 절대 금지: 줄표(—), 물결(~), 자기과시 문장, 이모지, 가로줄

출력은 마크다운 텍스트만. 어떤 추가 설명도 붙이지 마십시오."""


def _now_kst_str() -> str:
    return datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y-%m-%d")


def _articles_block(cluster_name: str, articles: list[Article]) -> str:
    if not articles:
        return f"## {cluster_name}\n- (오늘 수집된 기사 없음)"
    lines = [f"## {cluster_name}"]
    for a in articles:
        lines.append(f"- ({a.language}) {a.title} | {a.source} | {a.url}")
        if a.summary:
            lines.append(f"  요약: {a.summary[:300]}")
    return "\n".join(lines)


def summarize(
    clusters: list[dict[str, Any]],
    company_section_articles: list[Article] | None = None,
    model: str = "claude-sonnet-4-6",
) -> str:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY 미설정 상태에서 summarize() 직접 호출 금지. dry-run 경로 사용.")

    date_kst = _now_kst_str()
    user_blocks = [f"오늘 KST 날짜: {date_kst}", "", "## (참고) 정원엔시스 직접 연관 후보"]
    if company_section_articles:
        for a in company_section_articles:
            user_blocks.append(f"- {a.title} | {a.source} | {a.url}")
    else:
        user_blocks.append("- (해당 기사 없음)")
    user_blocks.append("")
    for c in clusters:
        user_blocks.append(_articles_block(c["name"], c["articles"]))
        user_blocks.append("")

    user_prompt = "\n".join(user_blocks)

    from anthropic import Anthropic

    client = Anthropic(api_key=api_key)
    resp = client.messages.create(
        model=model,
        max_tokens=2048,
        system=FINAL_SYSTEM,
        messages=[{"role": "user", "content": user_prompt}],
    )
    return resp.content[0].text if resp.content else ""
