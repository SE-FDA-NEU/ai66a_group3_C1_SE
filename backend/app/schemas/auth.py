from pydantic import BaseModel, ConfigDict

from app.schemas.accounts import UserDto


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str | None = None
    password: str | None = None


class AuthResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user: UserDto
