import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.accounts import UserDto
from app.security.passwords import normalize_email

_EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str
    password: str = Field(min_length=8)

    @field_validator("email")
    @classmethod
    def _normalize_and_validate_email(cls, value: str) -> str:
        try:
            normalized = normalize_email(value)
        except (TypeError, ValueError) as exc:
            raise ValueError("email must not be empty") from exc
        if not _EMAIL_PATTERN.match(normalized):
            raise ValueError("email must be a valid address")
        return normalized


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str | None = None
    password: str | None = None


class AuthResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user: UserDto
