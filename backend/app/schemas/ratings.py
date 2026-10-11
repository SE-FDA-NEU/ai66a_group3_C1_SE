"""Public request/response shapes for account-owned movie ratings."""

from pydantic import BaseModel, ConfigDict, Field, StrictInt


class RatingRequest(BaseModel):
    """Save one strict integer rating; no identity field is accepted."""

    model_config = ConfigDict(extra="forbid")

    rating: StrictInt = Field(ge=1, le=5)


class RatingData(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    movieId: str
    rating: int | None


class RatingResponse(BaseModel):
    """The full response body for GET and PUT `/api/me/ratings/{movieId}`."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    data: RatingData
