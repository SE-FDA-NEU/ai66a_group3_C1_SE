# S4-T17 (#212): recommendation genre filtering after rating reranking

Executed 2026-10-27 (Asia/Ho_Chi_Minh). Scope: the supplied genre-filter
regression task, including post-M3 pagination and account/return isolation.
Only tests, test fixtures/transport and evidence changed. No production code,
ranking rule, preference storage or API contract changed.

## Inspected implementation and reused tests

- T03 #198: merged through `e223847`, implementation `c4fda1a`;
  `build_account_recommendations` derives the complete session owner's eligible
  set, calls the existing ranker, applies the view genre, then slices the page.
- T04 #199: merged PR #231 at `a478bb0`; a committed rating save advances
  `recommendationVersion` while retaining navigation scope. Recommendations
  refetch on return; request cancellation prevents an old generation winning.
- PR #194: `3078a9c`; page totals, `catalogueRevision`, `listViewContext`,
  account/scope checks and revision-conflict recovery remain in use.
- C03 #217: inspected API/design/testing contracts and the acceptance matrix;
  the existing contract verifier passes. Before publication, live T17 #212 and
  C01 #216 were read through the GitHub API. T17 retains the supplied filtering
  scope, completed T03/T04 dependencies and independent-review requirement;
  this verification does not claim planning reforecast or independent approval.
- Reused S3 `test_filter_preference_preservation.py`, the T16 fixture/bridge and
  React integration, T03 ranking tests, T04 refresh/integration/browser checks,
  and PR #194 pagination/navigation/context tests. No new test utility or
  production abstraction was introduced.

The complete base snapshot is derived on each server request, rather than
cached in the browser. `RecommendationsPage` stores the accepted page under
account/scope/version/page/genre keys; clear issues an unfiltered request for
the current account. The repository's canonical view query is **`genreId`**,
not `genre`. Tests preserve that existing spelling and the `page` contract.

## Tested source identity

Git HEAD during the recorded test runs: **`0936ee8f9d5d552b21634f282628d3ce1cbbd146`**,
plus the then-uncommitted test changes in this task. That HEAD alone does not
contain the added verification. The manifest below identifies the tested
contents; subsequent publication commits these unchanged runtime/test files.

[tested-source.sha256](tested-source.sha256) identifies 251 runtime, migration,
test, runner and dependency/configuration files, including the eight changed
test/support files. Manifest SHA-256:
`bba78124291ac7c1760e87acbf71b246e2c4c85fd35cc3bfbe68908e4b890b2e`.
Verify from the repository root:

```sh
shasum -a 256 docs/evidence/s4-t17-genre-filter/tested-source.sha256
shasum -a 256 -c docs/evidence/s4-t17-genre-filter/tested-source.sha256
```

The final account-switch-from-detail test was added after browser execution;
focused and full frontend tests, lint and build were rerun afterward. Browser
runs used the identical final production code. The browser JSON retains its
own capture-time source/state metadata.

## Expected and observed acceptance results

| Expected | Actual observed result and executable coverage |
|---|---|
| Exactly 2 Action / 3 Comedy, in server order | Original fixture remains `Action Z, Comedy C, Action A, Comedy A, Comedy B`. Real API and real React controls select `Action Z, Action A` and `Comedy C, Comedy A, Comedy B`; Horror selects zero. |
| Same oracle after a fresh rating rerank | Optional tied-score fixture changes only Action Z's raw score from 100 to 90, matching Comedy C. Original default fixture is untouched. A real rating PUT of 1 yields `Comedy C, Action Z, Action A, Comedy A, Comedy B`; Action and Comedy still total 2 and 3. Backend also checks a subsequent PUT of 5. |
| Select the complete account base before filtering/slicing | `test_rating_reranked_filter_pages_and_clear_use_complete_account_base`: 35 eligible movies, plus one higher-scored Horror movie outside saved preferences. All 12 Action candidates initially occupy base positions 24–35 and are absent from visible page 1. Action still returns all 12, across pages of 10/2. |
| Rank the whole set, preserve totals/page contents | Real rating 5 moves the 12 Action candidates ahead of the 23 Drama candidates; rating 1 moves them back. Every page's IDs, count, total, unfilteredTotal, totalPages, page and revision match; unfiltered pages are 10/10/10/5 with 35 unique IDs. The outside-preference movie never enters the set. |
| Clear restores latest order and current total | Real T16 React/API/SQLite journey clears after rating 1 and receives the new five-title order, explicitly different from pre-rating. `Show all movies` after a zero-result filter restores that same latest order. Backend compares complete DTOs, including current scores. |
| Clear resets pagination and removes only the view genre | Extended PR #194 UI journey rates from filtered page 2, returns to page 2 with `genreId=28` and the same revision, then clears to `?page=1`, total 35. Next shows the next ten items of the latest full snapshot, including Drama candidates. |
| Keep revision/current-account return context | T16 integration compares complete account/scope/revision context before detail and after save/return; source query is retained. Existing T04 preserves page/filter/query/hash. PR #194 tests also retain genre while handling a changed revision with page-1 recovery. |
| Account-scoped detail return | New context test opens detail from A's filtered page 2, signs in as B, and returns. B's first request contains no A page/genre/revision; accepted state has B's ID, a new scope and B's revision. |
| Reject an old pre-rating response | Extended T04 delayed-response test delivers the old body despite cancellation. Latest ranking and score remain; filter then clear still return that latest ranking. |
| Reject delayed A responses after switch | New parameterized cases deliver A's old filtered page or errors 401/409/503 after B has loaded. B's cards, filter, page, revision and account context remain intact; stale errors cannot log B out or restart its list. |
| Reject obsolete responses after unmount/navigation | New test starts filtered page 2, leaves for preferences, delivers the old result, then navigates Back. No obsolete cards/revision appear; Back fetches the current result with the preserved valid account/revision/filter context. |
| Do not mutate preferences; isolate private results | T16 checks all committed preference rows for both accounts through a fresh read-only SQLite connection after each filter/clear step, including after rating. The only UI write is the explicit rating PUT. B's real API result remains its own single Horror movie. Backend checks B's unchanged response after every A filter/clear. |
| No client reranking or visible-card filtering | UI output is compared with API server order, including a fixed multi-page server snapshot whose new order differs from raw popularity. Backend tests prove that all 12 initially invisible candidates are retained. Production rendering/filtering code is unchanged. |

