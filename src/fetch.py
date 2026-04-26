from __future__ import annotations

import asyncio
from dataclasses import dataclass, field, asdict
from typing import Any

import feedparser
import httpx


@dataclass
class Article:
    cluster_id: str
    title: str
    url: str
    source: str
    published: str | None
    summary: str = ""
    language: str = "ko"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class FetchReport:
    cluster_id: str
    feed: str
    ok: bool
    count: int
    error: str | None = None


@dataclass
class ClusterFetchResult:
    cluster_id: str
    articles: list[Article] = field(default_factory=list)
    reports: list[FetchReport] = field(default_factory=list)


def _parse_feed_sync(url: str, timeout: float = 10.0) -> tuple[list[dict[str, Any]], str | None]:
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True, headers={"User-Agent": "Z-brief/0.1"}) as client:
            resp = client.get(url)
            resp.raise_for_status()
            parsed = feedparser.parse(resp.content)
    except Exception as exc:
        return [], f"{type(exc).__name__}: {exc}"

    if parsed.bozo and not parsed.entries:
        return [], f"bozo: {getattr(parsed, 'bozo_exception', 'unknown')}"

    return list(parsed.entries), None


async def fetch_rss(cluster_id: str, feeds: list[str]) -> ClusterFetchResult:
    result = ClusterFetchResult(cluster_id=cluster_id)
    loop = asyncio.get_running_loop()

    tasks = [loop.run_in_executor(None, _parse_feed_sync, feed) for feed in feeds]
    parsed_results = await asyncio.gather(*tasks)

    for feed_url, (entries, err) in zip(feeds, parsed_results):
        if err:
            result.reports.append(FetchReport(cluster_id, feed_url, ok=False, count=0, error=err))
            continue

        for entry in entries:
            published = entry.get("published") or entry.get("updated")
            article = Article(
                cluster_id=cluster_id,
                title=entry.get("title", "").strip(),
                url=entry.get("link", "").strip(),
                source=_host_of(entry.get("link", "")) or feed_url,
                published=published,
                summary=(entry.get("summary") or "").strip(),
                language=_guess_lang(entry.get("title", "")),
            )
            result.articles.append(article)

        result.reports.append(FetchReport(cluster_id, feed_url, ok=True, count=len(entries)))

    return result


def _host_of(url: str) -> str:
    if not url:
        return ""
    from urllib.parse import urlparse
    return urlparse(url).netloc


def _guess_lang(text: str) -> str:
    if not text:
        return "ko"
    for ch in text:
        if "가" <= ch <= "힣":
            return "ko"
    return "en"
