## Linked issue

Closes #189
Refs #136, #134, #127, #128, #131, #135 and #133.

Task #189 covers the reviewed M3 dossier draft/source milestone. The four PDF helpers were removed from the current PR file set at the PO's request; PDF preparation and LMS submission are manual. This change does not alter the existing C05 completion boundary or claim submission readiness.

## What changed

Reconcile the four-section M3 dossier with merged C03 main `bf18ab860fc3e486b57fc3b5ccac4db94c283995`, preserving the current nine-table ERD, separate historical M2 diagrams, nullable backdrop/CDN/local-read boundary, rating/reset contracts and bounded TMDb import. Keep six evidence-linked P0 rows, ten wireframes, four actual API error cases and the corresponding UI-driven design change in the same PR.

Fill the exact topic, five student IDs and submitter Nguyen Xuan Kiet supplied by the PO; retain PO @kietxuan and Sprint 3 SM @vu-huzy. Add three byte-for-byte PO attachments: submission-day board, S03 movie details and S13 incorrect-credentials error. Page 2 now contains both board images; page 3 contains two real browser-address-bar captures. Preserve the eight historical copies and keep global/unfiltered board counts distinct from velocity or issue closure.

Record original hashes, dimensions and provenance, with no invented capture timestamp or running-process SHA. Independently cross-check the pictured Spider-Man movie through the running API/frontend proxy and read-only SQLite: provider `tmdb`, 255 movies, revision `34b442f2-f5a8-4317-9f2f-468e6ec06a20`, stored popularity `1024.5071` displayed as `1024.51`. The visible sign-in error matches the `INVALID_CREDENTIALS` / HTTP 401 contract; no browser network transcript was supplied. Do not claim a new full acceptance run.

Read JSON/SVG as explicit UTF-8, normalize parser-test newlines on Windows, add token-free C05 documentation CI, and record follow-up validation separately from the historical T25/C04/C05 evidence. All 201 product/test and other unchanged historical paths still match. The one intentional Scrum metadata-workflow difference introduced by concurrent commit `b1529d5` is reported explicitly, with all six parser regression tests retained.

## How to test

After normal setup, run the retained Markdown/source checks. No PDF dependencies or export command are required:

```sh
python -X utf8=0 scripts/verify-m3-dossier.py
node scripts/verify-s3-c01-docs.mjs
python -m ruff check scripts/verify-m3-dossier.py
node --test scripts/scrum-linkage.test.mjs
```

On Windows, call the virtual-environment Python directly. The dossier verifier uses only the standard library. The four removed helpers have byte-identical local backup copies in an ignored folder; existing commits and historical test records are preserved.

## Evidence and current boundaries

- Dossier: `docs/ui.md`; images/wireframes: `docs/images/ui/`.
- Original follow-up: `docs/evidence/s3-c05-ui/follow-up.md` and `follow-up-validation.json`; new capture provenance/results: `supplied-captures.md` and `capture-validation.json` in the same directory.
- Initial hosted failure/rerun history is retained in `hosted-checks.md`; it is not relabelled as this candidate's CI.
- Source/structure checks verify four sections, six P0 rows, ten wireframes, four error cases, eight preserved copies and three supplied original PNGs.
- The earlier 19-page draft/layout checks in `capture-validation.json` remain historical results. Their PDF tools are no longer shipped in this PR; they are not current execution instructions or proof of a final submission.
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

A non-contributing teammate (for example Huy or Nguyen Tuan Anh) should use **Review changes**, leave a substantive question/finding, inspect the C03/C05 source reconciliation, resolve findings and approve the final head. Kiet contributes this follow-up and must not provide its independent approval.

This open PR delivers dossier source and retained validation checks for review, not a final submission. The tool removal does not supply independent review, acceptance or an LMS receipt.

## Author declaration

AI assistance: OpenAI Codex helped reconcile documentation, create the PO-authorized child Task, fix UTF-8 handling, add documentation checks, integrate the PO's unaltered screenshots, cross-check local data read-only, and render/inspect the draft. Contributors must review and explain the changes. No human acceptance result, browser chrome, approval, capture timestamp or submission receipt was invented.
