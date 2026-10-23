"""TC-S11: real file SQLite reset/save transaction ordering (offline)."""

import subprocess
import sys
from time import perf_counter

import pytest
from sqlalchemy import text
from support.reset_concurrency import (
    HEADERS,
    NOW,
    RESET,
    ResetHarness,
    concurrent_pair,
    migrate_template,
    mutate,
)


@pytest.fixture(scope="module")
def template(tmp_path_factory):
    return migrate_template(tmp_path_factory.mktemp("t11-template") / "template.db")


@pytest.fixture
def harness(template, tmp_path):
    with ResetHarness(template, tmp_path / "t11.db").installed() as fixture:
        yield fixture


@pytest.fixture(params=["delete", "wal"])
def ordered_harness(template, tmp_path, request):
    with ResetHarness(
        template, tmp_path / "ordered.db", journal=request.param
    ).installed() as fixture:
        yield fixture


@pytest.mark.parametrize("kind", ["reset", "preferences", "rating"])
def test_TC_S11_write_reservation_precedes_auth_and_decision_reads(harness, kind):
    response = mutate(harness.client(), kind)
    assert response.status_code == 200
    statements = harness.sql["request"]
    assert statements[0] == "BEGIN IMMEDIATE", statements[0]
    assert any(
        statement.startswith("SELECT auth_sessions.") for statement in statements[1:]
    )


def test_TC_S11_A_three_genres_two_ratings_reset_preserves_B_and_shared_rows(harness):
    assert harness.personalisation() == (
        [28, 35, 878],
        [("movie-a", 5), ("movie-b", 2)],
    )
    before_b = harness.personalisation("b")
    response = mutate(harness.client(), "reset")
    assert response.status_code == 200
    assert response.json() == {"data": {"reset": True}}
    assert harness.personalisation() == ([], [])
    assert harness.personalisation("b") == before_b == ([18], [("movie-c", 3)])
    assert harness.shared_rows() == harness.before_shared
    assert harness.client().get("/api/auth/me").status_code == 200


@pytest.mark.parametrize("saved_kind", ["preferences", "rating"])
@pytest.mark.parametrize("reset_first", [False, True])
def test_TC_S11_both_controlled_commit_orders(ordered_harness, saved_kind, reset_first):
    h = ordered_harness
    before_b = h.personalisation("b")
    first, second = ("reset", saved_kind) if reset_first else (saved_kind, "reset")
    responses = concurrent_pair(h, first, second)
    assert [r.status_code for r in responses] == [200, 200]
    assert ("leader", "committed") in h.trace and ("follower", "committed") in h.trace
    expected = ([], [])
    if reset_first:
        expected = (
            ([28, 35], []) if saved_kind == "preferences" else ([], [("movie-a", 4)])
        )
    assert h.personalisation() == expected
    assert h.personalisation("b") == before_b
    assert h.shared_rows() == h.before_shared


@pytest.mark.parametrize("saved_kind", ["preferences", "rating"])
def test_TC_S11_other_account_write_waits_then_succeeds_independently(
    ordered_harness, saved_kind
):
    h = ordered_harness
    responses = concurrent_pair(h, "reset", saved_kind, follower_account="b")
    assert [r.status_code for r in responses] == [200, 200]
    assert h.personalisation() == ([], [])
    expected_b = (
        ([28, 35], [("movie-c", 3)])
        if saved_kind == "preferences"
        else ([18], [("movie-a", 4), ("movie-c", 3)])
    )
    assert h.personalisation("b") == expected_b
    assert h.shared_rows() == h.before_shared


@pytest.mark.parametrize("kind", ["rating", "reset"])
def test_TC_S11_competing_same_account_operations_are_atomic_and_unique(
    ordered_harness, kind
):
    h = ordered_harness
    responses = concurrent_pair(h, kind, kind, follower_rating=1)
    assert [r.status_code for r in responses] == [200, 200]
    expected = (
        ([], [])
        if kind == "reset"
        else ([28, 35, 878], [("movie-a", 1), ("movie-b", 2)])
    )
    assert h.personalisation() == expected
    assert h.personalisation("b") == ([18], [("movie-c", 3)])


@pytest.mark.parametrize("failure", ["second_delete", "commit"])
def test_TC_S11_failure_preserves_both_A_sets_and_B_then_allows_retry(harness, failure):
    before = harness.personalisation(), harness.personalisation("b")
    setattr(harness, f"fail_{failure}", True)
    response = mutate(harness.client(), "reset")
    assert response.status_code == 503
    assert set(response.json()) == {"error"}
    assert response.json()["error"]["code"] == "SERVICE_UNAVAILABLE"
    assert response.json()["error"]["message"] == "Service is temporarily unavailable"
    assert "private" not in response.text
    assert (harness.personalisation(), harness.personalisation("b")) == before
    assert harness.shared_rows() == harness.before_shared
    setattr(harness, f"fail_{failure}", False)
    assert mutate(harness.client(), "reset").status_code == 200
    assert harness.personalisation() == ([], [])


