from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import yaml

from . import cache
from .fetch import Article, fetch_rss
from .filter import filter_articles
from .render import sanitize
from .summarize import summarize
from .triage import triage


ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT / "config" / "clusters.yaml"
OUTPUT_DIR = ROOT / "output"


def load_config() -> dict:
    return yaml.safe_load(CONFIG_PATH.read_text(encoding="utf-8"))


def find_company_articles(all_articles: list[Article], company: dict) -> list[Article]:
    keywords = [company["name"], *company.get("related", [])]
    out = []
    for a in all_articles:
        if any(k in a.title for k in keywords) or any(k in a.summary for k in keywords):
            out.append(a)
    return out


async def run_cluster(cluster: dict, settings: dict, dry_run: bool) -> dict:
    cached = None if dry_run else cache.load(cluster["id"], settings["cache_ttl_minutes"])
    if cached:
        articles = [Article(**a) for a in cached["articles"]]
        return {**cluster, "articles": articles, "reports": cached.get("reports", []), "from_cache": True}

    fetched = await fetch_rss(cluster["id"], cluster.get("rss_feeds") or [])
    filtered = filter_articles(fetched.articles, settings["search_window_hours"])

    if dry_run:
        return {
            **cluster,
            "articles": filtered,
            "reports": [r.__dict__ for r in fetched.reports],
            "from_cache": False,
        }

    candidates = filtered[: settings["results_per_cluster"]]
    selected = triage(
        cluster["id"],
        candidates,
        target=3,
        model=settings["llm_triage"],
    )

    cache.save(
        cluster["id"],
        {
            "articles": [a.to_dict() for a in selected],
            "reports": [r.__dict__ for r in fetched.reports],
        },
    )
    return {**cluster, "articles": selected, "reports": [r.__dict__ for r in fetched.reports], "from_cache": False}


async def run(cluster_filter: str | None, dry_run: bool) -> int:
    cfg = load_config()
    settings = cfg["global"]
    company = settings["company"]
    clusters_cfg = cfg["clusters"]
    if cluster_filter:
        clusters_cfg = [c for c in clusters_cfg if c["id"] == cluster_filter or c["name"] == cluster_filter]
        if not clusters_cfg:
            print(f"unknown cluster: {cluster_filter}", file=sys.stderr)
            return 2

    runs = await asyncio.gather(*(run_cluster(c, settings, dry_run) for c in clusters_cfg))

    if dry_run:
        report = {
            "mode": "dry-run",
            "clusters": [
                {
                    "id": r["id"],
                    "name": r["name"],
                    "articles_after_filter": len(r["articles"]),
                    "feeds": r["reports"],
                }
                for r in runs
            ],
        }
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0

    all_articles = [a for r in runs for a in r["articles"]]
    company_articles = find_company_articles(all_articles, company)

    brief = summarize(runs, company_section_articles=company_articles, model=settings["llm_final"])
    cleaned, report = sanitize(brief, banned_words=cfg.get("forbidden_patterns", {}).get("banned_words", []))

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    date_kst = datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y%m%d")
    out_path = OUTPUT_DIR / f"z-brief_{date_kst}.md"
    out_path.write_text(cleaned, encoding="utf-8")

    print(f"[wrote] {out_path}")
    if report.replaced:
        print(f"[sanitize replaced] {report.replaced}")
    if report.violations:
        print(f"[sanitize violations] {report.violations}", file=sys.stderr)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(prog="z-brief", description="정원엔시스 IR Brief CLI")
    parser.add_argument("--cluster", help="단일 클러스터만 실행 (id 또는 name)")
    parser.add_argument("--dry-run", action="store_true", help="LLM 호출 없이 fetch+filter 결과만 JSON 출력")
    args = parser.parse_args()

    dry = args.dry_run or not os.environ.get("ANTHROPIC_API_KEY")
    return asyncio.run(run(args.cluster, dry))


if __name__ == "__main__":
    raise SystemExit(main())
