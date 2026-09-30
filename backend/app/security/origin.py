"""Same-origin checks for browser requests that mutate session state."""

from __future__ import annotations

from urllib.parse import urlsplit

from fastapi import Request

_ALLOWED_FETCH_SITES = frozenset({"same-origin", "none"})


def same_origin_write_allowed(request: Request) -> bool:
    """Return whether a browser session write satisfies the same-origin policy.

    Modern browsers provide ``Sec-Fetch-Site`` and do not allow page JavaScript
    to forge it. The Vite development proxy therefore remains valid because the
    browser request is same-origin before it is proxied to FastAPI. Older
    browsers fall back to comparing ``Origin`` with the request target.

    Non-browser clients may omit both headers. They have no ambient browser
    cookie to exploit, so the cookie's SameSite policy remains the relevant
    boundary for browser CSRF protection.
    """

    fetch_site = request.headers.get("sec-fetch-site")
    if fetch_site is not None:
        return fetch_site.lower() in _ALLOWED_FETCH_SITES

    origin = request.headers.get("origin")
    if origin is None:
        return True

    return _normalized_origin(origin) == _normalized_origin(str(request.base_url))


def _normalized_origin(value: str) -> tuple[str, str, int] | None:
    try:
        parsed = urlsplit(value)
        port = parsed.port
    except ValueError:
        return None

    scheme = parsed.scheme.lower()
    hostname = parsed.hostname
    if (
        scheme not in {"http", "https"}
        or hostname is None
        or parsed.username is not None
        or parsed.password is not None
        or parsed.path not in {"", "/"}
        or parsed.query
        or parsed.fragment
    ):
        return None

    if port is None:
        port = 443 if scheme == "https" else 80

    return scheme, hostname.lower(), port
