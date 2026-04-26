from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass
class RenderReport:
    replaced: dict[str, int]
    violations: list[str]


HORIZONTAL_RE = re.compile(r"^\s*([-=*])\1{2,}\s*$", re.MULTILINE)
EMOJI_RE = re.compile(
    "["
    "\U0001F300-\U0001FAFF"
    "\U00002600-\U000027BF"
    "\U0001F000-\U0001F2FF"
    "]+",
)


def sanitize(text: str, banned_words: list[str] | None = None) -> tuple[str, RenderReport]:
    banned_words = banned_words or ["추천"]
    replaced: dict[str, int] = {}

    def _count_replace(pattern: str, repl: str, src: str) -> str:
        n = src.count(pattern)
        if n:
            replaced[pattern] = replaced.get(pattern, 0) + n
            src = src.replace(pattern, repl)
        return src

    text = _count_replace("—", "-", text)
    text = _count_replace("~", "-", text)

    new_text, n_hr = HORIZONTAL_RE.subn("", text)
    if n_hr:
        replaced["horizontal_rule"] = n_hr
    text = new_text

    new_text, n_emoji = EMOJI_RE.subn("", text)
    if n_emoji:
        replaced["emoji"] = n_emoji
    text = new_text

    violations: list[str] = []
    for word in banned_words:
        if word in text:
            violations.append(f"banned_word:{word}")

    return text, RenderReport(replaced=replaced, violations=violations)
