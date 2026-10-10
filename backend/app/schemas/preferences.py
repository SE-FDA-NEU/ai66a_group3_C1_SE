"""Public response shapes for the genre catalogue and account preferences."""

from pydantic import BaseModel, ConfigDict

from app.schemas.movies import GenreDto


class GenreListData(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    genres: list[GenreDto]


class GenreListResponse(BaseModel):
    """The full response body for `GET /api/genres`."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    data: GenreListData


class PreferenceResponse(BaseModel):
    """The full response body for `GET /api/me/preferences`."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    data: GenreListData
