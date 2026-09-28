"""Persistence boundary for user accounts and credentials."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import User, new_opaque_id
from app.schemas.accounts import UserDto
from app.security.passwords import hash_password, normalize_email


def create_user(session: Session, *, email: str, password: str) -> UserDto:
    """Create a user in the caller's transaction and return only safe fields."""

    user = User(
        id=new_opaque_id(),
        email_normalized=normalize_email(email),
        password_hash=hash_password(password),
    )
    session.add(user)
    session.flush()
    return to_user_dto(user)


def get_user_by_email(session: Session, *, email: str) -> User | None:
    """Return the internal credential record for authentication code only."""

    statement = select(User).where(
        User.email_normalized == normalize_email(email)
    )
    return session.scalar(statement)


def to_user_dto(user: User) -> UserDto:
    """Project an internal user record to the safe public account shape."""

    return UserDto(id=user.id, email=user.email_normalized)
