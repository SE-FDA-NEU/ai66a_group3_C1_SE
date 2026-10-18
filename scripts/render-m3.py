"""Render authoritative Markdown into a print document; requires Markdown and PyMuPDF."""

import argparse
import hashlib
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlsplit

import markdown
import pymupdf

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--output", type=Path, required=True)
parser.add_argument("--diagram-pdf", type=Path)
args = parser.parse_args()
if args.diagram_pdf:
    diagram = pymupdf.open(args.diagram_pdf)
    diagram[0].get_pixmap(matrix=pymupdf.Matrix(2, 2)).save(args.output)
    sys.exit(0)
source = ROOT / "docs/ui.md"
sha = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
text = source.read_text(encoding="utf-8")
sections = text.split("<!-- pdf:page -->")
blocks = []
for index, section in enumerate(sections):
    content = markdown.markdown(
        section,
        extensions=["tables", "fenced_code", "sane_lists"],
        output_format="html",
    )

    def repo_link(match):
        target = match.group(1)
        if urlsplit(target).scheme or target.startswith("#"):
            return match.group(0)
        relative, _, fragment = target.partition("#")
        local = (ROOT / "docs" / relative).resolve().relative_to(ROOT).as_posix()
        return (
            'href="https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/blob/main/'
            + local
            + ("#" + fragment if fragment else "")
            + '"'
        )

    content = re.sub(r'href="([^"]+)"', repo_link, content)
    blocks.append(f'<section class="sheet sheet-{index + 1}">{content}</section>')
css = """
@page { size: A4; margin: 14mm 14mm 18mm; }
* { box-sizing: border-box; }
body { color: #172033; font: 10pt/1.4 Arial, sans-serif; margin: 0; }
h1 { font-size: 27pt; line-height: 1.15; margin: 4mm 0; color: #182c4a; }
h2 { font-size: 20pt; line-height: 1.2; margin: 0 0 5mm; color: #182c4a; }
h3 { font-size: 14pt; line-height: 1.25; margin: 4mm 0 3mm; color: #182c4a; }
p { margin: 2.5mm 0; orphans: 3; widows: 3; }
a { color: #124e91; overflow-wrap: anywhere; text-decoration: underline; }
code { font: 8.5pt/1.35 Menlo, monospace; overflow-wrap: anywhere; }
table { width: 100%; border-collapse: collapse; margin: 4mm 0; table-layout: auto; font-size: 8.5pt; }
th, td { border: 1px solid #cbd5e1; padding: 2mm; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
th { background: #e8eef6; overflow-wrap: normal; word-break: normal; }
thead { display: table-header-group; }
tr, img, h2, h3 { break-inside: avoid; }
h2, h3 { break-after: avoid; }
li { margin-bottom: 2mm; }
img { display: block; max-width: 100%; height: auto; margin: 3mm auto; }
img[src$=".svg"] { width: 100%; max-height: 174mm; object-fit: contain; }
.sheet { break-after: page; }
.sheet:last-child { break-after: auto; }
.sheet-1 { font-size: 9.5pt; }
.sheet-2 img { max-height: 98mm; object-fit: contain; }
.sheet-3 { font-size: 9pt; line-height: 1.3; }
.sheet-3 img { width: 100%; max-height: 98mm; object-fit: contain; }
.sheet-3 h3 { font-size: 13pt; }
.sheet-3 p { margin: 2mm 0; }
"""
# file:// assets are local, immutable copies; no remote JS/fonts/styles are loaded.
rendered = (
    '<!doctype html><html lang="en"><head><meta charset="utf-8">'
    f'<base href="{(ROOT / "docs").as_uri()}/">'
    "<title>Team03 M3 dossier</title>"
    f"<style>{css}</style></head><body>" + "".join(blocks) + "</body></html>"
)
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(rendered, encoding="utf-8")
print(f"Rendered {len(sections)} source sheets from docs/ui.md; HEAD {sha}")
print(f"Markdown SHA-256 {hashlib.sha256(source.read_bytes()).hexdigest()}")
