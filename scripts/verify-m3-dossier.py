"""Read-only dossier checks: source links, evidence correspondence, assets and rubric structure."""

import hashlib
import json
import re
import struct
from pathlib import Path
from xml.etree import ElementTree

from m3_dossier_cover import validate_cover

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / "docs/ui.md"
text = source.read_text(encoding="utf-8")
headings = re.findall(r"^## (.+)$", text, re.MULTILINE)
assert headings == [
    "1. P0 Stories and status",
    "2. Wireframes",
    "3. Error messages",
    "4. What changed since M2",
], headings
assert "| Story | Screen(s) | Route | Status | Issue |" in text
p0 = text.split("| Story | Screen(s) | Route | Status | Issue |", 1)[1].split(
    "\n\n", 1
)[0]
rows = [line for line in p0.splitlines() if line.startswith("| S")]
assert len(rows) == 6
for story, issue in [
    ("S01", 17),
    ("S02", 18),
    ("S03", 19),
    ("S04", 20),
    ("S12", 44),
    ("S13", 45),
]:
    row = next(row for row in rows if row.startswith("| " + story))
    assert "/issues/" + str(issue) in row
    assert re.search(r"\| \[(works|partly works|not started)\]\(", row)
assert "| API error code | Business Rule | Exact message the user sees |" in text
for code in [
    "INVALID_CREDENTIALS",
    "EMAIL_ALREADY_REGISTERED",
    "MOVIE_NOT_FOUND",
    "SERVICE_UNAVAILABLE",
]:
    assert "| `" + code + "`" in text
for message in ["Email or password is incorrect", "This email is already registered"]:
    assert message in text
for doc in [
    source,
    ROOT / "docs/design.md",
    ROOT / "docs/evidence/s3-c05-ui/README.md",
]:
    for target in re.findall(
        r"!?\[[^\]]*\]\(([^)]+)\)", doc.read_text(encoding="utf-8")
    ):
        if target.startswith(("https://", "http://", "#")):
            continue
        file = target.split("#")[0]
        assert (doc.parent / file).exists(), (
            f"Broken link in {doc.relative_to(ROOT)}: {target}"
        )
manifest = json.loads((ROOT / "docs/images/ui/asset-manifest.json").read_text(encoding="utf-8"))
for asset in manifest["assets"]:
    a, b = ROOT / asset["path"], ROOT / asset["source"]
    assert a.read_bytes() == b.read_bytes(), f"Altered evidence copy: {a}"
    assert hashlib.sha256(a.read_bytes()).hexdigest() == asset["sha256"]
supplied = manifest["suppliedAssets"]
expected_supplied = {
    "docs/images/ui/submission-board.png": False,
    "docs/images/ui/p0-movie-detail-browser.png": True,
    "docs/images/ui/login-error-browser.png": True,
}
assert {asset["path"] for asset in supplied} == set(expected_supplied)
for asset in supplied:
    path = ROOT / asset["path"]
    data = path.read_bytes()
    assert data.startswith(b"\x89PNG\r\n\x1a\n"), f"Not a PNG: {path}"
    assert hashlib.sha256(data).hexdigest() == asset["sha256"], path
    assert len(data) == asset["bytes"], path
    assert struct.unpack(">II", data[16:24]) == (asset["width"], asset["height"]), path
    assert asset["browserAddressBar"] is expected_supplied[asset["path"]]
    assert asset["transformation"] == "none; byte-for-byte copy of PO attachment"
    assert asset["captureTimestamp"] is None or isinstance(asset["captureTimestamp"], str)
    assert asset["path"].removeprefix("docs/") in text
provenance = ROOT / manifest["suppliedAssetsProvenance"]
assert provenance.exists()
assert "not a browser network transcript" in provenance.read_text(encoding="utf-8")
validate_cover(text)
wireframes = ["home", "login", "register", "preferences", "movie-detail", "popular"] + [
    "recommendations-" + state for state in ["data", "empty", "loading", "error"]
]
for name in wireframes:
    path = ROOT / "docs/images/ui" / (name + ".svg")
    svg = path.read_text(encoding="utf-8")
    ElementTree.fromstring(svg)
    assert "The user comes here to " in svg
    assert "API calls" in svg and "/api/" in svg
    assert "NOT A SCREENSHOT" in svg
    assert f"images/ui/{name}.svg" in text
accepted = json.loads(
    (ROOT / "docs/evidence/s3-m3-p0-handoff/latest/source-manifest.json").read_text(encoding="utf-8")
)
intentional_ci_changes = []
for name, digest in accepted["files"].items():
    actual = hashlib.sha256(
        (ROOT / name).read_bytes().replace(b"\r\n", b"\n")
    ).hexdigest()
    if actual != digest and name == ".github/workflows/scrum-check.yml":
        # The explicit C05 follow-up fixes metadata linkage; no application/test
        # fingerprint is exempted. This difference must be reported, not hidden.
        intentional_ci_changes.append(
            {"path": name, "acceptedSha256": digest, "currentSha256": actual}
        )
        continue
    assert actual == digest, (
        f"Application/evidence source changed; re-evaluate acceptance: {name}"
    )
design = (ROOT / "docs/design.md").read_text(encoding="utf-8")
erd = (ROOT / "docs/images/erd.puml").read_text(encoding="utf-8")
assert len(re.findall(r'^entity "', erd, re.MULTILINE)) == 9
assert "user_genre_preferences" in erd and "user_movie_ratings" in erd
assert "backdrop_path" in erd and "c6f8a2d4e901" in erd
assert "The ERD in `docs/images/erd.png` is the M2 baseline" not in design
assert "images/erd-m2.png" in design and "images/architecture-m2.png" in design
assert "Preference persistence and recommendation generation" in design
# Cover validation checks all five name/ID pairs, roles and submission links.
assert "HUMAN REQUIRED: student ID" not in text
assert "/issues/189" in text and "/pull/187" in text
# This intentionally does not convert placeholders or a draft into acceptance.
print(
    json.dumps(
        {
            "result": "PASS",
            "requiredSections": len(headings),
            "p0Stories": len(rows),
            "apiErrorCases": 4,
            "wireframes": len(wireframes),
            "unalteredEvidenceCopies": len(manifest["assets"]),
            "poSuppliedOriginalPngs": len(supplied),
            "addressBarCaptures": sum(asset["browserAddressBar"] for asset in supplied),
            "matchingRecordedExecutableFiles": len(accepted["files"])
            - len(intentional_ci_changes),
            "intentionalCiChanges": intentional_ci_changes,
            "currentErdTables": 9,
            "poSuppliedStudentIds": 5,
            "humanRequiredMarkers": text.count("HUMAN REQUIRED"),
            "scope": "Structure, local links and source correspondence only; not Story acceptance or release approval.",
        },
        indent=2,
    )
)
