"""One transaction policy for account-owned read/modify/write operations."""

from sqlalchemy import select
from sqlalchemy.exc import InvalidRequestError
from sqlalchemy.orm import Session

from app.db.models import User
from app.security.sessions import resolve_session


def begin_account_write(session: Session) -> None:
    """Start an account write before authentication and decision reads.

    No commit, hidden rollback, retry or process-local mutex. The route owns
    commit; its dependency rolls back any uncommitted exit. Do not call from a
    nested transaction or with pending changes. Legacy sqlite3 SELECTs can have
    an ORM virtual transaction without a physical DB transaction; expiring a
    clean identity map after reservation prevents reuse of their cached rows.
    """
    if (
        session.new
        or session.dirty
        or session.deleted
        or session.in_nested_transaction()
    ):
        raise InvalidRequestError("Account writes require a clean transaction boundary")
    bind = session.get_bind()
    if bind.dialect.name == "postgresql":
        if session.in_transaction():
            raise InvalidRequestError("Account write must start before database reads")
        connection = session.connection(execution_options={"isolation_level": "READ COMMITTED"})
        connection.exec_driver_sql("SET LOCAL lock_timeout = '5s'")
        return
    if bind.dialect.name != "sqlite":
        raise InvalidRequestError("Unsupported account-write database")
    connection = session.connection()
    dbapi = connection.connection.driver_connection
    if dbapi.in_transaction:
        raise InvalidRequestError(
            "Account write must start before an active database transaction"
        )
    connection.exec_driver_sql("BEGIN IMMEDIATE")
    session.expire_all()


def resolve_account_write_user(session: Session, token: str | None) -> User | None:
    """Lock the PostgreSQL account row before a write reads account data."""
    user = resolve_session(session, token)
    if user is None:
        return None
    if session.get_bind().dialect.name == "postgresql":
        return session.scalar(select(User).where(User.id == user.id).with_for_update())
    return user
