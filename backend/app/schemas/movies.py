"""Public movie catalogue data shapes."""

from pydantic import BaseModel, ConfigDict


class GenreDto(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    id: int
    name: str


class MovieSummaryDto(BaseModel):
    """The shape used by the public movie list."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    id: str
    title: str
    releaseYear: int | None
    genres: list[GenreDto]
    popularityScore: float | None


class MovieDetailDto(BaseModel):
    """The shape used by the public movie detail lookup."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    id: str
    title: str
    releaseYear: int | None
    genres: list[GenreDto]
    overview: str | None
    popularityScore: float | None
    voteAverage: float | None
    voteCount: int | None
