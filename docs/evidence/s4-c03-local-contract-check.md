# S4-C03 local contract check — 2026-10-24

Historical author-side snapshot recorded **before** local commits
`bdc4ac2` and `932a952`. Its raw-file check and 157.94s backend run
remain historical observations, not verification of the corrected candidate.
Use the [current acceptance matrix](s4-c03-acceptance-matrix.md) for
normalized-LF hashes, LF/CRLF export results and review status.

This is local author evidence for the proposed [C03 contract](../api.md#13-sprint-4-c03-implementation-contract-planned-not-delivered).
The source candidate was working-tree base
`3078a9c6fd3dff1f0b8576bc7411f469c7a98fdf` plus uncommitted
documentation changes. It is **not** a committed tested SHA, independent
review, approval, PR, or issue closure. GitHub's live issue could not be
queried from this environment; the user-supplied 24 October issue text and
tracked Sprint 3 contracts were the specification inputs.

| Check | Command / method | Actual observed result | Limit |
|---|---|---|---|
| Whitespace | `git diff --check` | Exit 0, no output. | Checks tracked diff; new file syntax was inspected separately. |
| Local links / four headings / case IDs | Read-only Python parser over `docs/api.md`, `architecture.md`, `design.md`, `testing.md` | No missing local link targets; main headings `1,2,3,4`; 35 unique P0 IDs: S01 8, S02 6, S03 4, S04 6, S12 5, S13 6. | Checks shape and path existence, not an independent content review or executed new case. |
| Current backend regression | `.\.venv\Scripts\python.exe backend/scripts/run_isolated_tests.py -q backend/tests/test_catalogue_pagination.py backend/tests/test_profile_reset_api.py backend/tests/test_nlp_spike.py` from repo root | Runner migrated a disposable SQLite DB through `c6f8a2d4e901`; `447 passed, 1 skipped, 1 warning in 157.94s (0:02:37)`; exit 0. Warning was Starlette TestClient/httpx deprecation. | The runner always includes all `backend/tests`, so this was the full existing backend suite. It does not execute future S4 routes, root `tests/`, React/browser UI, live TMDb smoke or the new Section 2 TC-IDs. |

No new feature implementation, P0 root-suite pass, mutation failure/restore,
human reviewer action or accepted live-catalogue provenance is inferred
from this run. Reviewer and final selected-executable evidence remain open.

The [requirement-to-artifact matrix](s4-c03-acceptance-matrix.md) records
the reproducible C03 document checks and the pending review status.
