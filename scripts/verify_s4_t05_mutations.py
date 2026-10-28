"""Prove selected new S4-T05 assertions reject deliberate wrong business rules.

Each mutation is applied to one production file for one subprocess pytest run,
then the original bytes are restored before rerunning the exact same test.
Do not run this script concurrently with another test process.
"""

from __future__ import annotations

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
    for label, relative, replacements, node in CASES:
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
            or "assert" not in red_output
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
