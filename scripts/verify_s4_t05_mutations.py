"""Prove every new S4-T05 rule test rejects a relevant wrong business rule.

Each mutation is applied to one production file for one subprocess pytest run,
then the original bytes are restored before rerunning the exact same test.
Do not run this script concurrently with another test process.
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOG = ROOT / "docs/evidence/s4-t05-mutations.txt"


CASES = (
    (
        "S01 minimum 1 -> 0",
        "backend/app/schemas/preferences.py",
        ((b"Field(min_length=1, max_length=5)", b"Field(min_length=0, max_length=5)"),),
        "tests/test_p0_acceptance.py::test_TC_P0_S01_002_zero_preserves_previous_rows",
    ),
    (
        "S01 maximum 5 -> 6",
        "backend/app/schemas/preferences.py",
        ((b"Field(min_length=1, max_length=5)", b"Field(min_length=1, max_length=6)"),),
        "tests/test_p0_acceptance.py::test_TC_P0_S01_007_invalid_sets_preserve_previous_selection",
    ),
    (
        "S02 truncate eligible set before paging",
        "backend/app/recommendations/service.py",
        ((b"        limit=None,\n", b"        limit=10,\n"),),
        "tests/test_p0_acceptance.py::test_TC_P0_S02_001_full_set_paging_has_25_distinct_movies",
    ),
    (
        "S04 popularity ascending",
        "backend/app/recommendations/ranker.py",
        ((b"score.desc() if sql else", b"score.asc() if sql else"),),
        "tests/test_p0_acceptance.py::test_TC_P0_S04_002_cold_start_has_no_personal_score",
    ),
    (
        "S04 ignore stale catalogue revision",
        "backend/app/main.py",
        (
            (
                b"if expected is not None and expected != actual:",
                b"if expected is not None and expected == actual:",
            ),
        ),
        "tests/test_p0_acceptance.py::test_TC_P0_S04_006_stale_catalogue_revision_is_409",
    ),
    (
        "S12 allow seven-character password",
        "backend/app/schemas/auth.py",
        (
            (
                b"password: str = Field(min_length=8)",
                b"password: str = Field(min_length=7)",
            ),
        ),
        "tests/test_p0_acceptance.py::test_TC_P0_S12_002_seven_char_password_has_no_row",
    ),
    (
        "S13 accept wrong password for known account",
        "backend/app/main.py",
        (
            (
                b"if user is None or not valid_password:",
                b"if user is None and not valid_password:",
            ),
        ),
        "tests/test_p0_acceptance.py::test_TC_P0_S13_002_wrong_and_unknown_credentials_same_public_error",
    ),
    (
        "S05b ignore rating adjustment in displayed score",
        "backend/app/recommendations/ranker.py",
        (
            (
                b"score = (movie.popularity_score + adjustment",
                b"score = (movie.popularity_score + 0",
            ),
        ),
        "tests/test_rating_ranking_acceptance.py::test_s05b_save_to_rerank_exact_scores_and_account_isolation",
    ),
    (
        "S05a hide committed rating in save response",
        "backend/app/main.py",
        (
            (
                b"RatingData(movieId=movie.id, rating=stored.rating)",
                b"RatingData(movieId=movie.id, rating=None)",
            ),
        ),
        "tests/test_rating_ranking_acceptance.py::test_s05a_saved_value_replaces_one_row_and_invalid_write_preserves_it",
    ),
)

ADDITIONAL_CASES = (
    (
        "S01-001 hide available genres",
        "backend/app/main.py",
        ((b"list_available_genres(database_session)", b"[]"),),
        "tests/test_p0_acceptance.py::test_TC_P0_S01_001_canonical_genres_and_empty_selection",
    ),
    *(
        (
            f"S01-00{number} replace requested selection",
            "backend/app/main.py",
            ((b"genre_ids=payload.genreIds", b"genre_ids=[35]"),),
            f"tests/test_p0_acceptance.py::test_TC_P0_S01_003_004_005_006_exact_selection_boundaries[TC-P0-S01-00{number}]",
        )
        for number in (3, 4, 5, 6)
    ),
    (
        "S01-008 accept forged identity",
        "backend/app/schemas/preferences.py",
        (
            (
                b'class PreferenceRequest(BaseModel):\n    """Replace the current account\'s complete selection with 1-5 genre IDs."""\n\n    model_config = ConfigDict(extra="forbid")',
                b'class PreferenceRequest(BaseModel):\n    """Replace the current account\'s complete selection with 1-5 genre IDs."""\n\n    model_config = ConfigDict(extra="ignore")',
            ),
        ),
        "tests/test_p0_acceptance.py::test_TC_P0_S01_008_guest_forgery_and_origin_leave_accounts_intact",
    ),
    (
        "S02-002 reverse personal score order",
        "backend/app/recommendations/ranker.py",
        (
            (
                b"(-score if score is not None else 0)",
                b"(score if score is not None else 0)",
            ),
        ),
        "tests/test_p0_acceptance.py::test_TC_P0_S02_002_rating_free_order_and_reasons",
    ),
    (
        "S02-003 conceal no-match state",
        "backend/app/recommendations/service.py",
        (
            (
                b"genre_id=genre_id, no_match=True)",
                b"genre_id=genre_id, no_match=False)",
            ),
        ),
        "tests/test_p0_acceptance.py::test_TC_P0_S02_003_no_match_uses_unboosted_popular",
    ),
    (
        "S02-004 wrong auth refusal code",
        "backend/app/main.py",
        (
            (
                b'"AUTHENTICATION_REQUIRED",\n            "Authentication required",\n            401,\n        )\n\n    revision',
                b'"WRONG_AUTH_CODE",\n            "Authentication required",\n            401,\n        )\n\n    revision',
            ),
        ),
        "tests/test_p0_acceptance.py::test_TC_P0_S02_004_guest_and_expired_cookie_are_private",
    ),
    (
        "S02-005 disguise core database failure",
        "backend/app/main.py",
        (
            (
                b'"SERVICE_UNAVAILABLE",\n        "Service is temporarily unavailable",\n        503,\n    )\n\n\ndef get_db',
                b'"WRONG_DB_CODE",\n        "Service is temporarily unavailable",\n        503,\n    )\n\n\ndef get_db',
            ),
        ),
        "tests/test_p0_acceptance.py::test_TC_P0_S02_005_core_failure_then_retry_preserves_preferences",
    ),
    (
        "S02-006 skip genre view filter",
        "backend/app/recommendations/service.py",
        (
            (
                b"if genre_id is not None:\n        ranked =",
                b"if False:\n        ranked =",
            ),
        ),
        "tests/test_p0_acceptance.py::test_TC_P0_S02_006_filter_after_whole_set_ranking",
    ),
    (
        "S04-001 default to descending catalogue",
        "backend/app/main.py",
        (
            (
                b'sort: CatalogueSort = "title_asc",',
                b'sort: CatalogueSort = "title_desc",',
            ),
        ),
        "tests/test_p0_acceptance.py::test_TC_P0_S04_001_public_catalogue_pages_include_null_popularity",
    ),
    (
        "S04-003 report page size as total",
        "backend/app/main.py",
        ((b'"total": total,', b'"total": count,'),),
        "tests/test_p0_acceptance.py::test_TC_P0_S04_003_limit_9_and_10_keep_full_total",
    ),
    (
        "S04-004 wrong validation code",
        "backend/app/main.py",
        (
            (
                b'return _error("VALIDATION_ERROR", "Please correct the highlighted fields", 400)\n\n\n@app.exception_handler(SQLAlchemyError)',
                b'return _error("WRONG_VALIDATION_CODE", "Please correct the highlighted fields", 400)\n\n\n@app.exception_handler(SQLAlchemyError)',
            ),
        ),
        "tests/test_p0_acceptance.py::test_TC_P0_S04_004_limit_and_page_refusals",
    ),
    (
        "S04-005 wrong missing-catalogue code",
        "backend/app/main.py",
        (
            (
                b'"CATALOGUE_UNAVAILABLE", "Movie catalogue is unavailable", 503\n        )\n\n    if error := _revision_error(catalogue_revision, revision.id):\n        return error\n\n    total = count_active_movies(database_session)',
                b'"WRONG_CATALOGUE_CODE", "Movie catalogue is unavailable", 503\n        )\n\n    if error := _revision_error(catalogue_revision, revision.id):\n        return error\n\n    total = count_active_movies(database_session)',
            ),
        ),
        "tests/test_p0_acceptance.py::test_TC_P0_S04_005_empty_active_versus_missing_revision",
    ),
    (
        "S12-001 preserve mixed-case email",
        "backend/app/security/passwords.py",
        ((b"normalized = email.strip().lower()", b"normalized = email.strip()"),),
        "tests/test_p0_acceptance.py::test_TC_P0_S12_001_eight_char_normalized_hashed_registration",
    ),
    (
        "S12-003 require ten characters",
        "backend/app/schemas/auth.py",
        (
            (
                b"password: str = Field(min_length=8)",
                b"password: str = Field(min_length=10)",
            ),
        ),
        "tests/test_p0_acceptance.py::test_TC_P0_S12_003_nine_char_password_has_safe_dto",
    ),
    (
        "S12-004 wrong duplicate-email message",
        "backend/app/main.py",
        ((b'"This email is already registered",', b'"Account already exists",'),),
        "tests/test_p0_acceptance.py::test_TC_P0_S12_004_duplicate_normalized_email_is_conflict",
    ),
    (
        "S12-005 disguise account database failure",
        "backend/app/main.py",
        (
            (
                b'"SERVICE_UNAVAILABLE",\n        "Service is temporarily unavailable",\n        503,\n    )\n\n\ndef get_db',
                b'"WRONG_DB_CODE",\n        "Service is temporarily unavailable",\n        503,\n    )\n\n\ndef get_db',
            ),
        ),
        "tests/test_p0_acceptance.py::test_TC_P0_S12_005_invalid_email_and_storage_failure_create_no_account",
    ),
    (
        "S13-001 refuse valid me session",
        "backend/app/main.py",
        (
            (
                b'return AuthResponse(data=AuthData(user=to_user_dto(user)))\n\n\n@app.post("/api/auth/logout"',
                b'return _error("WRONG_ME_STATE", "Authentication required", 401)\n\n\n@app.post("/api/auth/logout"',
            ),
        ),
        "tests/test_p0_acceptance.py::test_TC_P0_S13_001_login_me_cookie_and_safe_user",
    ),
    (
        "S13-003 leave logout session active",
        "backend/app/main.py",
        (
            (
                b"revoke_session(database_session, request.cookies.get(SESSION_COOKIE))\n    database_session.commit()\n    _clear_session_cookie",
                b"database_session.flush()\n    database_session.commit()\n    _clear_session_cookie",
            ),
        ),
        "tests/test_p0_acceptance.py::test_TC_P0_S13_003_logout_replay_and_later_login_restore_data",
    ),
    (
        "S13-004 ignore expiry",
        "backend/app/security/sessions.py",
        ((b"or _as_utc(stored.expires_at) <= now", b"or False"),),
        "tests/test_p0_acceptance.py::test_TC_P0_S13_004_missing_expired_and_revoked_sessions_refused",
    ),
    (
        "S13-005 accept forged identity",
        "backend/app/schemas/preferences.py",
        (
            (
                b'class PreferenceRequest(BaseModel):\n    """Replace the current account\'s complete selection with 1-5 genre IDs."""\n\n    model_config = ConfigDict(extra="forbid")',
                b'class PreferenceRequest(BaseModel):\n    """Replace the current account\'s complete selection with 1-5 genre IDs."""\n\n    model_config = ConfigDict(extra="ignore")',
            ),
        ),
        "tests/test_p0_acceptance.py::test_TC_P0_S13_005_account_isolation_and_forged_identity",
    ),
    (
        "S13-006 allow foreign origin",
        "backend/app/main.py",
        (
            (
                b"if _requires_same_origin(request) and not same_origin_write_allowed(request):",
                b"if False and _requires_same_origin(request) and not same_origin_write_allowed(request):",
            ),
        ),
        "tests/test_p0_acceptance.py::test_TC_P0_S13_006_cross_origin_auth_and_write_refused",
    ),
    (
        "S05a failure return code",
        "backend/app/main.py",
        (
            (
                b'except SQLAlchemyError:\n        database_session.rollback()\n        return _error("SERVICE_UNAVAILABLE", "Service is temporarily unavailable", 503)\n\n    return response\n\n\n@app.get("/api/movies"',
                b'except SQLAlchemyError:\n        database_session.rollback()\n        return _error("WRONG_SAVE_CODE", "Service is temporarily unavailable", 503)\n\n    return response\n\n\n@app.get("/api/movies"',
            ),
        ),
        "tests/test_rating_ranking_acceptance.py::test_s05a_failed_update_has_no_success_and_retry_commits",
    ),
    (
        "S05b conceal unavailable rating source",
        "backend/app/recommendations/ranker.py",
        (
            (
                b'"rating_unavailable" if not ratings_available else',
                b'"baseline" if not ratings_available else',
            ),
        ),
        "tests/test_rating_ranking_acceptance.py::test_s05b_rating_query_failure_is_truthful_and_core_failure_is_error",
    ),
    (
        "S05b retain old rating signal after reset",
        "backend/app/repositories/profile.py",
        (
            (
                b"session.execute(\n        delete(UserMovieRating).where(\n            UserMovieRating.user_id == user_id,\n        )\n    )",
                b"session.flush()",
            ),
        ),
        "tests/test_rating_ranking_acceptance.py::test_s05b_reset_reselection_removes_old_signal_preserves_b",
    ),
)


