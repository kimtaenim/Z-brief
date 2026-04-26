from __future__ import annotations

import json
import os
from typing import Any

from .fetch import Article


TRIAGE_SYSTEM = """당신은 한국 IR 브리핑용 1차 추리기입니다.
입력으로 한 클러스터의 후보 기사 목록을 받습니다.
조건:
- 정원엔시스(에이아이네이션·바스코ICT·젠시스·AX707) 또는 한국 AI 인프라 의사결정자에게 의미있는 2-3건만 고릅니다.
- 단순 광고·중복 보도·이미 알려진 일반 동향은 제외.
- 영문 기사는 한국어 한 문장 요약 + 핵심 영문 용어를 괄호로 병기.
출력은 반드시 JSON 배열만, 각 원소는 {"index": int, "reason": str} 형식."""


def _articles_to_prompt(articles: list[Article]) -> str:
    lines = []
    for i, a in enumerate(articles):
        lines.append(f"[{i}] ({a.language}) {a.title} | {a.source} | {a.url}")
    return "\n".join(lines)


def triage(
    cluster_id: str,
    articles: list[Article],
    target: int = 3,
    model: str = "claude-haiku-4-5-20251001",
) -> list[Article]:
    if not articles:
        return []

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY 미설정 상태에서 triage() 직접 호출 금지. dry-run 경로 사용.")

    from anthropic import Anthropic

    client = Anthropic(api_key=api_key)
    user_prompt = (
        f"클러스터: {cluster_id}\n목표 기사 수: 최대 {target}\n\n"
        f"후보:\n{_articles_to_prompt(articles)}"
    )
    resp = client.messages.create(
        model=model,
        max_tokens=512,
        system=TRIAGE_SYSTEM,
        messages=[{"role": "user", "content": user_prompt}],
    )
    text = resp.content[0].text if resp.content else "[]"
    picks = _parse_picks(text, target, len(articles))
    return [articles[p["index"]] for p in picks if 0 <= p["index"] < len(articles)]


def _parse_picks(text: str, target: int, max_idx: int) -> list[dict[str, Any]]:
    text = text.strip()
    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1:
        return []
    try:
        picks = json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return []
    out = []
    seen = set()
    for p in picks:
        idx = p.get("index")
        if isinstance(idx, int) and 0 <= idx < max_idx and idx not in seen:
            out.append({"index": idx, "reason": str(p.get("reason", ""))})
            seen.add(idx)
        if len(out) >= target:
            break
    return out
