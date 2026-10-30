"""Selection and public projection for official YouTube movie trailers."""

from __future__ import annotations

import re
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from app.integrations.tmdb import TmdbPayloadError

KEY_PATTERN = re.compile(r"[A-Za-z0-9_-]{11}\Z", re.ASCII)


@dataclass(frozen=True)
class Trailer:
    site: str
    key: str
    name: str | None
    type: str
    official: bool
    language: str | None
    published_at: datetime | None


def valid_youtube_key(key: object) -> bool:
    return isinstance(key, str) and KEY_PATTERN.fullmatch(key) is not None


def youtube_url(key: object) -> str | None:
    return f"https://www.youtube.com/watch?v={key}" if valid_youtube_key(key) else None


def select_trailer(payload: Mapping[str, Any]) -> Trailer | None:
    """Reject a malformed envelope; ignore ineligible entries without substitutes."""
    if not isinstance(payload, Mapping):
        raise TmdbPayloadError("TMDb returned an invalid videos payload")
    results = payload.get("results")
    if not isinstance(results, list) or any(not isinstance(item, Mapping) for item in results):
        raise TmdbPayloadError("TMDb returned an invalid videos results payload")

    eligible = []
    for item in results:
        key = item.get("key")
        if (item.get("site") != "YouTube" or item.get("type") != "Trailer"
                or item.get("official") is not True or not valid_youtube_key(key)):
            continue
        name = item.get("name")
        language = item.get("iso_639_1")
        eligible.append(Trailer(
            site="YouTube", key=key,
            name=name.strip()[:500] or None if isinstance(name, str) else None,
            type="Trailer", official=True,
            language=language if isinstance(language, str) and len(language) <= 16 else None,
            published_at=_published_at(item.get("published_at")),
        ))
    return min(eligible, key=lambda trailer: (
        trailer.language != "en",
        trailer.published_at is None,
        -_date_rank(trailer.published_at) if trailer.published_at else 0,
        trailer.key,
    ), default=None)


def _date_rank(value: datetime) -> int:
    """Order UTC instants without platform-dependent timestamp ranges."""
    utc = value.astimezone(UTC)
    return (((utc.toordinal() * 24 + utc.hour) * 60 + utc.minute) * 60
            + utc.second) * 1_000_000 + utc.microsecond


def _published_at(value: object) -> datetime | None:
    if not isinstance(value, str) or "T" not in value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed.astimezone(UTC) if parsed.tzinfo is not None else None
    except (ValueError, OverflowError):
        return None
