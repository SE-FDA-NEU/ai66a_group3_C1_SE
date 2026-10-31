"""CLI-only safety and provenance checks for the Sprint 3 TMDb import."""

from __future__ import annotations

from contextlib import nullcontext
from datetime import UTC, datetime
from typing import Self

import pytest
from app.catalogue.tmdb_import import (
    TmdbBackdropEnrichmentResult,
    TmdbImportResult,
    TmdbPosterEnrichmentResult,
    TmdbTrailerAllDatabaseError,
    TmdbTrailerAllResult,
    TmdbTrailerEnrichmentResult,
)
from app.cli import import_tmdb_catalogue as command


def test_blank_token_exits_nonzero_with_safe_actionable_guidance(
    monkeypatch, capsys
) -> None:
    monkeypatch.setenv("TMDB_READ_ACCESS_TOKEN", "")

    exit_code = command.main([])

    captured = capsys.readouterr()
    assert exit_code == 1
    assert captured.out == ""
    assert captured.err == (
        "TMDb catalogue import failed: TMDb import requires "
        "TMDB_READ_ACCESS_TOKEN in the root .env or server environment\n"
    )


@pytest.mark.parametrize("pages", [1, 13, 15, 50])
def test_success_output_records_safe_provenance_counts(
    monkeypatch, capsys, pages
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
    received_pages = []

    def import_snapshot(_session, *, client, pages):
        received_pages.append(pages)
        return result

    monkeypatch.setattr(
        command,
        "import_tmdb_catalogue",
        import_snapshot,
    )

    exit_code = command.main([] if pages == 50 else ["--pages", str(pages)])

    assert exit_code == 0
    assert received_pages == [pages]
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


@pytest.mark.parametrize("pages", ["0", "51", "-1", "1.5", "many"])
def test_invalid_page_budget_exits_before_client_or_database(monkeypatch, pages):
    def forbidden(*_args, **_kwargs):
        raise AssertionError("invalid arguments must not open a client or database")

    monkeypatch.setattr(command.TmdbClient, "from_environment", forbidden)
    monkeypatch.setattr(command, "SessionLocal", forbidden)
    with pytest.raises(SystemExit) as error:
        command.main(["--pages", pages])
    assert error.value.code == 2


@pytest.mark.parametrize("media", ["backdrops", "posters"])
def test_enrichment_cli_prints_bounded_safe_counts(monkeypatch, capsys, media):
    result_type = TmdbPosterEnrichmentResult if media == "posters" else TmdbBackdropEnrichmentResult
    result = result_type(
        eligible_movie_count=255,
        fetched_movie_count=2,
        updated_movie_count=1,
        cleared_movie_count=0,
        unchanged_movie_count=0,
        missing_movie_count=1,
        invalid_movie_count=0,
    )
    monkeypatch.setattr(command.TmdbClient, "from_environment", lambda *_args: _FakeClient())
    monkeypatch.setattr(command, "SessionLocal", lambda: _FakeSession())
    received = []

    def enrich(_session, *, client, limit):
        received.append(limit)
        return result

    monkeypatch.setattr(command, f"enrich_tmdb_{media}", enrich)
    assert command.main([f"--enrich-{media}", "--limit", "2"]) == 0
    assert received == [2]
    assert capsys.readouterr().out == (
        f"TMDb {media[:-1]} enrichment complete\n"
        "eligible=255\n"
        "fetched=2\n"
        "remaining=253\n"
        "updated=1\n"
        "cleared=0\n"
        "unchanged=0\n"
        "missing=1\n"
        "invalid=0\n"
    )


@pytest.mark.parametrize("arguments", [
    ["--enrich-backdrops", "--limit", "0"],
    ["--enrich-backdrops", "--limit", "301"],
    ["--enrich-backdrops", "--pages", "1"],
    ["--limit", "2"],
    ["--enrich-posters", "--limit", "0"],
    ["--enrich-posters", "--limit", "301"],
    ["--enrich-posters", "--pages", "15"],
    ["--enrich-posters", "--enrich-backdrops"],
    ["--enrich-trailers", "--limit", "0"],
    ["--enrich-trailers", "--limit", "301"],
    ["--enrich-trailers", "--pages", "1"],
    ["--enrich-trailers", "--enrich-posters"],
    ["--all"],
    ["--enrich-backdrops", "--all", "--pages", "1"],
    ["--enrich-posters", "--all", "--pages", "1"],
    ["--enrich-trailers", "--all", "--pages", "1"],
])
def test_enrichment_cli_rejects_invalid_or_mixed_budgets_before_io(monkeypatch, arguments):
    def forbidden(*_args, **_kwargs):
        raise AssertionError("invalid arguments must not open a client or database")

    monkeypatch.setattr(command.TmdbClient, "from_environment", forbidden)
    monkeypatch.setattr(command, "SessionLocal", forbidden)
    with pytest.raises(SystemExit) as error:
        command.main(arguments)
    assert error.value.code == 2


@pytest.mark.parametrize("failed,stopped,exit_code", [(0, False, 0), (1, False, 1), (1, True, 1)])
def test_trailer_cli_prints_safe_counts_and_failure_exit(monkeypatch, capsys, failed, stopped, exit_code):
    monkeypatch.setattr(command.TmdbClient, "from_environment", lambda *_args: _FakeClient())
    monkeypatch.setattr(command, "SessionLocal", lambda: _FakeSession())
    limits = []

    def enrich(_session, *, client, limit):
        limits.append(limit)
        return TmdbTrailerEnrichmentResult(3, 2, 1, 0, 1 - failed, failed, stopped,
                                           remaining_movie_count=1)

    monkeypatch.setattr(command, "enrich_tmdb_trailers", enrich)
    assert command.main(["--enrich-trailers", "--limit", "2"]) == exit_code
    assert limits == [2]
    output = capsys.readouterr().out
    assert output.startswith("TMDb trailer enrichment stopped\n" if stopped else
                             "TMDb trailer enrichment complete\n")
    assert "eligible=3\nfetched=2\nremaining=1\nupdated=1\n" in output
    assert f"failed={failed}\n" in output


def test_all_cli_reports_only_committed_batches_after_database_failure(monkeypatch, capsys):
    partial = TmdbTrailerAllResult(
        active_revision_id="revision-opaque-id", eligible_movie_count=5,
        processed_movie_count=2, with_trailer_movie_count=1,
        without_trailer_movie_count=1, failed_movie_count=0,
        remaining_movie_count=3, authentication_stopped=False,
    )
    monkeypatch.setattr(command.TmdbClient, "from_environment", lambda: _FakeClient())

    def fail(_factory, *, client, batch_size):
        assert batch_size == 2
        raise TmdbTrailerAllDatabaseError(partial)

    monkeypatch.setattr(command, "enrich_tmdb_trailers_all", fail)
    assert command.main(["--enrich-trailers", "--all", "--limit", "2"]) == 1
    captured = capsys.readouterr()
    assert "processed=2\nwith_trailer=1\nwithout_trailer=1\nfailed=0\nremaining=3\n" in captured.out
    assert captured.err == "TMDb trailer enrichment failed: current batch rolled back\n"


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
