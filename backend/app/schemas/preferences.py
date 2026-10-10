"""Public request/response shapes for genres and account preferences."""

from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator

from app.schemas.movies import GenreDto


class PreferenceRequest(BaseModel):
    """Replace the current account's complete selection with 1-5 genre IDs."""

    model_config = ConfigDict(extra="forbid")

    genreIds: list[StrictInt] = Field(min_length=1, max_length=5)

    @field_validator("genreIds")
    @classmethod
    def reject_duplicates(cls, values: list[int]) -> list[int]:
        if len(values) != len(set(values)):
            raise ValueError("genreIds must be distinct")
        return values


class GenreListData(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    genres: list[GenreDto]


class GenreListResponse(BaseModel):
    """The full response body for `GET /api/genres`."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    data: GenreListData


class PreferenceResponse(BaseModel):
    """The full response body for GET and PUT `/api/me/preferences`."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    data: GenreListData
