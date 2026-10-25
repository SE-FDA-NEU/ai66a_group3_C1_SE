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
    posterUrl: str | None = None


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
    backdropUrl: str | None
    posterUrl: str | None = None


class MovieListMeta(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    count: int
    limit: int
    page: int
    total: int
    totalPages: int
    unfilteredTotal: int
    catalogueRevision: str


class MovieListData(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    movies: list[MovieSummaryDto]


class MovieListResponse(BaseModel):
    """The full response body for `GET /api/movies`."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    data: MovieListData
    meta: MovieListMeta


class MovieDetailMeta(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    catalogueRevision: str


class MovieDetailData(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    movie: MovieDetailDto


class MovieDetailResponse(BaseModel):
    """The full response body for `GET /api/movies/{movieId}`."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    data: MovieDetailData
    meta: MovieDetailMeta


class MovieSimilarResponse(BaseModel):
    """Unpaged public Similar result, capped at five movies."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    data: MovieListData
