"""Allowlisted TMDb poster URLs; no metadata I/O at request time."""

from app.catalogue.backdrops import IMAGE_BASE_URL, valid_backdrop_path

POSTER_SIZE = "w500"


def valid_poster_path(value: object) -> bool:
    return valid_backdrop_path(value)


def poster_url(path: object, *, size: str = POSTER_SIZE) -> str | None:
    if size != POSTER_SIZE or not valid_poster_path(path):
        return None
    return f"{IMAGE_BASE_URL}/{size}{path}"
