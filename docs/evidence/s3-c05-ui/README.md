# C05 #136 — UI dossier build and evidence boundary

This package contains authoritative [docs/ui.md](../../ui.md), matching
[design reconciliation](../../design.md), ten labelled SVG wireframes, an
updated M1 flow, and eight byte-for-byte evidence-image copies under
[docs/images/ui](../../images/ui/asset-manifest.json), plus three original
PO-supplied submission images. The wireframes are
schematics; they are never presented as running-application captures.

[verification.json](verification.json) compares all 202 recorded T25
executable-file hashes with merged base
`f9774cbe7248c29915086d29bf2b9f99c2aa528a`, CRLF→LF only. Its pass is source
correspondence, not a new live acceptance run. [github-state.json](github-state.json)
records the actual prerequisite issue/PR/review/check snapshot. Historical
T25/C04 files are retained unchanged; their then-pending reviews have later
formal approvals linked in the dossier. Review bodies saying `ok` do not
establish a detailed reproduction report or approve this new dossier.

[Hosted-check history](hosted-checks.md) preserves the initial PR unit-test
failure, passing branch build and targeted replay without changing product/tests.

[validation.json](validation.json) records the actual local structural/source,
syntax/lint and PDF layout checks, including draft limitations.

The original records above describe their original candidate. The later
[follow-up](follow-up.md) reconciles merged C03 PR #187, inserts the topic/IDs
supplied by the PO, and records new checks in
[follow-up-validation.json](follow-up-validation.json). It does not rewrite
historical results or claim a final submission.

## Task and submission boundary

