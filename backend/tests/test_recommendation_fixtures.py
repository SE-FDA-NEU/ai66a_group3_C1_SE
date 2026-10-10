"""Contract checks for the synthetic S3-T06 recommendation fixtures."""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

FIXTURE_PATH = (
    Path(__file__).parent / "fixtures" / "recommendations_s3_t06.json"
)


def _load_fixture() -> dict[str, Any]:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def _unique_candidates(fixture: dict[str, Any]) -> list[dict[str, Any]]:
    unique: dict[str, dict[str, Any]] = {}
    for row in fixture["candidateRows"]:
        unique.setdefault(row["id"], row)
    return list(unique.values())


def _ranked_ids(candidates: list[dict[str, Any]]) -> list[str]:
    ranked = sorted(
        candidates,
        key=lambda movie: (
            -movie["popularityScore"],
            movie["title"],
            movie["id"],
        ),
    )
    return [movie["id"] for movie in ranked]


def _expected_movie_ids(case: dict[str, Any]) -> list[str]:
    return [
        movie["id"]
        for movie in case["expectedResponse"]["data"]["movies"]
    ]


def test_fixture_is_explicitly_synthetic_offline_and_provider_neutral() -> None:
    fixture = _load_fixture()

    assert fixture["provenance"] == {
        "kind": "hand-authored-synthetic",
        "networkRequired": False,
        "description": (
            "Fictional genres, movies, scores, IDs, and revision created only "
            "for automated recommendation tests."
        ),
    }

    serialized = FIXTURE_PATH.read_text(encoding="utf-8").lower()
    for forbidden_text in (
        "tmdb",
        "api_key",
        "access_token",
        "bearer ",
        "sourceid",
        "source_id",
    ):
        assert forbidden_text not in serialized

    assert all(
        set(row)
        == {"id", "title", "releaseYear", "genreIds", "popularityScore"}
        for row in fixture["candidateRows"]
    )


def test_fixture_has_eleven_unique_candidates_and_one_controlled_duplicate() -> None:
    fixture = _load_fixture()
    rows = fixture["candidateRows"]
    counts = Counter(row["id"] for row in rows)

    assert len(rows) == 12
    assert len(counts) == 11
    assert [movie_id for movie_id, count in counts.items() if count == 2] == [
        "10000000-0000-0000-0000-000000000003"
    ]

    duplicate_rows = [
        row
        for row in rows
        if row["id"] == "10000000-0000-0000-0000-000000000003"
    ]
    assert duplicate_rows[0] == duplicate_rows[1]

    assert _ranked_ids(_unique_candidates(fixture)) == [
        f"10000000-0000-0000-0000-{index:012d}"
        for index in range(1, 12)
    ]


def test_personalised_oracle_is_ranked_distinct_limited_and_explained() -> None:
    fixture = _load_fixture()
    case = fixture["cases"]["personalisedTwoGenreIntersection"]
    selected_genres = set(case["savedGenreIds"])
    genres_by_id = {genre["id"]: genre for genre in fixture["genres"]}
    candidates = _unique_candidates(fixture)
    candidates_by_id = {movie["id"]: movie for movie in candidates}

    eligible = [
        movie
        for movie in candidates
        if selected_genres.intersection(movie["genreIds"])
    ]
    expected_ids = _expected_movie_ids(case)

    assert expected_ids == _ranked_ids(eligible)[: case["request"]["limit"]]
    assert len(expected_ids) == 10
    assert len(set(expected_ids)) == 10
    assert "10000000-0000-0000-0000-000000000011" not in expected_ids

    for expected_movie in case["expectedResponse"]["data"]["movies"]:
        candidate = candidates_by_id[expected_movie["id"]]
        intersection = [
            genres_by_id[genre_id]
            for genre_id in candidate["genreIds"]
            if genre_id in selected_genres
        ]
        assert intersection
        assert expected_movie["reason"]["matchedGenres"] == intersection

    assert case["expectedResponse"]["data"] | {"movies": []} == {
        "movies": [],
        "mode": "personalised",
        "personalised": True,
        "noMatch": False,
    }
    assert case["expectedResponse"]["meta"] == {
        "count": 10,
        "limit": 10,
        "catalogueRevision": fixture["catalogueRevision"],
    }


def test_cold_start_and_no_match_oracles_use_controlled_popular_fallback() -> None:
    fixture = _load_fixture()
    candidates = _unique_candidates(fixture)
    popular_ids = _ranked_ids(candidates)[:10]
    cases = fixture["cases"]

    cold_start = cases["popularColdStart"]
    assert cold_start["savedGenreIds"] == []
    assert _expected_movie_ids(cold_start) == popular_ids
    assert cold_start["expectedResponse"]["data"] | {"movies": []} == {
        "movies": [],
        "mode": "popular",
        "personalised": False,
        "noMatch": False,
    }

    no_match = cases["popularNoMatch"]
    selected_genres = set(no_match["savedGenreIds"])
    assert selected_genres
    assert not any(
        selected_genres.intersection(movie["genreIds"])
        for movie in candidates
    )
    assert _expected_movie_ids(no_match) == popular_ids
    assert no_match["expectedResponse"]["data"] | {"movies": []} == {
        "movies": [],
        "mode": "popular",
        "personalised": False,
        "noMatch": True,
    }

    for case in (cold_start, no_match):
        assert all(
            movie["reason"]["matchedGenres"] == []
            for movie in case["expectedResponse"]["data"]["movies"]
        )
        assert case["expectedResponse"]["meta"] == {
            "count": 10,
            "limit": 10,
            "catalogueRevision": fixture["catalogueRevision"],
        }


def test_fault_oracles_fix_status_code_message_and_request_id_shape() -> None:
    fixture = _load_fixture()
    faults = {fault["id"]: fault for fault in fixture["faultCases"]}

    assert {
        fault_id: (
            fault["expectedStatus"],
            fault["expectedBody"]["error"]["code"],
            fault["expectedBody"]["error"]["message"],
        )
        for fault_id, fault in faults.items()
    } == {
        "authentication-required": (
            401,
            "AUTHENTICATION_REQUIRED",
            "Authentication required",
        ),
        "catalogue-unavailable": (
            503,
            "CATALOGUE_UNAVAILABLE",
            "Movie catalogue is unavailable",
        ),
        "service-unavailable": (
            503,
            "SERVICE_UNAVAILABLE",
            "Service is temporarily unavailable",
        ),
    }

    for fault in faults.values():
        request_id_pattern = fault["expectedBody"]["error"]["requestIdPattern"]
        assert re.fullmatch(request_id_pattern, "req_0123456789abcdef0123456789abcdef")
        assert not re.fullmatch(request_id_pattern, "fixture-secret")
