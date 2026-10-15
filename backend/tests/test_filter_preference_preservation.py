"""T16 API/SQLite checks; actual UI actions are verified by the separate suite."""

import shutil
import sqlite3
from pathlib import Path

import pytest
from filter_verification_support import (
    EXPECTED_TITLES,
    filter_scenario,
    migrate_database,
    preference_rows,
)


@pytest.fixture(scope="module")
def migrated_template(tmp_path_factory):
    path = tmp_path_factory.mktemp("t16-migrated-template") / "template.db"
    migrate_database(path)
    return path


@pytest.fixture
def scenario(migrated_template: Path, tmp_path: Path):
    path = tmp_path / "filter-verification.db"
    shutil.copyfile(migrated_template, path)
    with filter_scenario(path) as state:
        yield state


def test_real_api_supplies_exact_five_movie_snapshot_and_available_empty_genre(
    scenario,
):
    response = scenario.account_a.get("/api/me/recommendations?limit=10")
    assert response.status_code == 200
    result = response.json()["data"]
    assert result["personalised"] is True
    assert result["noMatch"] is False
    assert [movie["title"] for movie in result["movies"]] == EXPECTED_TITLES
    ids = [movie["id"] for movie in result["movies"]]
    assert len(set(ids)) == len(ids) == 5
    for genre_id, count in [(28, 2), (35, 3), (27, 0)]:
        assert (
            sum(
                any(g["id"] == genre_id for g in movie["genres"])
                for movie in result["movies"]
            )
            == count
        )
    genres = scenario.account_a.get("/api/genres")
    assert genres.status_code == 200
    assert {g["id"] for g in genres.json()["data"]["genres"]} == {28, 35, 27}


def test_read_flow_preserves_committed_rows_for_both_accounts_and_catalogue(scenario):
    before = preference_rows(scenario.database_path)
    assert sorted(g for user, g in before if user == scenario.user_a) == [28, 35]
    assert [g for user, g in before if user == scenario.user_b] == [27]
    with sqlite3.connect(scenario.database_path) as connection:
        revision_before = connection.execute(
            "SELECT active_revision_id FROM catalogue_state"
        ).fetchone()
    for http in [scenario.account_a, scenario.account_b]:
        for route in [
            "/api/auth/me",
            "/api/genres",
            "/api/me/recommendations?limit=10",
            "/api/me/preferences",
        ]:
            assert http.get(route).status_code == 200
            assert preference_rows(scenario.database_path) == before
    with sqlite3.connect(scenario.database_path) as connection:
        assert (
            connection.execute(
                "SELECT active_revision_id FROM catalogue_state"
            ).fetchone()
            == revision_before
        )
        assert connection.execute("PRAGMA foreign_key_check").fetchall() == []
        assert connection.execute("PRAGMA integrity_check").fetchone() == ("ok",)
