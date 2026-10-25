"""Create persistent account-owned watchlist.

Revision ID: e9b6f0a42c17
Revises: d8a4e6f20195
"""

import sqlalchemy as sa
from alembic import op

revision = "e9b6f0a42c17"
down_revision = "d8a4e6f20195"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_movie_watchlist",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("movie_id", sa.String(36), sa.ForeignKey("catalog_movies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("added_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "movie_id", name="uq_user_movie_watchlist_user_movie"),
    )
    op.create_index("ix_user_movie_watchlist_user_id", "user_movie_watchlist", ["user_id"])
    op.create_index("ix_user_movie_watchlist_movie_id", "user_movie_watchlist", ["movie_id"])


def downgrade() -> None:
    op.drop_index("ix_user_movie_watchlist_movie_id", table_name="user_movie_watchlist")
    op.drop_index("ix_user_movie_watchlist_user_id", table_name="user_movie_watchlist")
    op.drop_table("user_movie_watchlist")
