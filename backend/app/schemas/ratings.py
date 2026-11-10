"""Public request/response shapes for account-owned movie ratings."""

from pydantic import BaseModel, ConfigDict, Field, StrictFloat, field_validator


class RatingRequest(BaseModel):
    """Save one numeric half-star rating; no identity field is accepted."""

    model_config = ConfigDict(extra="forbid")

    rating: StrictFloat = Field(ge=0.5, le=5, multiple_of=0.5)

    @field_validator("rating")
    @classmethod
    def exact_half_star(cls, value: float) -> float:
        if not (value * 2).is_integer():
            raise ValueError("rating must use exact half-star steps")
        return value


class RatingData(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    movieId: str
    rating: float | None


class RatingResponse(BaseModel):
    """The full response body for GET and PUT `/api/me/ratings/{movieId}`."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    data: RatingData