def run(node: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-m", "pytest", "-q", "--tb=short", node],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )


def clean_output(output: str) -> str:
    return "\n".join(line.rstrip() for line in output.splitlines()).strip()


def main() -> int:
    lines = [
        "S4-T05 deliberate business-rule mutations (not feature TDD)",
        "Each RED is a production assertion, followed by byte-for-byte restoration and GREEN.",
    ]
    for label, relative, replacements, node in (*CASES, *ADDITIONAL_CASES):
        path = ROOT / relative
        original = path.read_bytes()
        changed = original
        for before, after in replacements:
            if b"\r\n" in original:
                before = before.replace(b"\n", b"\r\n")
                after = after.replace(b"\n", b"\r\n")
            if changed.count(before) != 1:
                raise RuntimeError(
                    f"{label}: expected one source occurrence of {before!r}"
                )
            changed = changed.replace(before, after, 1)
        try:
            path.write_bytes(changed)
            red = run(node)
        finally:
            path.write_bytes(original)
        if path.read_bytes() != original:
            raise RuntimeError(f"{label}: production bytes were not restored")
        green = run(node)
        red_output = red.stdout + red.stderr
        green_output = green.stdout + green.stderr
        lines.extend(
            (
                f"\n## {label}",
                f"node={node}",
                f"red_exit={red.returncode}",
                clean_output(red_output),
                f"green_exit={green.returncode}",
                clean_output(green_output),
            )
        )
        if (
            red.returncode != 1
            or "FAILED" not in red_output
            or re.search(r"^E   (?:assert|AssertionError)", red_output, re.MULTILINE)
            is None
            or "ERRORS" in red_output
            or green.returncode != 0
            or "passed" not in green_output
        ):
            LOG.write_text("\n".join(lines) + "\n", encoding="utf-8")
            raise RuntimeError(f"{label}: invalid assertion RED/GREEN; inspect {LOG}")
        print(f"{label}: assertion RED, restored GREEN", flush=True)
    LOG.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
