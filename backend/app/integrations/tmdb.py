"""Small server-only client for the TMDb movie catalogue API.

The adapter owns HTTP concerns only.  It returns provider JSON to the catalogue
service, which is responsible for validating and storing provider-neutral data.
No browser route imports this module or receives the TMDb credential.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from typing import Any, Self

import httpx

TMDB_BASE_URL = "https://api.themoviedb.org/3"
TMDB_SOURCE = "tmdb"
DEFAULT_TIMEOUT_SECONDS = 10.0
DEFAULT_POPULAR_PAGES = 50
MAX_POPULAR_PAGES = 50
# Movie videos default to en-US. A live TMDb probe showed that a broad ISO
# 639-1 list can return an empty videos array even when the default request
# has videos. This bounded fallback set was checked against the live endpoint.
# Keep one HTTP request per movie so a batch remains within 300 requests.
VIDEO_LANGUAGES = (
    "en,ko,fr,vi,ja,es,zh,hi,de,it,pt,ru,ar,th,id,tr,nl,sv,pl,uk,bn,"
    "fa,ta,te,ml,ur,he,el,da,fi,no,cs,hu,ro,null"
)


class TmdbImportError(RuntimeError):
    """A sanitized failure while reading the required provider catalogue."""


class TmdbConfigurationError(TmdbImportError):
    """The server does not have a usable TMDb credential."""


class TmdbAuthenticationError(TmdbImportError):
    """TMDb rejected the server credential."""


class TmdbRateLimitError(TmdbImportError):
    """TMDb temporarily rejected the import because of rate limiting."""


class TmdbPayloadError(TmdbImportError):
    """TMDb returned a response outside the importer contract."""


class TmdbClient:
    """Read only the bounded TMDb data needed by the server-side importer."""

    def __init__(
        self,
        token: str,
        *,
        http_client: httpx.Client | None = None,
    ) -> None:
        normalized_token = token.strip()
        if not normalized_token:
            raise TmdbConfigurationError(
                "TMDb import requires TMDB_READ_ACCESS_TOKEN in the root .env "
                "or server environment"
            )
        if http_client is None and os.getenv("TMDB_NETWORK_DISABLED") == "1":
            raise TmdbConfigurationError(
                "TMDb network access is disabled for offline checks"
            )

        self._headers = {
            "Authorization": f"Bearer {normalized_token}",
            "Accept": "application/json",
        }
        self._owns_http_client = http_client is None
        self._http_client = http_client or httpx.Client(
            base_url=TMDB_BASE_URL,
            timeout=DEFAULT_TIMEOUT_SECONDS,
        )

    @classmethod
    def from_environment(
        cls, environment: Mapping[str, str] | None = None
    ) -> TmdbClient:
        """Build a client from server configuration without logging the token."""

        source = os.environ if environment is None else environment
        return cls(source.get("TMDB_READ_ACCESS_TOKEN", ""))

    def close(self) -> None:
        """Release the owned HTTP client after a CLI import finishes."""

        if self._owns_http_client:
            self._http_client.close()

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *_args: object) -> None:
        self.close()

    def fetch_genres(self) -> list[Mapping[str, Any]]:
        """Return TMDb's official movie genre mappings."""

        payload = self._get_json("/genre/movie/list", params={"language": "en"})
        return _required_object_list(payload, "genres")

    def fetch_popular_movies(self, page: int) -> list[Mapping[str, Any]]:
        """Return one explicitly bounded popular-movie page."""

        if type(page) is not int or not 1 <= page <= MAX_POPULAR_PAGES:
            raise ValueError(
                f"page must be an integer from 1 to {MAX_POPULAR_PAGES}"
            )
        payload = self._get_json(
            "/movie/popular",
            params={"language": "en-US", "page": page},
        )
        return _required_object_list(payload, "results")

    def fetch_movie_details(self, movie_id: int) -> Mapping[str, Any]:
        """Return details for core genre fallback or bounded media enrichment."""

        if movie_id <= 0:
            raise ValueError("movie_id must be positive")
        return self._get_json(
            f"/movie/{movie_id}",
            params={"language": "en-US"},
        )

    def fetch_movie_videos(self, movie_id: int) -> Mapping[str, Any]:
        """Fetch English and other tagged videos in one bounded request."""
        if type(movie_id) is not int or movie_id <= 0:
            raise ValueError("movie_id must be positive")
        return self._get_json(
            f"/movie/{movie_id}/videos",
            params={"language": "en-US", "include_video_language": VIDEO_LANGUAGES},
        )

    def _get_json(
        self, path: str, *, params: Mapping[str, str | int]
    ) -> Mapping[str, Any]:
        try:
            response = self._http_client.get(
                path,
                params=params,
                headers=self._headers,
            )
        except httpx.TimeoutException as exc:
            raise TmdbImportError("TMDb request timed out") from exc
        except httpx.ConnectError as exc:
            raise TmdbImportError(
                "TMDb request failed; check network/DNS access to "
                "api.themoviedb.org"
            ) from exc
        except httpx.HTTPError as exc:
            raise TmdbImportError("TMDb request failed") from exc

        if response.status_code == 401:
            raise TmdbAuthenticationError("TMDb authentication failed")
        if response.status_code == 429:
            raise TmdbRateLimitError("TMDb rate limit reached")
        if not response.is_success:
            raise TmdbImportError("TMDb request failed")

        try:
            payload = response.json()
        except ValueError as exc:
            raise TmdbPayloadError("TMDb returned invalid JSON") from exc

        if not isinstance(payload, Mapping):
            raise TmdbPayloadError("TMDb returned an invalid response")
        return payload


def _required_object_list(
    payload: Mapping[str, Any], field_name: str
) -> list[Mapping[str, Any]]:
    value = payload.get(field_name)
    if not isinstance(value, list) or not all(
        isinstance(item, Mapping) for item in value
    ):
        raise TmdbPayloadError(f"TMDb returned an invalid {field_name} payload")
    return value
