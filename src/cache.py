from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

CACHE_DIR = Path(__file__).resolve().parent.parent / "cache"


def _path(cluster_id: str, hour_bucket: str) -> Path:
    return CACHE_DIR / f"{cluster_id}_{hour_bucket}.json"


def _bucket(now: datetime | None = None) -> str:
    now = now or datetime.now(timezone.utc)
    return now.strftime("%Y%m%d_%H")


def load(cluster_id: str, ttl_minutes: int) -> dict[str, Any] | None:
    bucket = _bucket()
    path = _path(cluster_id, bucket)
    if not path.exists():
        return None

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None

    saved_at = datetime.fromisoformat(data.get("saved_at", ""))
    if datetime.now(timezone.utc) - saved_at > timedelta(minutes=ttl_minutes):
        return None
    return data


def save(cluster_id: str, payload: dict[str, Any]) -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    bucket = _bucket()
    path = _path(cluster_id, bucket)
    payload = {**payload, "saved_at": datetime.now(timezone.utc).isoformat()}
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return path