The enhanced pagination fixture uses one database session per request, so read
snapshots close before the next rating write, matching application lifecycle.
The T16 fetch adapter checks included credentials on private requests while
allowing the existing public detail transport. These are test-harness fixes.

## Commands and executed results

Run from repository root with Python 3.12 (`.venv/bin/python`) and Node 24.
Offline runs set `TMDB_READ_ACCESS_TOKEN='' TMDB_NETWORK_DISABLED=1`.
Integration bridges and browser runners own migrated temporary SQLite files;
they do not use the developer database. Focused API fixtures also own isolated
databases; the pagination fixture uses real SQLite in memory.

Focused commands:

```sh
PYTHONPATH=backend DATABASE_URL=sqlite:///:memory: TMDB_READ_ACCESS_TOKEN='' TMDB_NETWORK_DISABLED=1 .venv/bin/python -m pytest backend/tests/test_filter_preference_preservation.py backend/tests/test_catalogue_pagination.py backend/tests/test_rating_aware_recommendations.py -v
npm --prefix frontend test -- src/tests/recommendation-filter-acceptance.test.tsx src/tests/recommendation-filter.test.tsx src/tests/rating-recommendation-refresh.test.tsx src/tests/pagination-navigation.test.tsx src/tests/list-context-invalidation.test.tsx
TMDB_READ_ACCESS_TOKEN='' TMDB_NETWORK_DISABLED=1 npm --prefix frontend run test:t16:integration
```

All checks below expected exit 0 and produced exit 0 on the successful run.

| Check / command | Observed result | Raw output |
|---|---|---|
| Focused backend command above | 48 passed | [Log](checks/focused-backend.log) |
| Focused frontend command above | 5 files, 29 passed | [Log](checks/focused-frontend.log) |
| `npm --prefix frontend run test:t16:integration` | 1 passed; real filter/rating/clear/API/SQLite journey | [Log](checks/t16-integration.log) |
| `.venv/bin/python backend/scripts/run_isolated_tests.py -v` | 660 passed, 1 historical skip | [Log](checks/backend-regression-escalated.log) |
| `.venv/bin/python -m ruff check backend` | All checks passed | [Log](checks/ruff.log) |
| `npm --prefix frontend test` | 36 files, 399 passed | [Log](checks/frontend-regression.log) |
| `npm --prefix frontend run lint` | Passed | [Log](checks/frontend-lint.log) |
| `npm --prefix frontend run build` | TypeScript/Vite passed | [Log](checks/frontend-build.log) |
| `npm --prefix frontend run test:t04:integration` | 1 passed | [Log](checks/t04-integration.log) |
| `npm --prefix frontend run test:t33:integration` | 1 passed | [Log](checks/t33-integration.log) |
| `npm --prefix frontend run test:s04:e2e` | 10 passed, 1 configured live smoke skipped; clean exit and temporary DB removal | [Log](checks/s04-browser-escalated.log), [browser report](s04-browser.json) |
| T04 browser command below | All seven verifier checks passed; SQLite integrity `ok` | [Log](checks/t04-browser-escalated.log), [API/DB JSON](t04-browser.json) |
| `.venv/bin/python scripts/verify_s4_c03_contract.py` | Pass; 208 links, 35 P0 IDs, 10 S4 feature oracle IDs | [Log](checks/contract.log) |
| `git diff --check` and manifest verification | Passed | [Log](checks/final-verification.log) |

The full backend runner migrates a disposable database, then executes
`.venv/bin/python -m pytest backend/tests -v` with that database configured.
The successful backend and browser runs required sandbox escalation for local
server sockets/headless Chrome; no live TMDb access was needed.

T04 browser command as executed (the generated folder was subsequently moved
to ignored `frontend/test-results/s4-filter-t04`; JSON is retained above):

```sh
TMDB_READ_ACCESS_TOKEN='' TMDB_NETWORK_DISABLED=1 .venv/bin/python backend/scripts/verify_s4_t04_ranking_ui.py --browser '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' --evidence-dir docs/evidence/s4-t05-genre-filter/t04-browser
```

Initial attempts are retained, not counted as green: [backend fixture
failure](checks/initial-focused-backend.log) (47 passed/1 failed from a shared
read transaction), [T16 adapter failure](checks/initial-t16-integration.log)
(public detail credentials assumption), [sandbox backend](checks/backend-regression.log)
(654 passed/1 skipped/6 local socket setup errors), [sandbox S04](checks/s04-browser.log)
and [sandbox T04](checks/t04-browser.log). The harness corrections and permitted
reruns above resolved these failures without a production change.

## Scope and remaining criteria

No blocker remains for the supplied automated genre-filter verification scope.
The backend skip is the existing historical
`test_rating_write_requires_the_signed_in_account` placeholder; implemented
rating API tests did execute. The browser skip is the separately configured
live TMDb smoke, intentionally outside offline/token-free acceptance.

Independent teammate review, live catalogue provenance/address-bar captures,
and acceptance or closure of the entire broader Story #22/#23 or C01 planning
work are not certified here. This task does not add unrelated Story features,
change historical Sprint 3 evidence, or claim a new visual acceptance review.
