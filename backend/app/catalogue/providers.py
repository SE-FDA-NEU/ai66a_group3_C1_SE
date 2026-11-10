"""Regional TMDb/JustWatch payload and URL validation."""

import re
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Literal
from urllib.parse import parse_qsl, urlsplit

from app.catalogue.backdrops import IMAGE_BASE_URL, valid_backdrop_path
from app.integrations.tmdb import TmdbPayloadError

PROVIDER_GROUPS = ("flatrate", "rent", "buy", "free", "ads")
ProviderCountry = Literal["US", "GB", "SG"]
SUPPORTED_COUNTRIES: tuple[ProviderCountry, ...] = ("US", "GB", "SG")
DEFAULT_PROVIDER_COUNTRY: ProviderCountry = "US"


def watch_options_url(
    value: object, movie_id: int, country: ProviderCountry = DEFAULT_PROVIDER_COUNTRY,
) -> str | None:
    """Accept TMDb's supplied watch page for the exact movie and country."""
    if (country not in SUPPORTED_COUNTRIES or not isinstance(value, str)
            or any(ord(char) <= 32 or ord(char) == 127 for char in value)):
        return None
    try:
        parsed = urlsplit(value)
        query = parse_qsl(parsed.query, keep_blank_values=True, strict_parsing=True)
        host = parsed.hostname
        if (parsed.scheme != "https" or host not in {"themoviedb.org", "www.themoviedb.org"}
                or parsed.username is not None or parsed.password is not None
                or parsed.port not in {None, 443} or parsed.netloc.lower() not in {host, f"{host}:443"}
                or parsed.fragment or query != [("locale", country)]
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


def select_regional_providers(
    payload: Mapping, movie_id: int, country: ProviderCountry = DEFAULT_PROVIDER_COUNTRY,
) -> tuple[list[Provider], str | None, str]:
    """Validate one region independently, treating an absent region as no-data."""
    if country not in SUPPORTED_COUNTRIES:
        raise ValueError("Supported provider countries are US, GB and SG")
    if type(payload.get("id")) is not int or payload["id"] != movie_id:
        raise TmdbPayloadError("TMDb provider movie identity mismatch")
    results = payload.get("results")
    if not isinstance(results, Mapping):
        raise TmdbPayloadError("TMDb returned invalid provider results")
    if country not in results:
        return [], None, "missing"
    regional = results[country]
    if not isinstance(regional, Mapping):
        raise TmdbPayloadError("TMDb returned invalid regional provider data")
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
    link = watch_options_url(raw_link, movie_id, country)
    link_status = "valid" if link else "missing" if raw_link in (None, "") else "invalid"
    return [providers[key] for key in sorted(providers)], link, link_status
