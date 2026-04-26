from __future__ import annotations

from datetime import datetime, timedelta, timezone
from difflib import SequenceMatcher
from email.utils import parsedate_to_datetime

from .fetch import Article


def _parse_dt(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        dt = parsedate_to_datetime(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except (TypeError, ValueError):
        pass
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d %H:%M:%S"):
        try:
            dt = datetime.strptime(raw, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except ValueError:
            continue
    return None


def within_window(articles: list[Article], hours: int) -> list[Article]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    kept = []
    for art in articles:
        dt = _parse_dt(art.published)
        if dt is None or dt >= cutoff:
            kept.append(art)
    return kept


def dedup_by_title(articles: list[Article], threshold: float = 0.85) -> list[Article]:
    out: list[Article] = []
    for art in articles:
        title = art.title.strip()
        if not title:
            continue
        is_dup = False
        for kept in out:
            if SequenceMatcher(None, title, kept.title).ratio() >= threshold:
                is_dup = True
                break
        if not is_dup:
            out.append(art)
    return out


def filter_articles(articles: list[Article], window_hours: int) -> list[Article]:
    return dedup_by_title(within_window(articles, window_hours))
