"""Inspect PDF pagination/text/images and write local visual previews; requires PyMuPDF."""

import argparse
import hashlib
import json
from pathlib import Path

import pymupdf as fitz

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("pdf", type=Path)
args = parser.parse_args()
doc = fitz.open(args.pdf)
assert len(doc) >= 4, (
    "Dossier must contain cover, boards, application images and required sections"
)
for index, title in [
    (0, "Milestone 3"),
    (1, "Submission page 2"),
    (2, "Submission page 3"),
]:
    assert title in doc[index].get_text(), (
        f"Required content misplaced: page {index + 1} lacks {title}"
    )
all_text = "\n".join(page.get_text() for page in doc)
for title in [
    "P0 Stories and status",
    "Wireframes",
    "Error messages",
    "What changed since M2",
]:
    assert title in all_text, f"Missing required section {title}"
for message in ["Email or password is incorrect", "This email is already registered"]:
    assert message in all_text, f"Exact Story message missing: {message}"
assert len(doc[1].get_images()) >= 2, "Planning and submission-day board images required"
assert len(doc[2].get_images()) >= 2, "P0 and error browser captures required"
assert "Nguyen Xuan Kiet" in doc[0].get_text(), "Submitter missing from cover"
assert "INVALID_CREDENTIALS" in doc[2].get_text(), "Page 3 error caption missing"
output = args.pdf.parent / (args.pdf.stem + "-inspection")
output.mkdir(exist_ok=True, parents=True)
report = {
    "pdf": str(args.pdf),
    "sha256": hashlib.sha256(args.pdf.read_bytes()).hexdigest(),
    "pages": len(doc),
    "pageChecks": [],
    "outOfBoundsText": [],
    "scope": "Pagination/text/image-presence checks and previews only; human final-asset/readability acceptance remains required.",
}
for index, page in enumerate(doc):
    spans = [
        span
        for block in page.get_text("dict")["blocks"]
        if "lines" in block
        for line in block["lines"]
        for span in line["spans"]
        if span["text"].strip()
    ]
    for span in spans:
        box = fitz.Rect(span["bbox"])
        if (
            box.x0 < -1
            or box.y0 < -1
            or box.x1 > page.rect.width + 1
            or box.y1 > page.rect.height + 1
        ):
            report["outOfBoundsText"].append(
                {"page": index + 1, "text": span["text"], "box": list(box)}
            )
    report["pageChecks"].append(
        {
            "page": index + 1,
            "words": len(page.get_text("words")),
            "rasterImages": len(page.get_images()),
            "minTextSizePt": round(min(s["size"] for s in spans), 2),
            "headingPreview": page.get_text().splitlines()[:2],
        }
    )
    page.get_pixmap(matrix=fitz.Matrix(1.4, 1.4)).save(
        output / f"page-{index + 1:02}.png"
    )
assert not report["outOfBoundsText"], report["outOfBoundsText"]
(output / "inspection.json").write_text(
    json.dumps(report, indent=2) + "\n", encoding="utf-8"
)
print(
    json.dumps(
        {
            "result": "PASS",
            "pages": len(doc),
            "requiredFirstThreePages": "correct",
            "outOfBoundsText": len(report["outOfBoundsText"]),
            "inspection": str(output),
            "scope": report["scope"],
        },
        indent=2,
    )
)
