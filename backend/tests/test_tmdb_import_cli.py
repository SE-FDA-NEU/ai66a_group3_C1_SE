"""CLI-only safety and provenance checks for the Sprint 3 TMDb import."""

from __future__ import annotations

from contextlib import nullcontext
from datetime import UTC, datetime
from typing import Self

from app.catalogue.tmdb_import import TmdbImportResult
from app.cli import import_tmdb_catalogue as command


def test_blank_token_exits_nonzero_with_safe_actionable_guidance(
    monkeypatch, capsys
) -> None:
    monkeypatch.setenv("TMDB_READ_ACCESS_TOKEN", "")

    exit_code = command.main()

    captured = capsys.readouterr()
    assert exit_code == 1
    assert captured.out == ""
    assert captured.err == (
        "TMDb catalogue import failed: TMDb import requires "
        "TMDB_READ_ACCESS_TOKEN in the root .env or server environment\n"
    )


def test_success_output_records_safe_provenance_counts(
    monkeypatch, capsys
) -> None:
    result = TmdbImportResult(
        active_revision_id="revision-opaque-id",
        inserted_movie_count=20,
        updated_movie_count=0,
        rejected_movie_count=1,
        movie_count=20,
        associated_genre_count=12,
        finite_popularity_movie_count=19,
        source_fetched_at=datetime(2026, 10, 9, 9, 30, tzinfo=UTC),
        imported_at=datetime(2026, 10, 9, 9, 31, tzinfo=UTC),
        sample_source_ids=("101", "202", "303"),
    )

    monkeypatch.setattr(
        command.TmdbClient,
        "from_environment",
        lambda *_args: _FakeClient(),
    )
    monkeypatch.setattr(command, "SessionLocal", lambda: _FakeSession())
    monkeypatch.setattr(
        command,
        "import_tmdb_catalogue",
        lambda _session, *, client: result,
    )

    exit_code = command.main()

    assert exit_code == 0
    assert capsys.readouterr().out == (
        "TMDb catalogue import complete\n"
        "provider=tmdb\n"
        "active_revision=revision-opaque-id\n"
        "inserted=20\n"
        "updated=0\n"
        "rejected=1\n"
        "movies=20\n"
        "associated_genres=12\n"
        "finite_popularity_movies=19\n"
        "source_fetched_at=2026-10-09T09:30:00Z\n"
        "imported_at=2026-10-09T09:31:00Z\n"
        "sample_source_ids=101,202,303\n"
    )


class _FakeClient:
    def __enter__(self) -> Self:
        return self

    def __exit__(self, *_args: object) -> None:
        return None


class _FakeSession:
    def __enter__(self) -> Self:
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def begin(self):
        return nullcontext()
