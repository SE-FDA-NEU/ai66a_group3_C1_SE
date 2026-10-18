## Linked issue

Closes #189
Refs #136, #134, #127, #128, #131, #135 and #133.

Task #189 covers the reviewed M3 dossier draft/source and export-tooling milestone only. Parent C05 #136 stays open for completed human/C02 evidence, independent review, merged final PDF, LMS submission and receipt. The actual submitter and original board/application images have now been supplied. This PR does not claim submission readiness.

## What changed

Reconcile the four-section M3 dossier with merged C03 main `bf18ab860fc3e486b57fc3b5ccac4db94c283995`, preserving the current nine-table ERD, separate historical M2 diagrams, nullable backdrop/CDN/local-read boundary, rating/reset contracts and bounded TMDb import. Keep six evidence-linked P0 rows, ten wireframes, four actual API error cases and the corresponding UI-driven design change in the same PR.

Fill the exact topic, five student IDs and submitter Nguyen Xuan Kiet supplied by the PO; retain PO @kietxuan and Sprint 3 SM @vu-huzy. Add three byte-for-byte PO attachments: submission-day board, S03 movie details and S13 incorrect-credentials error. Page 2 now contains both board images; page 3 contains two real browser-address-bar captures. Preserve the eight historical copies and keep global/unfiltered board counts distinct from velocity or issue closure.

Record original hashes, dimensions and provenance, with no invented capture timestamp or running-process SHA. Independently cross-check the pictured Spider-Man movie through the running API/frontend proxy and read-only SQLite: provider `tmdb`, 255 movies, revision `34b442f2-f5a8-4317-9f2f-468e6ec06a20`, stored popularity `1024.5071` displayed as `1024.51`. The visible sign-in error matches the `INVALID_CREDENTIALS` / HTTP 401 contract; no browser network transcript was supplied. Do not claim a new full acceptance run.

Read JSON/SVG as explicit UTF-8, normalize parser-test newlines on Windows, add token-free C05 documentation CI, and record follow-up validation separately from the historical T25/C04/C05 evidence. All 201 product/test and other unchanged historical paths still match. The one intentional Scrum metadata-workflow difference introduced by concurrent commit `b1529d5` is reported explicitly, with all six parser regression tests retained.

## How to test

After normal setup, install the pinned documentation-only dependencies:

```sh
python -m pip install -r scripts/m3-pdf-requirements.txt
python -X utf8=0 scripts/verify-m3-dossier.py
node scripts/verify-s3-c01-docs.mjs
python -m ruff check scripts/render-m3.py scripts/inspect-m3-pdf.py scripts/verify-m3-dossier.py
node --check scripts/export-m3.mjs
node --test scripts/scrum-linkage.test.mjs
node scripts/export-m3.mjs
python scripts/inspect-m3-pdf.py frontend/test-results/m3-dossier/Team03_M3.draft.pdf
```

On Windows, set `M3_PYTHON` to the intended Python environment and `M3_BROWSER_PATH` if using an installed Chromium/Edge. The README explains isolated-target dependencies and `PYTHONPATH`.

## Evidence and current boundaries

- Dossier: `docs/ui.md`; images/wireframes: `docs/images/ui/`.
- Original follow-up: `docs/evidence/s3-c05-ui/follow-up.md` and `follow-up-validation.json`; new capture provenance/results: `supplied-captures.md` and `capture-validation.json` in the same directory.
- Initial hosted failure/rerun history is retained in `hosted-checks.md`; it is not relabelled as this candidate's CI.
- Source/structure checks verify four sections, six P0 rows, ten wireframes, four error cases, eight preserved copies and three supplied original PNGs. PDF inspection requires two board images on page 2 and two application images on page 3; see `capture-validation.json` for the actual latest build/layout results.
- Latest local draft: 19 pages, required pages 1-3 correctly placed, two images each on pages 2 and 3, zero out-of-bounds text. Cover/new captures and remaining-page layout inspected. The final-mode guard correctly refuses this unmerged draft.
- No new full application acceptance run is claimed for these docs-only changes. Current hosted checks must pass on the pushed follow-up head.
- Remaining work: Trang's actual session details, final-head non-contributor C03 review, C02 Sprint 3 log/minimum audit, instructor board access, substantive final-head C05 review/merge, final export and LMS receipt. Exact screenshot capture times/running-process version remain unprovided; do not infer them from clipboard-file timestamps or the current workspace HEAD.
- Story statuses remain `partly works` pending the real AC/DoD gates; no Story points or submission outcomes are invented.

## Screenshot / output

Original PO-supplied movie-detail capture:

![S03 movie details with actual browser address bar](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/blob/docs/s3-c05-ui-dossier/docs/images/ui/p0-movie-detail-browser.png?raw=true)

Original PO-supplied incorrect-credentials capture:

![S13 sign-in error with actual browser address bar](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/blob/docs/s3-c05-ui-dossier/docs/images/ui/login-error-browser.png?raw=true)

The submission-day board and all original asset hashes are in `docs/images/ui/asset-manifest.json`. No image pixels were changed. Local PDF previews remain draft review artifacts, not an LMS submission.

## Reviewer

A non-contributing teammate (for example Huy or Nguyen Tuan Anh) should use **Review changes**, leave a substantive question/finding, inspect the C03/C05 reconciliation and PDF, resolve findings and approve the final head. Kiet contributes this follow-up and must not provide its independent approval.

This open PR delivers draft/source/tooling for review, not a final submission. Merging that milestone closes #189 via its closing keyword, but does not close parent #136. Do not manually close #189 before its substantive independent review, passing CI and actual merge.

## Author declaration

AI assistance: OpenAI Codex helped reconcile documentation, create the PO-authorized child Task, fix UTF-8 handling, add documentation checks, integrate the PO's unaltered screenshots, cross-check local data read-only, and render/inspect the draft. Contributors must review and explain the changes. No human acceptance result, browser chrome, approval, capture timestamp or submission receipt was invented.
