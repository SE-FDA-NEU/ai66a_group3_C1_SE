"""Public response shapes for movie recommendations."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, model_validator

from app.schemas.movies import GenreDto, MovieSummaryDto


class RecommendationReason(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    matchedGenres: list[GenreDto]


class RecommendationMovieDto(MovieSummaryDto):
    """A public movie card plus its account-specific explanation."""

    reason: RecommendationReason


class RecommendationData(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    movies: list[RecommendationMovieDto]
    mode: Literal["popular", "personalised"]
    personalised: bool
    noMatch: bool

    @model_validator(mode="after")
    def validate_state(self) -> "RecommendationData":
        """Allow only the three recommendation states in the reviewed contract."""

        if self.mode == "personalised":
            if not self.personalised or self.noMatch:
                raise ValueError("invalid personalised recommendation state")
        elif self.personalised:
            raise ValueError("popular recommendations cannot be personalised")
        return self


class RecommendationMeta(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    count: int
    limit: int
    page: int
    total: int
    totalPages: int
    unfilteredTotal: int
    catalogueRevision: str


class RecommendationResponse(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    data: RecommendationData
    meta: RecommendationMeta