PR #188 closes child [Task #189](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/189)
only after its draft/source/tooling changes pass CI and actual independent
review and are merged. It continues to reference parent
[#136](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/136), which stays
open for the remaining acceptance/review evidence, final merged PDF and LMS
receipt. This avoids falsely closing a post-merge submission obligation just
to satisfy the issue-linkage check. The PO must verify #189's Sprint 3 Project
iteration; private-board membership is not assumed from the issue body.

## Build the review draft

Use the repository's locked frontend dependencies and installed Playwright
Chromium. Documentation-only Python tools are pinned separately:

```sh
python -m pip install -r scripts/m3-pdf-requirements.txt
python -X utf8=0 scripts/verify-m3-dossier.py
node scripts/export-m3.mjs
python scripts/inspect-m3-pdf.py frontend/test-results/m3-dossier/Team03_M3.draft.pdf
```

`M3_PYTHON` can select another Python executable; `M3_BROWSER_PATH` can select
an installed Chromium browser. The exporter uses the current repository
`.venv/bin/python` on macOS/Linux when available. On Windows set `M3_PYTHON`
to `.venv\Scripts\python.exe` if `python` is not the intended environment.
If documentation packages were installed into a temporary target, set
`PYTHONPATH` to it. Application requirements and lockfiles are unchanged.

The Python renderer reads **docs/ui.md only** for document content. Markdown
page markers reserve cover/page 2/page 3; CSS, pagination and the SHA footer
are formatting, not separately authored dossier text. External network
requests are blocked during rendering. The exporter writes ignored HTML,
`Team03_M3.draft.pdf` and an export manifest under
`frontend/test-results/m3-dossier/`. It also renders the authored SVG flow to
an ignored PNG that can be copied to `docs/images/screen-flow.png`.
The page previews produced by inspection are renders of the PDF, not
application screenshots or new acceptance evidence.

## Draft limits and final export

The draft keeps a visible draft status and footer on every page. It must not
be uploaded as the final submission merely because no placeholder marker is
left. Page 2 now contains the original planning board and PO-identified
submission-day board. Both show global, unfiltered counts, not Sprint 3
velocity. Page 3 uses two new PO-captured PNGs with actual browser address
bars: S03 movie details and the S13 incorrect-credentials error. Historical
viewport previews remain preserved but are not the page-3 submission images.

The exact topic, five student IDs, roles and actual submitter are filled from
the PO's supplied facts. [Supplied-capture provenance](supplied-captures.md)
records hashes, visible URLs/message, limitations and a read-only local
API/SQLite cross-check of the pictured movie against the 255-film TMDb revision.
Exact browser capture times and the running process's SHA were not supplied;
clipboard-file times and the workspace head are not substituted for them.
The PO/SM must still verify instructor access to the private Project board.
Preserve the original pixels; never draw browser chrome or relabel a historic
capture as a later candidate. Reconfirm applicability if executable code changes.

Participant session details, C02 log/minimum audit and the outstanding
final-head non-contributor C03 review remain unrecorded. The C03 reconciliation
itself is already merged. No source edit or image can substitute for those
human outcomes. Re-run the structural check and inspect every rendered page
after changes. The latest capture/layout checks are recorded separately in
[capture-validation.json](capture-validation.json), not in the historical
follow-up results.

Before final export, obtain a substantive independent teammate review,
resolve findings, receive approval and merge this documentation PR into
`main`. An initial/old-head approval does not approve later changes.
From an updated **clean merged main**, create a reviewed
`docs/evidence/s3-c05-ui/release.json` record with real evidence references:

- `mergedDocumentationPr`: actual merged dossier PR URL;
- `independentReviewUrl`: substantive non-contributor review/approval record;
- `acceptanceRecord`: exact executed candidate, manifest correspondence,
  current hosted checks and completed human acceptance record;
- `wrapUpRecord`: C02's actual Sprint 3 log/evidence milestone and minimum audit;
- `finalCandidateCaptureRecord`: both address-bar captures, board capture and provenance.

That record is evidence to inspect, not an approval generated by the exporter.
Merge the completed record/source/assets, remove only resolved placeholders,
and change the authoritative submission-status line truthfully. Fetch origin,
check out the merged main, verify that the executable tested-source manifest
still matches (or run/accept a new candidate if application code changed), and run:

```sh
python scripts/verify-m3-dossier.py
node scripts/export-m3.mjs --final
python scripts/inspect-m3-pdf.py Team03_M3.pdf
```

Final mode refuses a dirty/non-main checkout, a mismatch with `origin/main`,
missing human markers/draft status or an incomplete release record. It writes
`Team03_M3.pdf` at repository root and records source/PDF hashes and the merged
HEAD in the ignored export manifest. The output should be an external release
artifact; do not amend the source commit merely to put its own SHA in itself.
Manual inspection must verify text, all images/links, actual review/capture
records and correspondence with the merged SHA; the exporter cannot certify
independent review or submission. Confirm the real LMS deadline, submit and
save the actual receipt. These final steps remain pending.

## Conflict and linkage follow-up

The follow-up merges current main after C03 PR #187, preserving its corrected
API/architecture/ERD/runbook and the four-section C05 dossier. It fixes the
Scrum hygiene linkage job to accept `Refs #136` and issue-prefixed titles.
The same issue-existence/type/owner inspection runs for those references; no
closing directive is required for partial delivery. Six regression cases
execute the actual inline Actions parser via
`node --test scripts/scrum-linkage.test.mjs`, also run by the linkage job.

The 202-path original audit remains historical. The current checker explicitly
reports the intentional `.github/workflows/scrum-check.yml` difference, while
all other 201 historical paths (including product and tests) must still match.
The review job and its real non-author approval requirement are unchanged.
The initial inspection found no submitted reviews; a later @kietxuan approval
covers an earlier head and Kiet contributes follow-up changes. Neither supplies
substantive non-contributor approval of the final head. The UI/design conflict resolution is not itself
a merge of the dossier into main or a final PDF/LMS completion claim.

The PO-authorized Task #189 remains a useful draft/tooling delivery boundary
even though the concurrent metadata parser now also accepts non-closing
references. This follow-up preserves that parser and its regression tests;
it does not replace or weaken the approval job.
