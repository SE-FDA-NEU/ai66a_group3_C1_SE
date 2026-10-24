"""T11 database-boundary unit checks, using actual temporary SQLite files."""

import pytest
from app.db.account_writes import begin_account_write
from app.db.database import create_database_engine
from sqlalchemy import String, text
from sqlalchemy.exc import InvalidRequestError
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column


class ProbeBase(DeclarativeBase):
    pass


class Probe(ProbeBase):
    __tablename__ = "t11_probe"
    id: Mapped[int] = mapped_column(primary_key=True)
    value: Mapped[str] = mapped_column(String)


@pytest.fixture
def engine(tmp_path):
    engine = create_database_engine(
        f"sqlite:///{(tmp_path / 'boundary.db').as_posix()}"
    )
    ProbeBase.metadata.create_all(engine)
    with engine.begin() as db:
        db.execute(text("INSERT INTO t11_probe VALUES (1,'before')"))
    try:
        yield engine
    finally:
        engine.dispose()


def test_TC_S11_runtime_engine_policy_keeps_foreign_keys_and_finite_timeout(engine):
    with engine.connect() as db:
        assert db.exec_driver_sql("PRAGMA foreign_keys").scalar() == 1
        assert db.exec_driver_sql("PRAGMA busy_timeout").scalar() == 5000
        assert db.exec_driver_sql("PRAGMA journal_mode").scalar() == "delete"


def test_TC_S11_reservation_is_real_and_caller_owns_commit_or_rollback(engine):
    with Session(engine) as session:
        begin_account_write(session)
        assert session.connection().connection.driver_connection.in_transaction
        session.execute(text("UPDATE t11_probe SET value='uncommitted' WHERE id=1"))
        session.rollback()
    with engine.connect() as db:
        assert (
            db.execute(text("SELECT value FROM t11_probe WHERE id=1")).scalar()
            == "before"
        )
    with Session(engine) as next_session:
        begin_account_write(next_session)
        next_session.rollback()


def test_TC_S11_existing_database_transaction_is_rejected_not_silently_discarded(
    engine,
):
    with Session(engine) as session:
        session.execute(text("BEGIN"))
        session.execute(text("UPDATE t11_probe SET value='owned-by-caller' WHERE id=1"))
        with pytest.raises(InvalidRequestError, match="active database transaction"):
            begin_account_write(session)
        assert session.connection().connection.driver_connection.in_transaction
        assert (
            session.execute(text("SELECT value FROM t11_probe WHERE id=1")).scalar()
            == "owned-by-caller"
        )
        session.rollback()


@pytest.mark.parametrize("pending", ["new", "dirty", "deleted"])
def test_TC_S11_pending_orm_changes_are_rejected_not_expired_or_committed(
    engine, pending
):
    with Session(engine, autoflush=False) as session:
        if pending == "new":
            row = Probe(id=2, value="new")
            session.add(row)
        else:
            row = session.get(Probe, 1)
            if pending == "dirty":
                row.value = "dirty"
            else:
                session.delete(row)
        with pytest.raises(InvalidRequestError, match="clean transaction boundary"):
            begin_account_write(session)
        assert row in getattr(session, pending)
        session.rollback()


def test_TC_S11_nested_transaction_is_not_mistaken_for_a_reservation(engine):
    with (
        Session(engine) as session,
        session.begin_nested(),
        pytest.raises(InvalidRequestError, match="clean transaction boundary"),
    ):
        begin_account_write(session)


def test_TC_S11_clean_legacy_read_cache_is_refreshed_after_acquiring_writer(engine):
    with Session(engine, autoflush=False) as session:
        cached = session.get(Probe, 1)
        assert cached.value == "before"
        assert not session.connection().connection.driver_connection.in_transaction
        with engine.begin() as other:
            other.execute(
                text("UPDATE t11_probe SET value='new-committed-state' WHERE id=1")
            )
        begin_account_write(session)
        assert session.get(Probe, 1).value == "new-committed-state"
        session.rollback()
