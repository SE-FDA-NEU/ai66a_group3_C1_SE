"""Read-only structural checks for the local S4-C03 documentation candidate."""

from __future__ import annotations

import re
import sys
from collections import Counter
from hashlib import sha256
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRACT_FILES = (
    Path("docs/api.md"),
    Path("docs/architecture.md"),
    Path("docs/design.md"),
    Path("docs/testing.md"),
)
EVIDENCE = Path("docs/evidence/s4-c03-local-contract-check.md")
MATRIX = Path("docs/evidence/s4-c03-acceptance-matrix.md")
P0_STORIES = ("S01", "S02", "S03", "S04", "S12", "S13")
EXPECTED_MAIN_SECTIONS = (
    "What we test, and why",
    "Test cases for every P0 story",
    "Automated tests",
    "What the tests found",
)
LINK = re.compile(r"\]\(([^)]+)\)")
CASE = re.compile(r"^\| (TC-P0-(S\d{2})-\d{3}) \|", re.MULTILINE)
FEATURE_CASE = re.compile(r"^\| (TC-S4-[A-Z]+-\d{3}) \|", re.MULTILINE)
SECTION = re.compile(r"^## (\d+)\. (.+)$", re.MULTILINE)


def fail(message: str) -> None:
    raise ValueError(message)


def check_links(path: Path, content: str) -> int:
    count = 0
    for target in LINK.findall(content):
        if target.startswith(("http:", "https:", "#", "mailto:")):
            continue
        local = target.split("#", 1)[0]
        if not local:
            continue
        if not (path.parent / local).exists():
            fail(f"{path.relative_to(ROOT)}: missing local link target {local}")
        count += 1
    return count


def main() -> int:
    files = tuple(ROOT / rel for rel in (*CONTRACT_FILES, EVIDENCE, MATRIX))
    for path in files:
        if not path.is_file():
            fail(f"missing document: {path.relative_to(ROOT)}")

    texts = {path: path.read_text(encoding="utf-8") for path in files}
    for path, content in texts.items():
        if not content.endswith("\n"):
            fail(f"{path.relative_to(ROOT)}: missing final newline")
        for number, line in enumerate(content.splitlines(), start=1):
            if line.rstrip(" \t") != line:
                fail(f"{path.relative_to(ROOT)}:{number}: trailing whitespace")
    link_count = sum(check_links(path, content) for path, content in texts.items())
    testing = texts[ROOT / "docs/testing.md"]
    sections = SECTION.findall(testing)
    if sections != [
        (str(index), title)
        for index, title in enumerate(EXPECTED_MAIN_SECTIONS, start=1)
    ]:
        fail(f"docs/testing.md: unexpected four-section layout: {sections}")

    cases = CASE.findall(testing)
    ids = [case_id for case_id, _ in cases]
    if len(ids) != len(set(ids)):
        fail("docs/testing.md: duplicate P0 case ID")
    counts = Counter(story for _, story in cases)
    if set(counts) != set(P0_STORIES) or any(counts[story] < 3 for story in P0_STORIES):
        fail(f"docs/testing.md: P0 cases below three/story: {dict(counts)}")
    for row in testing.splitlines():
        if row.startswith("| TC-P0-") and "](" not in row:
            fail(f"docs/testing.md: missing production-node link in {row.split('|')[1]}")

    feature_ids = FEATURE_CASE.findall(testing)
    if len(feature_ids) != len(set(feature_ids)):
        fail("docs/testing.md: duplicate S4 feature case ID")
    for rel, needle in (
        (Path("docs/api.md"), "## 13. Sprint 4 C03"),
        (Path("docs/architecture.md"), "## 9. Sprint 4 C03"),
        (Path("docs/design.md"), "## 12. Sprint 4 C03"),
    ):
        if needle not in texts[ROOT / rel]:
            fail(f"{rel}: missing C03 section")

    candidate_files = (*CONTRACT_FILES, Path("scripts/verify_s4_c03_contract.py"))
    digests = {
        rel: sha256((ROOT / rel).read_bytes()).hexdigest()
        for rel in candidate_files
    }
    matrix = texts[ROOT / MATRIX]
    for rel, digest in digests.items():
        if f"| `{rel.as_posix()}` | `{digest}` |" not in matrix:
            fail(f"{MATRIX}: missing or stale SHA-256 for {rel}")

    print("S4-C03 local document structure: PASS")
    print("Document final newlines/trailing whitespace: PASS")
    print(f"Local link targets: {link_count} checked, 0 missing")
    print("Testing sections: " + ", ".join(number for number, _ in sections))
    print(
        "P0 case IDs: "
        + str(len(ids))
        + " unique; "
        + ", ".join(f"{story}={counts[story]}" for story in P0_STORIES)
    )
    print(f"S4 feature oracle IDs: {len(feature_ids)} unique")
    for rel, digest in digests.items():
        print(f"sha256 {rel.as_posix()} {digest}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ValueError as exc:
        print(f"S4-C03 local document structure: FAIL: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