def test_TC_S11_failed_A_reset_does_not_absorb_a_concurrent_B_write(ordered_harness):
    h = ordered_harness
    before_a = h.personalisation()
    h.fail_second_delete = True
    first, second = concurrent_pair(h, "reset", "rating", follower_account="b")
    assert first.status_code == 503 and second.status_code == 200
    assert h.personalisation() == before_a
    assert h.personalisation("b") == ([18], [("movie-a", 4), ("movie-c", 3)])
    assert h.shared_rows() == h.before_shared


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"confirm": False},
        {"confirm": 1},
        {"confirm": "true"},
        {"confirm": True, "userId": "b"},
    ],
)
def test_TC_S11_invalid_confirmation_releases_reservation_without_mutation(
    harness, payload
):
    before = harness.personalisation(), harness.personalisation("b")
    response = harness.client().post(RESET, json=payload, headers=HEADERS)
    assert response.status_code == 400
    assert (harness.personalisation(), harness.personalisation("b")) == before
    assert mutate(harness.client(), "reset").status_code == 200


@pytest.mark.parametrize("state", ["missing", "invalid", "expired", "revoked"])
def test_TC_S11_invalid_session_releases_reservation(harness, state):
    client = harness.client()
    if state in {"missing", "invalid"}:
        client.cookies.clear()
        if state == "invalid":
            client.cookies.set("ams_session", "synthetic-invalid")
    else:
        column = "expires_at" if state == "expired" else "revoked_at"
        with harness.engine.begin() as db:
            db.execute(
                text(f"UPDATE auth_sessions SET {column}=:time WHERE user_id='a'"),
                {"time": NOW.isoformat(" ")},
            )
    before = (
        harness.personalisation(),
        harness.personalisation("b"),
        harness.shared_rows(),
    )
    response = mutate(client, "reset")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"
    assert (
        harness.personalisation(),
        harness.personalisation("b"),
        harness.shared_rows(),
    ) == before
    assert mutate(harness.client("b"), "preferences").status_code == 200


def test_TC_S11_forged_account_selectors_never_reset_B(harness):
    response = harness.client().post(
        RESET + "?userId=b&user_id=b",
        json={"confirm": True},
        headers={**HEADERS, "X-User-Id": "b"},
    )
    assert response.status_code == 200
    assert harness.personalisation() == ([], [])
    assert harness.personalisation("b") == ([18], [("movie-c", 3)])


def test_TC_S11_origin_refusal_never_acquires_writer_or_mutates(harness):
    before = harness.personalisation(), harness.personalisation("b")
    response = harness.client().post(
        RESET,
        json={"confirm": True},
        headers={"Origin": "https://attacker.invalid", "X-T11-Actor": "denied"},
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "ORIGIN_NOT_ALLOWED"
    assert harness.sql["denied"] == []
    assert (harness.personalisation(), harness.personalisation("b")) == before


def test_TC_S11_reset_changes_only_local_personalisation_not_catalogue_mode_rules(
    harness,
):
    client = harness.client()
    assert (
        client.get("/api/me/recommendations").json()["data"]["mode"] == "personalised"
    )
    assert mutate(client, "reset").status_code == 200
    response = client.get("/api/me/recommendations")
    assert response.status_code == 200
    assert response.json()["data"]["mode"] == "popular"
    assert response.json()["data"]["personalised"] is False
    assert harness.shared_rows() == harness.before_shared


def test_TC_S11_public_reads_do_not_reserve_writer_and_failed_writes_release_it(
    harness,
):
    client = harness.client()
    assert (
        client.get("/api/movies", headers={"X-T11-Actor": "public"}).status_code == 200
    )
    assert "BEGIN IMMEDIATE" not in harness.sql["public"]
    response = client.put(
        "/api/me/ratings/not-an-active-movie", json={"rating": 5}, headers=HEADERS
    )
    assert response.status_code == 404
    assert mutate(client, "rating").status_code == 200


@pytest.mark.parametrize("kind", ["reset", "preferences", "rating"])
def test_TC_S11_external_process_lock_has_bounded_failure_and_recovery(
    template, tmp_path, kind
):
    # A separate Python/sqlite3 process proves this is a DB lock, not a mutex
    # shared only by threads in the web process. Pipe handshakes, no sleeps.
    with ResetHarness(template, tmp_path / "busy.db", timeout=0.05).installed() as h:
        child = subprocess.Popen(
            [
                sys.executable,
                "-u",
                "-c",
                "import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.execute('BEGIN IMMEDIATE'); print('reserved',flush=True); sys.stdin.readline(); c.rollback(); c.close()",
                str(h.path),
            ],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        try:
            from concurrent.futures import ThreadPoolExecutor

            with ThreadPoolExecutor(max_workers=1) as executor:
                ready = executor.submit(child.stdout.readline)
                try:
                    assert ready.result(timeout=5).strip() == "reserved"
                except BaseException:
                    child.kill()
                    raise
            before = h.personalisation(), h.personalisation("b")
            start = perf_counter()
            response = mutate(h.client(), kind)
            assert perf_counter() - start < 3, (
                "lock wait exceeded test's configured bounded budget"
            )
            assert response.status_code == 503
            assert response.json()["error"]["code"] == "SERVICE_UNAVAILABLE"
            assert (h.personalisation(), h.personalisation("b")) == before
            assert h.shared_rows() == h.before_shared
        finally:
            if child.poll() is None:
                child.stdin.write("release\n")
                child.stdin.flush()
            try:
                child.communicate(timeout=5)
            except subprocess.TimeoutExpired:
                child.kill()
                child.communicate(timeout=5)
        assert mutate(h.client(), kind).status_code == 200
