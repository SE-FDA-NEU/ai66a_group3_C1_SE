"""Support US/GB/SG while preserving historical VN provider rows."""

import sqlalchemy as sa
from alembic import op

revision = "d9a6f2c1e508"
down_revision = "b8e4d2c96f10"
branch_labels = None
depends_on = None

CONSTRAINT = "ck_movie_provider_checks_country"


def _replace_country_constraint(expression: str) -> None:
    connection = op.get_bind()
    memberships = []
    if connection.dialect.name == "sqlite":
        # Rebuilding the parent with foreign keys enabled cascades its children.
        # Reserve the child rows and start a write transaction before the rebuild.
        memberships = connection.execute(sa.text("SELECT * FROM movie_watch_providers")).mappings().all()
        connection.execute(sa.text("DELETE FROM movie_watch_providers"))
    with op.batch_alter_table("movie_provider_checks") as batch:
        batch.drop_constraint(CONSTRAINT, type_="check")
        batch.create_check_constraint(CONSTRAINT, expression)
    if memberships:
        providers = sa.table("movie_watch_providers", *(
            sa.column(name) for name in (
                "movie_id", "country", "availability_type", "provider_id", "name", "logo_path",
            )
        ))
        connection.execute(providers.insert(), [dict(row) for row in memberships])


def upgrade() -> None:
    _replace_country_constraint("country IN ('VN', 'US', 'GB', 'SG')")


def downgrade() -> None:
    count = op.get_bind().scalar(sa.text("SELECT COUNT(*) FROM movie_provider_checks WHERE country != 'VN'"))
    if count:
        raise RuntimeError("Regional provider data must be preserved/resolved before downgrading to VN-only")
    _replace_country_constraint("country = 'VN'")
