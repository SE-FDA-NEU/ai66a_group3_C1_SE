"""Store VN provider memberships and independent check/link provenance."""

import sqlalchemy as sa
from alembic import op

revision = "b8e4d2c96f10"
down_revision = "a3d1f8b72c44"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "movie_provider_checks",
        sa.Column("movie_id", sa.String(36), nullable=False),
        sa.Column("country", sa.String(2), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("attempted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("watch_options_url", sa.Text(), nullable=True),
        sa.Column("link_status", sa.String(16), nullable=True),
        sa.PrimaryKeyConstraint("movie_id", "country"),
        sa.ForeignKeyConstraint(["movie_id"], ["catalog_movies.id"], ondelete="CASCADE"),
        sa.CheckConstraint("country = 'VN'", name="ck_movie_provider_checks_country"),
        sa.CheckConstraint("status IN ('success', 'no_data', 'error', 'stale')",
                           name="ck_movie_provider_checks_status"),
        sa.CheckConstraint("link_status IS NULL OR link_status IN ('valid', 'missing', 'invalid')",
                           name="ck_movie_provider_checks_link_status"),
    )
    op.create_table(
        "movie_watch_providers",
        sa.Column("movie_id", sa.String(36), nullable=False),
        sa.Column("country", sa.String(2), nullable=False),
        sa.Column("availability_type", sa.String(16), nullable=False),
        sa.Column("provider_id", sa.Integer(), nullable=False, autoincrement=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("logo_path", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("movie_id", "country", "availability_type", "provider_id"),
        sa.ForeignKeyConstraint(["movie_id", "country"],
                                ["movie_provider_checks.movie_id", "movie_provider_checks.country"],
                                ondelete="CASCADE"),
        sa.CheckConstraint("provider_id > 0", name="ck_movie_watch_providers_identity"),
        sa.CheckConstraint("availability_type IN ('flatrate', 'rent', 'buy', 'free', 'ads')",
                           name="ck_movie_watch_providers_group"),
    )


def downgrade() -> None:
    op.drop_table("movie_watch_providers")
    op.drop_table("movie_provider_checks")
