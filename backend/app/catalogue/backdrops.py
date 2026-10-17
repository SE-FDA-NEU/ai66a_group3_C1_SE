"""Validated TMDb backdrop paths and the reviewed, cached image configuration.

The image origin and size are server constants. Detail requests only use local
movie rows and these constants; they never query TMDb configuration at runtime.
"""

from __future__ import annotations

import re

# TMDb's HTTPS image origin and a single finite backdrop size. Keep this
# configuration reviewed when changing sizes or image delivery infrastructure.
IMAGE_BASE_URL = "https://image.tmdb.org/t/p"
BACKDROP_SIZE = "w780"
_SUPPORTED_SIZES = frozenset({BACKDROP_SIZE})
_BACKDROP_PATH = re.compile(r"/[A-Za-z0-9_-]{1,128}\.(?:jpg|jpeg|png|webp)\Z")


def valid_backdrop_path(value: object) -> bool:
    """Accept one provider image filename, never a URL or nested path."""

    return isinstance(value, str) and _BACKDROP_PATH.fullmatch(value) is not None


def backdrop_url(path: object, *, size: str = BACKDROP_SIZE) -> str | None:
    """Return an allowlisted HTTPS URL, or null for missing/legacy bad data."""

    if size not in _SUPPORTED_SIZES or not valid_backdrop_path(path):
        return None
    return f"{IMAGE_BASE_URL}/{size}{path}"
