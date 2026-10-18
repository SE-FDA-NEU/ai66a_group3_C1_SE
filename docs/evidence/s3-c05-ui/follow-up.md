# C05 PR #188 follow-up — 2026-10-18

This is a documentation/tooling reconciliation, not an M3 submission or a new
application acceptance run. The PO authorized one follow-up commit and child
Task [#189](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/189).
PR #188 may close that reviewed draft/tooling Task after merge; parent
[#136](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/136) stays open
until actual final export and submission evidence exist.

## Reconciliation boundary

- Head at the start of this request: `2aa593764065e8ae1c67f5259e7c1dce56d32705`.
- Concurrent remote commit `b1529d510870310f33ede7761b13a993cb5696a4`
  arrived before this follow-up was committed. It is preserved as the parent
  of the single new commit; no remote history is rewritten.
- That concurrent commit already integrates main
  `bf18ab860fc3e486b57fc3b5ccac4db94c283995` (merged C03 PR #187), and adds
  explicit non-closing issue-reference parsing plus six regression tests.
  Its workflow and conflict/linkage evidence remain intact. The same six
  actual-parser tests are retained; their reader normalizes CRLF to LF so the
  inline-script extraction also works on Windows.
- Preserve C03's nine-table ERD, migration head `c6f8a2d4e901`, separate
  historical `*-m2` diagrams, nullable backdrop and public image-CDN boundary,
  rating/reset contracts, and 1–15-page bounded import.
- Retain the four-section C05 dossier and add its preference-persistence/UI
  rationale to the current design in the same PR.
- Keep historical `github-state.json`, `verification.json` and `validation.json`
  at their original recorded candidate/date. Do not relabel them as this run.
- The original source manifest has 202 paths. Current verification reports
  201 matches and the one explicit Scrum-workflow difference from `b1529d5`;
  product/test fingerprints are not exempted or silently changed.
- Current source/structure/PDF checks are recorded separately in
  [follow-up-validation.json](follow-up-validation.json). The later committed
  head needs its own hosted checks and independent review.

## Supplied facts and remaining human evidence

The PO supplied the exact topic **AI Movie Recommendation System** and these
IDs in chat on 2026-10-18: Nguyen Xuan Kiet 11247306, Tran Minh Hoang 11247292,
Tran Tuan Anh 11247264, Vu Quoc Huy 11247301, Nguyen Tuan Anh 11247260.
These values are copied into the cover, not inferred from survey participants.

| Item | State / required owner action |
|---|---|
| Actual LMS submitter | Not supplied; PO/team must name the actual person |
| Submission-day board | Not supplied; PO/SM supplies an original dated capture with Sprint 3 filter/workflow columns |
| Page 3 P0 and error captures | Still genuine reused previews without address bars; team supplies two final-candidate browser-chrome captures and provenance |
| Trang's unaided session | PO confirmed occurrence; actual tested version, date and per-journey outcomes still needed |
| C03 | #134 closed, PR #187 merged at `bf18ab8`; observed Kiet approval is on earlier head `9e444ad`, not their own follow-up `95ab003`; final-head non-contributor review not inferred |
| C02 Sprint 3 log/minimum audit | Not available in integrated main; SM supplies the log/evidence milestone without inventing original commitment or outcomes |
| C05 review | A non-contributing teammate must leave substantive feedback and approve this final candidate |
| Final PDF / LMS | Not performed; export completed merged source only, inspect it, submit by actual LMS deadline and retain receipt |
| Project iteration for #189 | Body plans Sprint 3; private Project membership/iteration is not independently verified and must be checked by PO |

The eight source image copies remain byte-identical. No new address bar,
historical board, participant result, password, token or receipt is created.
Larger page-3 image slots improve draft layout but do not turn the previews
into valid submission evidence. Use a disposable environment to trigger an
error for the real replacement capture; do not damage the shared database.

## Local reproduction

After the normal application setup, install the documentation-only pinned
dependencies from `scripts/m3-pdf-requirements.txt`. No provider credential or
shared database is needed for these checks.

```sh
python -X utf8=0 scripts/verify-m3-dossier.py
node scripts/verify-s3-c01-docs.mjs
python -m ruff check scripts/render-m3.py scripts/inspect-m3-pdf.py scripts/verify-m3-dossier.py
node --check scripts/export-m3.mjs
node --test scripts/scrum-linkage.test.mjs
node scripts/export-m3.mjs
python scripts/inspect-m3-pdf.py frontend/test-results/m3-dossier/Team03_M3.draft.pdf
```

All JSON/SVG text reads now specify UTF-8. The new documentation CI repeats
the token-free structural/source checks and helper lint. `--final` must still
reject the draft/non-main/incomplete release; that rejection is expected,
not an application failure. No parent Story is closed or awarded points here.
