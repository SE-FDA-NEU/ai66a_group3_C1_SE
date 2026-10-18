## Linked issue

Refs #136; coordinates the UI/design reconciliation milestone in #134 and consumes #127/#128/#131/#135. C02 #133's Sprint 3 log/evidence milestone is still missing.

This draft does not close #136: final assets, substantive independent dossier review, merge, merged PDF export and LMS receipt are not complete. The current linkage workflow requires a closing keyword and will remain unsatisfied until closure is truthful. Do not add a closing keyword merely to make that check green.

## What changed

Replace stale Sprint 3 UI draft notes with the instructor's four-section M3 dossier: six evidence-linked P0 rows, separate P1 S06/S09 results, ten labelled wireframes (including all four recommendation states), four actual API-error mappings, and a matching design reconciliation. All eight Story statuses remain `partly works`; the accepted T25 evidence and its open human gates are preserved.

Add an updated M1 flow, unchanged copies of eight authentic evidence images, prerequisite GitHub/source-correspondence audits, and reproducible Markdown-to-PDF tooling. All 202 recorded T25 executable hashes match the merged documentation base. Actual later T25/C04 approvals and merges are linked without turning their `ok` review bodies into reproduction reports.

## Validation

From the repository root after the documented setup:

```sh
python scripts/verify-m3-dossier.py
node scripts/verify-s3-c01-docs.mjs
python -m ruff check scripts/render-m3.py scripts/inspect-m3-pdf.py scripts/verify-m3-dossier.py
python -m pip install -r scripts/m3-pdf-requirements.txt
node scripts/export-m3.mjs
python scripts/inspect-m3-pdf.py frontend/test-results/m3-dossier/Team03_M3.draft.pdf
```

Local results: dossier structure/links/copy hashes/202-source correspondence PASS; existing C01 validator PASS; changed Python helpers Ruff PASS; JS syntax PASS. A 19-page draft builds; pages 1–3 contain the required cover/board/application slots; PDF inspection finds no out-of-bounds text. Wireframes and representative text pages were visually inspected. The existing page-3 viewport previews are too small for final normal-scale screenshot assessment and lack browser chrome; final replacements must be reinspected. Full application acceptance is reused, not reported as rerun for this docs-only change. Initial sandbox Chromium launch and diagram screenshot attempts failed; PDF export was corrected to use headless printing and vector-to-PNG rendering, and the repeat passed.

## Preview and limitations

- Dossier: [docs/ui.md](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/blob/docs/s3-c05-ui-dossier/docs/ui.md).
- Flow and assets: `docs/images/ui/`; original-copy hashes in `asset-manifest.json`.
- Build/release instructions: `docs/evidence/s3-c05-ui/README.md`.
- PDF is a local ignored `Team03_M3.draft.pdf`, explicitly watermarked; final `Team03_M3.pdf` must be exported from the completed merged main.
- Missing cover values: five student IDs, exact assigned topic and actual submitter.
- Missing evidence: actual submission-day board; two final-candidate browser-chrome captures with real address bars; participant session details/per-journey outcomes; final #134 sign-off; C02 Sprint 3 log/minimum audit.
- Final human steps: substantive independent dossier review/approval, merge, final export/comparison with merged main, actual LMS deadline/submission/receipt. No such completion is asserted.

## Reviewer focus

A teammate who did not author these changes should check the evidence boundary and exact source SHAs, all P0 rows/P1 separation, API error copy against the current components, wireframe/flow accuracy, same-PR design explanation, and PDF pagination. Record a substantive finding/question using Review changes, resolve it and then approve the final head. Do not treat this checklist or an AI audit as the actual review.

## Author declaration

AI assistance: OpenAI Codex inspected local/GitHub evidence, authored the dossier, wireframes, design reconciliation and export utilities, and executed the documented checks. No teammate review, historical image, acceptance outcome or LMS receipt was generated on anyone's behalf.
