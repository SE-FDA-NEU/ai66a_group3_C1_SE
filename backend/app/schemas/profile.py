"""Public request and response shapes for personalisation profile reset."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, StrictBool, field_validator


class ProfileResetRequest(BaseModel):
    """Require an explicit strict-boolean confirmation and no extra fields."""

    model_config = ConfigDict(extra="forbid")

    confirm: StrictBool

    @field_validator("confirm")
    @classmethod
    def require_confirmation(cls, value: bool) -> bool:
        if value is not True:
            raise ValueError("profile reset must be explicitly confirmed")
        return value


class ProfileResetData(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    reset: Literal[True]


class ProfileResetResponse(BaseModel):
    """Success returned only after both account-owned deletes commit."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    data: ProfileResetData
