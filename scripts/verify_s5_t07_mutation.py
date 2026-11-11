"""Run a local S01 boundary mutation, always restore the source, then prove green.

This never edits a deployed service or connects to its database. The existing
pytest bootstrap forces its own temporary SQLite database and disables TMDb.
"""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "backend/app/schemas/preferences.py"
OUTPUT = ROOT / ".venv/t07ops/results"
CASE = "tests/test_p0_acceptance.py::test_TC_P0_S01_007_invalid_sets_preserve_previous_selection"


def run_case() -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-m", "pytest", "-c", "pytest.ini", CASE, "-q"],
        cwd=ROOT, capture_output=True, text=True, timeout=120, check=False,
    )


def portable_output(result: subprocess.CompletedProcess[str]) -> str:
    output = result.stdout + result.stderr
    for value, label in ((str(ROOT), "<workspace>"), (os.environ.get("TEMP", ""), "<temp>")):
        if value:
            output = output.replace(value, label).replace(value.replace("\\", "/"), label)
    return "\n".join(line.rstrip() for line in output.splitlines()) + "\n"


def main() -> int:
    original = SOURCE.read_bytes()
    old, new = b"max_length=5)", b"max_length=6)"
    if original.count(old) != 1:
        raise RuntimeError("Expected one original S01 boundary; no source was changed")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    try:
        SOURCE.write_bytes(original.replace(old, new, 1))
        red = run_case()
    finally:
        SOURCE.write_bytes(original)
    assert SOURCE.read_bytes() == original, "Source restoration failed"
    green = run_case()
    (OUTPUT / "mutation-red.txt").write_text(portable_output(red), encoding="utf-8")
    (OUTPUT / "mutation-restored-green.txt").write_text(portable_output(green), encoding="utf-8")
    assert red.returncode == 1 and "assert 200 == 400" in red.stdout, "Mutation did not fail at the intended rule"
    assert green.returncode == 0 and "1 passed" in green.stdout, "Original rule was not restored green"
    result = {
        "case": CASE, "mutation": "maximum genres 5 to 6, local source only",
        "redExit": red.returncode, "restoredGreenExit": green.returncode,
        "sourceSha256": hashlib.sha256(original).hexdigest(), "exactBytesRestored": True,
        "database": "temporary isolated SQLite from pytest bootstrap; no public/Neon writes",
    }
    (OUTPUT / "mutation.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
