# C05 compact M4 and recovery verification — 1 November 2026

PR [#243](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/243),
Refs [#219](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/219).
This record supersedes the default-test-scope statements in the historical
[C05 rehearsal](README.md), without changing its original logs or counts.

## Scope and findings

- Default `pytest` selects only the two P0 files (37 logical IDs, 40 items).
  Extended backend/frontend/browser/script regressions are retained as explicit
  opt-ins. CI still runs mandatory P0, traceability, lint/build and secrets.
- The case map now checks the actual default collection; bootstrap regressions
  prove unrelated tests are excluded and inherited real DB/index settings are
  untouched, including when collection fails.
- Restore formerly ignored a destination's hot `-journal`. SQLite could replay
  the old journal over a valid restored snapshot on its first open. The fix
  refuses DB/WAL/SHM/rollback-journal destinations before copying and again
  before publication; the destination must remain reserved from other writers.
- Two real crashed-writer regressions fail on the old executable `42a29d4`.
  Their control opens prove old data is replayed, and the corrected restore
  must fail without touching the source, saved old DB or journal.
  [Old-code red output](checks/compact-storage-red.log). This is bug reproduction,
  not a claim of test-before-feature TDD.

## Final-candidate verification

Pending the committed candidate's clean clone, locked installation, plain and
verbose pytest, focused storage/bootstrap/doc checks, startup/recovery, build
and live TMDb provisioning. Actual results will be appended after execution.
The current edit itself claims no independent teammate review or submission.

## Acceptance boundaries

Runtime catalogue provisioning is a manual networked operator step, separate
from token-free pytest and CI. Use a new temporary database, never the user's
existing catalogue. Tokens and database/backups are excluded from evidence.
Local release rehearsal does not claim a cloud deployment. Independent teammate
review/approval and its own reproduction remain required before C05 closes.
C04 owns final board/verbose-output screenshots, report approval and manual PDF
submission; no generated PDF/export tool is added here.
