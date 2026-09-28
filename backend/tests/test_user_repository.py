from __future__ import annotations

from collections.abc import Iterator

import pytest
from app.db.database import Base
from app.db.models import User
from app.repositories.users import create_user, get_user_by_email
from app.security.passwords import verify_password
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker


@pytest.fixture
def session() -> Iterator[Session]:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    local_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    with local_session() as database_session:
        yield database_session
        database_session.rollback()

    Base.metadata.drop_all(engine)
    engine.dispose()


def test_create_user_normalizes_email_hashes_password_and_returns_safe_dto(
    session: Session,
) -> None:
    dto = create_user(
        session,
        email="  VIEWER@Example.COM ",
        password="movie123",
    )
    stored_user = session.scalar(select(User))

    assert dto.model_dump() == {
        "id": stored_user.id,
        "email": "viewer@example.com",
    }
    assert "password" not in dto.model_dump()
    assert stored_user.password_hash != "movie123"
    assert stored_user.password_hash.startswith("$argon2id$")
    assert verify_password("movie123", stored_user.password_hash)


def test_user_lookup_uses_the_same_email_normalization(session: Session) -> None:
    created = create_user(
        session,
        email="viewer@example.com",
        password="movie123",
    )

    found = get_user_by_email(session, email=" VIEWER@EXAMPLE.COM ")

    assert found is not None
    assert found.id == created.id
