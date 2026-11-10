"""Current-account watchlist responses from the local catalogue."""

from pydantic import BaseModel, ConfigDict

from app.schemas.movies import MovieListMeta, MovieSummaryDto


class WatchlistMovieDto(MovieSummaryDto):
    addedAt: str


class WatchlistData(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")
    movies: list[WatchlistMovieDto]


class WatchlistResponse(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")
    data: WatchlistData
    meta: MovieListMeta


class MembershipData(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")
    movieId: str
    inWatchlist: bool
    addedAt: str | None = None


class MembershipResponse(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")
    data: MembershipData
