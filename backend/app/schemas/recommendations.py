"""Public response shapes for movie recommendations."""

from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.schemas.movies import MovieSummaryDto


class RecommendationData(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    movies: list[MovieSummaryDto]
    mode: Literal["popular"]
    personalised: Literal[False]
    noMatch: Literal[False]


class RecommendationMeta(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    count: int
    limit: int
    catalogueRevision: str


class RecommendationResponse(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    data: RecommendationData
    meta: RecommendationMeta