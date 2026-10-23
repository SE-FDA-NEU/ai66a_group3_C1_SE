"""Explicit SQLite reservation for short account read/modify/write operations."""

from sqlalchemy.exc import InvalidRequestError
from sqlalchemy.orm import Session


def begin_account_write(session: Session) -> None:
    """Reserve the SQLite writer before authentication/decision reads.

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
    connection = session.connection()
    if connection.dialect.name != "sqlite":
        raise InvalidRequestError(
            "Account-write reservation requires a reviewed SQLite policy"
        )
    dbapi = connection.connection.driver_connection
    if dbapi.in_transaction:
        raise InvalidRequestError(
            "Account write must start before an active database transaction"
        )
    connection.exec_driver_sql("BEGIN IMMEDIATE")
    session.expire_all()
