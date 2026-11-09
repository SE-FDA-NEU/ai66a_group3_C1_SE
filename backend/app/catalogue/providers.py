"""VN-only TMDb/JustWatch payload and URL validation; no network access."""

import re
from collections.abc import Mapping
from dataclasses import dataclass
from urllib.parse import parse_qsl, urlsplit

from app.catalogue.backdrops import IMAGE_BASE_URL, valid_backdrop_path
from app.integrations.tmdb import TmdbPayloadError

PROVIDER_GROUPS = ("flatrate", "rent", "buy", "free", "ads")


def watch_options_url(value: object, movie_id: int) -> str | None:
    """Accept only TMDb's supplied watch page for this movie and VN locale."""
    if not isinstance(value, str) or any(ord(char) <= 32 or ord(char) == 127 for char in value):
        return None
    try:
        parsed = urlsplit(value)
        query = parse_qsl(parsed.query, keep_blank_values=True, strict_parsing=True)
        host = parsed.hostname
        if (parsed.scheme != "https" or host not in {"themoviedb.org", "www.themoviedb.org"}
                or parsed.username is not None or parsed.password is not None
                or parsed.port not in {None, 443} or parsed.netloc.lower() not in {host, f"{host}:443"}
                or parsed.fragment or query != [("locale", "VN")]
                or re.fullmatch(rf"/movie/{movie_id}(?:-[A-Za-z0-9-]+)?/watch", parsed.path) is None):
            return None
    except ValueError:
        return None
    return value


def provider_logo_url(path: object) -> str | None:
    return f"{IMAGE_BASE_URL}/w92{path}" if valid_backdrop_path(path) else None


@dataclass(frozen=True)
class Provider:
    group: str
    provider_id: int
    name: str
    logo_path: str | None


def select_vn_providers(payload: Mapping, movie_id: int) -> tuple[list[Provider], str | None, str]:
    """Malformed data is a failed check; a missing VN key is valid no-data."""
    if type(payload.get("id")) is not int or payload["id"] != movie_id:
        raise TmdbPayloadError("TMDb provider movie identity mismatch")
    results = payload.get("results")
    if not isinstance(results, Mapping):
        raise TmdbPayloadError("TMDb returned invalid provider results")
    if "VN" not in results:
        return [], None, "missing"
    regional = results["VN"]
    if not isinstance(regional, Mapping):
        raise TmdbPayloadError("TMDb returned invalid VN provider data")
    providers = {}
    for group in PROVIDER_GROUPS:
        entries = regional.get(group, [])
        if not isinstance(entries, list):
            raise TmdbPayloadError("TMDb returned invalid provider groups")
        for entry in entries:
            if not isinstance(entry, Mapping):
                raise TmdbPayloadError("TMDb returned invalid provider membership")
            identity, name, logo = entry.get("provider_id"), entry.get("provider_name"), entry.get("logo_path")
            if (type(identity) is not int or not 0 < identity <= 2147483647
                    or not isinstance(name, str) or not name.strip() or len(name.strip()) > 200):
                raise TmdbPayloadError("TMDb returned invalid provider identity/name")
            provider = Provider(group, identity, name.strip(), logo if valid_backdrop_path(logo) else None)
            key = (group, identity)
            previous = providers.get(key)
            if previous is None or (provider.name, provider.logo_path or "") < (previous.name, previous.logo_path or ""):
                providers[key] = provider
    raw_link = regional.get("link")
    link = watch_options_url(raw_link, movie_id)
    link_status = "valid" if link else "missing" if raw_link in (None, "") else "invalid"
    return [providers[key] for key in sorted(providers)], link, link_status
