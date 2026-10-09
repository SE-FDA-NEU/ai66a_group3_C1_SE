"""Regression checks for the deterministic evidence produced by Spike #43."""

import json
import subprocess
import sys
from pathlib import Path

SCRIPT_PATH = Path(__file__).parents[1] / "scripts" / "run_nlp_spike.py"


def _run_spike() -> dict[str, object]:
    result = subprocess.run(
        [sys.executable, str(SCRIPT_PATH), "--json"],
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_nlp_spike_fixture_is_deterministic_and_matches_the_decision() -> None:
    first = _run_spike()
    second = _run_spike()

    assert first == second
    assert [row["id"] for row in first["s07NormalSimilarity"]] == [
        "night-train",
        "zebra-case",
        "family-drama",
        "silent-platform",
    ]
    assert first["s08ZeroScoreSearch"] == []
    assert first["s08ZeroScoreMessage"] == "No movies found."


def test_nlp_spike_excludes_source_wrong_genre_and_duplicate_candidates() -> None:
    results = _run_spike()
    normal_ids = [row["id"] for row in results["s07NormalSimilarity"]]

    assert "source-railway" not in normal_ids
    assert "city-escape" not in normal_ids
    assert normal_ids.count("night-train") == 1
