# S4-T11 local evidence — early implementation, not final approval

Refs [#206](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/206), parent
[S11 #33](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/33).
Date: 2026-10-24 (Asia/Saigon). Implementation base:
`3078a9c6fd3dff1f0b8576bc7411f469c7a98fdf`.

PO authorized early implementation and push, but no merge before C03 #217 is
merged/reconciled. Planned independent reviewer: @anotify-vie. Independent
review, final GitHub CI, complete S11 UI/watchlist acceptance and C03 approval
are **pending**, not claimed by this author-assisted local evidence.

## Baseline and real RED/GREEN

- Unchanged main backend baseline: **447 passed, 1 skipped**, one existing
  Starlette/httpx deprecation warning (134.31 seconds).
- The existing reset suite contains 28 tests; its original fixture used A1/1.
  It is strengthened to A3/2 while retaining B1/1 and all original assertions.
- After fixing an initial synthetic seed's missing required timestamp (setup
  error, **not** counted as RED), three actual production request assertions
  failed because the first SQL in reset/preferences/rating was session SELECT,
  not `BEGIN IMMEDIATE`. This is the intended missing reservation behavior,
  not an import/syntax failure.
- After implementing the shared reservation, those assertions passed; expanded
  real-file, real-API rollback/concurrency and boundary coverage follows.

## Final executions

Executable/source snapshot tested:
`9ee2f7039319e4fa38a525c231a3e0e8e71d7fa5`. The remaining commits in this
delivery only document these changes; they do not change backend code/tests.
Runtime: Python **3.12.6**, SQLite **3.45.3**, SQLAlchemy **2.1.1**.

| Executed check | Observed result |
| --- | --- |
| Focused reset concurrency, transaction boundary and original reset API suites | **76 passed**, 10.66s |
| New concurrency/boundary suites, three consecutive runs | **48 passed** each; 4.80s / 4.33s / 4.26s |
| Focused suites plus personalised recommendations API regression | **106 passed**, 18.77s |
| Entire isolated backend suite | **495 passed, 1 skipped**, 131.27s |
| Backend Ruff | Passed |
| Frontend unit regression on the main-based UI | **232 passed**, 22 files, 21.86s |
| Existing T16 / T33 frontend integration suites | **1 passed** each, 5.08s / 6.14s |
| Existing S04/S13 browser verifier | **10 passed, 1 skipped**, 17.7s; separate live-TMDb mode intentionally skipped |
| Existing T28 offline browser verification | **18 cases passed**; temporary database removed |
| Frontend lint and production build | Passed; 57 modules transformed |
| Whitespace and changed-file credential checks | Passed; no `.env`, database, real token or T01 changes included |

The Python runs still report the existing Starlette/httpx deprecation warning;
this is not a new failing test. Frontend lint/unit commands exclude ignored local
`test-results`/`playwright-report` artifacts so earlier local review copies are
not collected as application code. No frontend configuration/source was changed.
The 232-unit-test result is for this main-based branch, not the separate T01 UI
redesign branch.

### Regression corrections and effectiveness check

The first expanded regression runs exposed old fixtures that reused one Session
across requests without ending a read transaction. A prior GET could therefore
leave a physical read transaction active for a later PUT/POST, unlike production
request-local sessions. Both reset and personalised-recommendation test fixtures
now roll back at request teardown. All original business assertions remain;
none were removed or relaxed to obtain GREEN.

To verify that account-isolation evidence detects a real defect, the author
temporarily removed the current-user predicate from the rating DELETE **only
against a disposable test database**. The exact A3/2 reset case failed (1.86s):
B's expected `([18], [('movie-c', 3)])` became `([18], [])`. The predicate was
immediately restored; the same test passed (1.67s), and the production profile
repository has no diff and is not part of this delivery. This is a deliberate
mutation check, not a defect left in the implementation or a claim of independent
review. The final complete backend run above used the restored source snapshot.

Concurrency tests observe actual SQL reservation and committed row values across
independent connections; a separate Python process also holds a real SQLite
writer reservation. Event/pipe handshakes coordinate the tests without sleeps.
Both save-before-reset and reset-before-save orders pass in DELETE and WAL test
modes. Mid-delete/commit failures roll back, and bounded lock failures return
503 without partial changes; a subsequent retry after release succeeds.

## Data safety and scope

All new tests use isolated migrated file SQLite databases and synthetic users,
movie data and tokens, with a controlled auth clock. DELETE/WAL modes are test
parameters, not changes to the user's database. Runtime keeps the existing
journal mode and uses a 5-second busy timeout. Separate-process contention tests
use a 50ms override on their disposable databases. No live TMDb/token is needed.

The original `.env`, accepted 255-movie TMDb database, accounts, ratings and media
are not modified, copied into Git or used as reset test targets. The T01 branch
and PR #220 are not included in this branch. T11 has no schema migration, import,
frontend feature or duplicated reset endpoint. Runtime still reads the existing
TMDb-imported local catalogue.

Preservation tests compare actual rows/values of users, auth sessions, catalogue
state/revisions, movies (including backdrop), genres and movie genres, and B's
exact personalisation. Reset only deletes A genres/ratings. There is no index
rebuild/delete call. The future product index and migrated watchlists do not yet
exist on this base: their real compatibility tests remain with their owners,
not falsely claimed here.

## Reproduce

After locked backend setup, from repo root:

```powershell
$env:PYTHONUTF8 = "1"
.\.venv\Scripts\python.exe -m pytest backend/tests/test_profile_reset_concurrency.py backend/tests/test_account_write_transactions.py backend/tests/test_profile_reset_api.py -v
.\.venv\Scripts\python.exe backend/scripts/run_isolated_tests.py -q
.\.venv\Scripts\python.exe -m ruff check backend
git diff --check
```

No running Uvicorn/frontend or TMDb token is required. Tests create and remove
their own databases. Do not manually POST reset on a real user's account merely
to produce evidence. `--collect-only -q` on the same test paths lists concrete
case/parameter nodes; commands above must actually execute them for acceptance.

UI cancel/no-request, exact rendered success copy, summary, ambiguous-timeout
reconciliation, generation invalidation, later login and real watchlist
preservation are explicitly handed to #207/#208/#209/#210. See the
[contract and downstream handoff](../reset-concurrency-contract.md).
