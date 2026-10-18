"""Read-only dossier checks: source links, evidence correspondence, assets and rubric structure."""

import hashlib
import json
import re
from pathlib import Path
from xml.etree import ElementTree

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
manifest = json.loads((ROOT / "docs/images/ui/asset-manifest.json").read_text())
for asset in manifest["assets"]:
    a, b = ROOT / asset["path"], ROOT / asset["source"]
    assert a.read_bytes() == b.read_bytes(), f"Altered evidence copy: {a}"
    assert hashlib.sha256(a.read_bytes()).hexdigest() == asset["sha256"]
wireframes = ["home", "login", "register", "preferences", "movie-detail", "popular"] + [
    "recommendations-" + state for state in ["data", "empty", "loading", "error"]
]
for name in wireframes:
    path = ROOT / "docs/images/ui" / (name + ".svg")
    svg = path.read_text()
    ElementTree.fromstring(svg)
    assert "The user comes here to " in svg
    assert "API calls" in svg and "/api/" in svg
    assert "NOT A SCREENSHOT" in svg
    assert f"images/ui/{name}.svg" in text
accepted = json.loads(
    (ROOT / "docs/evidence/s3-m3-p0-handoff/latest/source-manifest.json").read_text()
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
            "matchingRecordedExecutableFiles": len(accepted["files"])
            - len(intentional_ci_changes),
            "intentionalCiChanges": intentional_ci_changes,
            "humanRequiredMarkers": text.count("HUMAN REQUIRED"),
            "scope": "Structure, local links and source correspondence only; not Story acceptance or release approval.",
        },
        indent=2,
    )
)
