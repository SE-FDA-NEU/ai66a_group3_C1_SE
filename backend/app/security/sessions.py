"""Opaque cookie session creation and server-side session resolution."""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AuthSession, User

SESSION_COOKIE = "ams_session"
SESSION_TTL = timedelta(days=7)


def _digest(token: str) -> str:
    return hashlib.sha256(token.encode("ascii")).hexdigest()


def _as_utc(value: datetime) -> datetime:
    """Treat SQLite's timezone-less round-trip as UTC."""

    return value.replace(tzinfo=UTC) if value.tzinfo is None else value


def create_session(session: Session, *, user: User) -> str:
    """Create a random cookie value and persist only its SHA-256 digest."""

    token = secrets.token_urlsafe(32)
    now = datetime.now(UTC)
    session.add(
        AuthSession(
            token_digest=_digest(token),
            user_id=user.id,
            created_at=now,
            expires_at=now + SESSION_TTL,
        )
    )
    session.flush()
    return token


def resolve_session(session: Session, token: str | None) -> User | None:
    """Resolve a cookie to its user, rejecting invalid, expired, or revoked rows."""

    if not token:
        return None
    stored = session.scalar(
        select(AuthSession).where(AuthSession.token_digest == _digest(token))
    )
    now = datetime.now(UTC)
    if (
        stored is None
        or stored.revoked_at is not None
        or _as_utc(stored.expires_at) <= now
    ):
        return None
    return stored.user


def revoke_session(session: Session, token: str | None) -> None:
    if not token:
        return
    stored = session.scalar(
        select(AuthSession).where(AuthSession.token_digest == _digest(token))
    )
    if stored is not None and stored.revoked_at is None:
        stored.revoked_at = datetime.now(UTC)
