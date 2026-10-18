# C01 closeout evidence — #132

Prepared 2026-10-18 at the PO's request. This is a documentation/metadata audit,
not a retrospective invention of Sprint Planning or a human approval.

- [Backlog reconciliation](../../sprint3-backlog-refinement.md)
- [Structured snapshot](snapshot.json): 43 work items, 27 complete P0 AC,
  dependency graph, actual PR/review/closed-issue receipts and unconfirmed fields.
- [Issue-body mutation receipts](issue-updates.json): state/assignee preserved,
  AC unchanged; actual hashes/timestamps, not a claim of approval.
- [Final API audit](final-issue-audit.json): all 43 Owner/Reviewer fields and
  dependency-code cleanup rechecked; all 27 original P0 AC and points unchanged.
  This later record includes the external T25 merge/closure during this work
  and subsequent reviewer-milestone clarifications, not just the first batch.
- [Original Planning image](../../images/sprint3/planning-board.png) and
  [iteration image](../../images/sprint3/iteration-board-snapshot.png).

## Recording boundary

Application main advanced during this work from C04 `0c4273a` to T25 merge
`4ff81ab30df8cf448c3796f748b9451496e403c5`. The branch was fast-forwarded before
its own commit; no unrelated changes are cherry-picked or republished as C01.
The backend/frontend verification below ran against the same unchanged product
application source; T25 additionally brought its acceptance tooling/evidence.

The main database was locked by a running process during a hash attempt. No
server was stopped, and no migration, import or seed was run against that DB.
Backend tests use `run_isolated_tests.py` and its disposable migrated database.
The private `.env` was not changed or committed. No new runtime dependency is added.

## Reproduce

```powershell
node scripts/verify-s3-c01-docs.mjs
git diff --check
$env:PYTHONUTF8 = '1'
.\.venv\Scripts\python.exe backend/scripts/run_isolated_tests.py -q
npm.cmd --prefix frontend test
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run build
```

## Actual local outcomes

| Check | Actual result |
|---|---|
| Backend isolated regression | 419 passed, 1 inherited skip, 1 inherited Starlette/httpx warning |
| Initial frontend regression | 235 passed, 1 failed: `movie-detail-rating.test.tsx:75` expected two fetch calls but observed one |
| Focused repeat of that test file | All 5 passed |
| Subsequent full frontend repeat | All 236 passed / 20 files |
| Frontend lint / production build | Both passed |
| Read-only docs validator | Run before publication; must print PASS |

Console transcripts are under [checks/](checks/). Only trailing spaces/EOF
blank lines and CRLF line endings are normalized for Git; failure outcomes
are retained. The docs validator also runs in the dedicated
`Sprint 3 C01 documentation` workflow without installing project dependencies.

The first failure is retained, not relabelled PASS. It did not reproduce in the
focused or full repeat; no definitive root cause is established by this audit.
No unrelated product/test behaviour fix was bundled into C01. Inspect final
branch CI and investigate separately if it reproduces.

## Human/repository checks not supplied by automation

The PO confirmed the real Sprint dates are 05–18 October; the board's old label
and both original image bytes are preserved. The PO identified the second
attachment as the start-of-sprint image; exact capture time is not visible.
The image is not filtered to Sprint 3, and the later iteration view does not
show all workflow columns. Private Project membership could not be enumerated
with the available API/browser access. No board/permission setting was changed.

Original availability/commitment and per-task historical target days are not
invented. T25/C04 merged state is distinct from final independent review; the
observed Kiet approvals alone do not establish contributor-independent final
sign-off. C01 remains open until its own review/merge and unresolved checklist
items have truthful evidence or an explicit documented resolution.

The old Sprint 1 C01 documents, C02-owned sprint log, C03/C05 final dossier and
ignored local `sprint/` plans are not rewritten by this change.
