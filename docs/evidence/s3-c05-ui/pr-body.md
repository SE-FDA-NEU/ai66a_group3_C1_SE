## Linked issue

Closes #189
Refs #136, #134, #127, #128, #131, #135 and #133.

Task #189 covers the reviewed M3 dossier draft/source and export-tooling milestone only. Parent C05 #136 stays open for the actual submitter, final board/application captures, completed human/C02 evidence, merged final PDF, LMS submission and receipt. This PR does not claim submission readiness.

## What changed

Reconcile the four-section M3 dossier with merged C03 main `bf18ab860fc3e486b57fc3b5ccac4db94c283995`, preserving the current nine-table ERD, separate historical M2 diagrams, nullable backdrop/CDN/local-read boundary, rating/reset contracts and bounded TMDb import. Keep six evidence-linked P0 rows, ten wireframes, four actual API error cases and the corresponding UI-driven design change in the same PR.

Fill the exact topic and five student IDs supplied by the PO. Keep the actual submitter and genuine final capture/session/submission gaps explicit. Preserve all eight authentic evidence copies. Improve draft page-3 image sizing without manufacturing address bars or claiming the previews meet submission requirements.

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
- Follow-up and actual local results: `docs/evidence/s3-c05-ui/follow-up.md` and `follow-up-validation.json`.
- Initial hosted failure/rerun history is retained in `hosted-checks.md`; it is not relabelled as this candidate's CI.
- Local source/structure checks, UTF-8-disabled verifier, helper lint and JavaScript syntax pass. Draft PDF builds to 19 pages; required first three pages and text bounds pass.
- No new full application acceptance run is claimed for these docs-only changes. Current hosted checks must pass on the pushed follow-up head.
- Remaining human work: actual submitter, final submission-day board, two final-candidate address-bar images, Trang's actual session details, final-head non-contributor C03 review, C02 Sprint 3 log/minimum audit, substantive C05 review, final export and LMS receipt.
- Story statuses remain `partly works` pending the real AC/DoD gates; no Story points or submission outcomes are invented.

## Reviewer

A non-contributing teammate (for example Huy or Nguyen Tuan Anh) should use **Review changes**, leave a substantive question/finding, inspect the C03/C05 reconciliation and PDF, resolve findings and approve the final head. Kiet contributes this follow-up and must not provide its independent approval.

This PR remains a draft until the team deliberately reviews the draft/tooling milestone. Merging that milestone does not close parent #136.

## Author declaration

AI assistance: OpenAI Codex helped reconcile documentation, create the PO-authorized child Task, fix UTF-8 handling and add documentation checks, render/inspect the draft and record the real results. Contributors must review and explain the changes. No human acceptance result, browser chrome, approval or submission receipt was invented.
