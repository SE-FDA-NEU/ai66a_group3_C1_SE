"""Public account data shapes."""

from pydantic import BaseModel, ConfigDict


class UserDto(BaseModel):
    """The only account shape safe to return through an API response."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    id: str
    email: str
