"""Application-owned persistence models for accounts and the movie catalogue.

Account models keep credential fields internal.  Catalogue models deliberately
distinguish a stable internal movie ID from the ID supplied by an external
provider. Runtime queries reach only the revision selected by
``CatalogueState``; importing a newer revision never requires the browser to
know about a provider ID.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


def utc_now() -> datetime:
    """Return a timezone-aware UTC timestamp for application-created rows."""

    return datetime.now(UTC)


def new_opaque_id() -> str:
    """Return an opaque application ID rather than exposing a provider ID."""

    return str(uuid4())


class CatalogueRevision(Base):
    """A successfully prepared catalogue snapshot that may become active."""

    __tablename__ = "catalogue_revisions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=new_opaque_id
    )
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )
    inserted_movie_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    updated_movie_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    rejected_movie_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )

    movies: Mapped[list[CatalogMovie]] = relationship(
        back_populates="catalogue_revision"
    )


class User(Base):
    """An account used to own authentication and personalisation data.

    The application never stores a plaintext password.  ``password_hash`` is
    intentionally named as such to keep the persistence boundary explicit.
    Authentication code should use :mod:`app.security.passwords` rather than
    handling Argon2 directly.
    """

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=new_opaque_id
    )
    email_normalized: Mapped[str] = mapped_column(
        String(320, collation="NOCASE"), nullable=False, unique=True
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )

    sessions: Mapped[list[AuthSession]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class UserGenrePreference(Base):
    """One favourite genre saved by one account.

    Rows are always keyed by the session-resolved ``users.id``.  Deleting an
    account removes its rows; a genre that is still preferred cannot be deleted.
    """

    __tablename__ = "user_genre_preferences"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    genre_id: Mapped[int] = mapped_column(
        ForeignKey("genres.id", ondelete="RESTRICT"), primary_key=True
    )


class AuthSession(Base):
    """A server-side login session identified by a digest of its cookie token."""

    __tablename__ = "auth_sessions"

    token_digest: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user: Mapped[User] = relationship(back_populates="sessions")


class CatalogueState(Base):
    """The singleton pointer to the only catalogue revision visible at runtime."""

    __tablename__ = "catalogue_state"
    __table_args__ = (
        CheckConstraint("id = 1", name="ck_catalogue_state_singleton"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    active_revision_id: Mapped[str] = mapped_column(
        ForeignKey("catalogue_revisions.id", ondelete="RESTRICT"),
        nullable=False,
        unique=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )

    active_revision: Mapped[CatalogueRevision] = relationship(
        foreign_keys=[active_revision_id]
    )


class CatalogMovie(Base):
    """One provider movie with a stable, application-owned public identity."""

    __tablename__ = "catalog_movies"
    __table_args__ = (
        UniqueConstraint(
            "source",
            "source_id",
            name="uq_catalog_movies_source_source_id",
        ),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=new_opaque_id
    )
    catalogue_revision_id: Mapped[str] = mapped_column(
        ForeignKey("catalogue_revisions.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    source: Mapped[str] = mapped_column(String(32), nullable=False)
    source_id: Mapped[str] = mapped_column(String(128), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    release_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    overview: Mapped[str | None] = mapped_column(Text, nullable=True)
    popularity_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    vote_average: Mapped[float | None] = mapped_column(Float, nullable=True)
    vote_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source_fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )

    catalogue_revision: Mapped[CatalogueRevision] = relationship(
        back_populates="movies"
    )
    movie_genres: Mapped[list[MovieGenre]] = relationship(
        back_populates="movie", cascade="all, delete-orphan"
    )
    genres: Mapped[list[Genre]] = relationship(
        secondary="movie_genres", back_populates="movies", viewonly=True
    )


class Genre(Base):
    """A provider genre reused by all movies that declare that genre."""

    __tablename__ = "genres"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    movie_genres: Mapped[list[MovieGenre]] = relationship(
        back_populates="genre", cascade="all, delete-orphan"
    )
    movies: Mapped[list[CatalogMovie]] = relationship(
        secondary="movie_genres", back_populates="genres", viewonly=True
    )


class MovieGenre(Base):
    """De-duplicated many-to-many relation between a catalogue movie and genre."""

    __tablename__ = "movie_genres"

    movie_id: Mapped[str] = mapped_column(
        ForeignKey("catalog_movies.id", ondelete="CASCADE"), primary_key=True
    )
    genre_id: Mapped[int] = mapped_column(
        ForeignKey("genres.id", ondelete="RESTRICT"), primary_key=True
    )

    movie: Mapped[CatalogMovie] = relationship(back_populates="movie_genres")
    genre: Mapped[Genre] = relationship(back_populates="movie_genres")
