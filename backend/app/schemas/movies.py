"""Public movie catalogue data shapes."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.catalogue.providers import DEFAULT_PROVIDER_COUNTRY, ProviderCountry


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
    backdropUrl: str | None = None


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
    trailer: "TrailerDto | None" = None
    providers: "MovieProvidersDto" = Field(default_factory=lambda: MovieProvidersDto())
    watchOptionsUrl: str | None = None


class WatchProviderDto(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    id: int
    name: str
    logoUrl: str | None


class ProviderGroupsDto(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    flatrate: list[WatchProviderDto] = Field(default_factory=list)
    rent: list[WatchProviderDto] = Field(default_factory=list)
    buy: list[WatchProviderDto] = Field(default_factory=list)
    free: list[WatchProviderDto] = Field(default_factory=list)
    ads: list[WatchProviderDto] = Field(default_factory=list)


class MovieProvidersDto(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    country: ProviderCountry = DEFAULT_PROVIDER_COUNTRY
    status: Literal["not_checked", "success", "no_data", "error", "stale"] = "not_checked"
    attemptedAt: str | None = None
    checkedAt: str | None = None
    groups: ProviderGroupsDto = Field(default_factory=ProviderGroupsDto)


class TrailerDto(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    site: str
    key: str
    name: str | None
    type: str
    official: bool
    language: str | None
    publishedAt: str | None
    url: str


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


class MovieSearchResponse(BaseModel):
    """One page from the complete ordered public Search result."""

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
