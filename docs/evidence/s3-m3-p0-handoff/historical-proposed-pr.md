# Historical proposed title — superseded by handoff-pr.md

[#127] Record final M3 P0 acceptance and #136 handoff evidence

# Proposed PR description

Refs #127, #136, #135. No Story closure keywords.

Consolidates acceptance for application candidate
`86a758eb2468f3e23357b69adf3c3183e5110a40`. Reuses merged T12/T14/T16/T18/T21/
T22/T23/T24/T29 and rating/reset evidence, refreshes the real browser/API/SQLite
checks, and records all six P0 ACs plus separate S06/S09 results.

Adds a focused first-screen live handoff runner, allows the existing S13 live
runner to use a disposable backup of an accepted TMDb snapshot, and replaces
typed feature navigation in that live journey with visible links. Adds only
missing real-browser fallback/not-found and exact-error assertions to the
existing suites. Application source and production routes are unchanged.

Local results: 417 backend passes/1 inherited skip; 236 frontend passes; 10
synthetic browser passes/1 opt-in live skip; separate live S13 1 pass; existing
T12/T21/T22 verifiers pass; T16 integration 1 pass; runner cleanup 3 passes;
linters/build pass. Fresh-clone locked installs, migration to `c6f8a2d4e901`,
real TMDb import and first-screen browser smoke pass. The exact application
candidate has 11 successful hosted checks; these local acceptance additions
still need their own committed SHA, CI, independent approval and merge.

All Story statuses remain `partly works` until the final AC + DoD gate is
reviewed. Existing #44/#45 closures need PO reconciliation. No token, database,
dump, password or cookie is included. Reset is API-only; ratings do not rerank
Sprint 3 recommendations.

Evidence: [acceptance matrix, route map, reproduction and remaining gates](README.md).

# Independent reviewer checklist — pending

- Confirm the application matches the pinned SHA and inspect acceptance-source
  hashes; record this PR's actual committed SHA and check URLs after publication.
- Reproduce first-screen registration, guest detail/popular/login guards,
  cold-start → genres → save → recommendations → details → return.
- Inspect all five S13 ACs, API/database attack/reset/restart assertions,
  stale-response cases and exact Story messages.
- Check live provenance, synthetic separation, mobile keyboard/recovery and
  no credentials/database artifacts in the diff.
- Inspect C04 setup limitations and #136 address-bar/PDF requirements.
- Leave a substantive review comment, resolve findings, approve independently,
  then merge through the normal repository workflow.

PR URL, final branch CI, review comment/approval and merge: **not yet available**.
This file is review-ready material, not a claim that a review occurred.
