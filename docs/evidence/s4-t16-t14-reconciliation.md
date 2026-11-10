# S4-T16 — Reconcile merged T14 without losing T16 behavior

Client date: 2026-10-28 (Asia/Saigon).
PR [#235](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/235),
Refs [T16 #211](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/211)
and merged [T14 PR #234](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/234).

## Candidate and scope

This combines T16 parent `3ef936eab893e105f61fb242c8b12969145340d2`
with main `0936ee8f9d5d552b21634f282628d3ce1cbbd146` in a merge commit,
preserving the existing history. Author-local execution below was performed
on the resolved working tree, identified by normalized source hashes. This
does not claim a teammate approval, clean-clone rehearsal or Story closure.

The three content conflicts were resolved in the acceptance server, T01 browser
suite and UI contract. T14's reset helper/Profile behavior, cancellation-aware
gate cleanup and Windows runner ownership are retained. The T16 production
backend, migration and movie UI code are unchanged from its parent; the only
production frontend additions versus that parent are T14's reset helper and
Profile integration. No environment file or real database is changed here.

## Integration decisions

- One test-only gate matcher: `{method, path, requestTag?}`. Exact detail,
  per-movie rating and watchlist GETs, membership PUT/DELETE, Search, Similar and
  Recommendations can be selected. Unrelated movies/methods/tags bypass a gate.
  The previous array-shaped matcher is rejected rather than silently capturing
  the wrong requests. The default no-path NLP gate behavior is retained.
- Keep `pending`, `aborted`, `completed` and the drain event from T14. T16's
  helper now observes that lifecycle and tolerates real cancellation before a
  response is captured. Successful payload/identity checks and old-account/
  old-movie rejection remain.
- T01's tagged gates and cleanup are retained; each intended Search action
  explicitly submits Enter. There is one afterEach drain, rather than two
  overlapping cleanup hooks. Login feedback uses T14's held-click handling.
- Keep `S04_EXTERNAL_SERVERS`, direct Windows child ownership and the runner's
  guarded temporary-directory cleanup. Configuration still fingerprints the
  shared helper and starts isolated servers only when the parent does not own
  them.
- Linux browser acceptance jobs use the explicit Ubuntu 24.04 image. The
  earlier push jobs exceeded 10/12-minute budgets while installing Chromium
  dependencies on the floating runner. Test budgets, assertions, retries and
  skips were not relaxed.
- Preserve 50-page import guidance, half-star persistence and explicit Save,
  submit-only full-result Search pagination, per-page Popular carousel and
  compact Popular/Search/Watchlist headings. Existing real-artwork captures in
  [the carousel evidence](s4-t16-spotlight.md) remain historical visual evidence;
  no UI layout was replaced during this reconciliation.

## Verification

| Check | Observed final result |
|---|---|
| Full isolated backend | 703 passed, 1 inherited skip; 189.76s |
| Root S03 production API/widget regressions | 9 passed |
| Gate protocol/cleanup scope | 10 passed, included in backend total |
| Full frontend | 429 passed, 38 files |
| T01 Chrome | 16 passed, 1 optional live-only skip |
| T13 reset/Profile Chrome | 4 passed |
| T16 Chrome | 19 passed |
| T12 Watchlist Chrome | 2 passed |
| Complete S04/S13 Chrome | 10 passed, 1 optional live-only skip |
| Independent offline T28 DB/API/browser | 18 passed cases; temporary database removed |
| Windows/parent runner cleanup | 3 passed |
| M3 runner/report cleanup | 11 passed |
| ESLint / TypeScript / Vite build / Ruff | Pass |
| C03 structure / LF and CRLF exports | Pass |

All final browser commands exited zero and reported temporary-database removal.
No Playwright retry or added skip was used. [Sanitized browser records](s4-t16-t14-reconciliation/t16-browser.json),
[frontend summary](s4-t16-t14-reconciliation/frontend-tests.json),
[T28 summary](s4-t16-t14-reconciliation/t28-summary.json),
[preservation checks](s4-t16-t14-reconciliation/preservation.json) and
[source fingerprints](s4-t16-t14-reconciliation/source-hashes.json) identify
this integrated candidate. The adjacent folder contains the T01/T13/T12/S04
case records as well.

Initial temporary-directory checks were blocked by the sandbox-mapped Temp
permissions; the normal-permission isolated reruns are the recorded results. The first T01 run saw Start remain on Home when clicked
immediately after the URL changed during login. Navigation tests now wait for
the rendered signed-in header/email before that action. The acceptance Vite
optimizer cache is also isolated inside the run-owned temporary directory,
so shared worktree dependencies do not share a dev-server optimizer cache.
Failure-only browser diagnostics omit headers, cookies and bodies; live mode
is excluded. A separate T16 regression holds an
actual Home API response, clicks Start, releases that response and checks that
Preferences and an unsaved genre draft remain on the correct route.

That new regression initially asserted the request field `genreIds` on a GET
response. The response contract is `data.genres`; the assertion was corrected
to verify HTTP 200 and the actual empty persisted genre list. No production API
or preference-save behavior was changed to accommodate the test.

The inherited backend skip/deprecation warning and optional live-only T01 skip
are retained. Automated fixtures are synthetic, account-isolated and offline at
the provider boundary. Sanitized results and source hashes are adjacent to this
document. The local T28 run first confirmed its default 8000/5173 ports were free, then
owned its temporary servers/database; no developer service was stopped.

## Reproduce

Follow the existing locked setup and keep acceptance ports 8014/5174 free.
The existing imported catalogue requires no new migration or import for this
integration. Browser commands own temporary SQLite/index/server resources.

```powershell
$env:PYTHONUTF8 = "1"
.\.venv\Scripts\python.exe backend/scripts/run_isolated_tests.py -q
.\.venv\Scripts\python.exe -m pytest tests/test_s03_details.py -q
.\.venv\Scripts\python.exe -m ruff check backend tests
npm.cmd --prefix frontend test
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run build
$env:S04_PYTHON = (Resolve-Path ".\.venv\Scripts\python.exe").Path
$env:S04_BROWSER_CHANNEL = "chrome"
npm.cmd --prefix frontend run test:t01:ui
npm.cmd --prefix frontend run test:t13:ui
npm.cmd --prefix frontend run test:s4:t16:ui
npm.cmd --prefix frontend run test:s04:e2e -- --config playwright.t12.config.ts
npm.cmd --prefix frontend run test:s04:e2e
npm.cmd --prefix frontend run test:s04:runner
npm.cmd --prefix frontend run test:m3:verifier
.\.venv\Scripts\python.exe scripts/verify_s4_c03_contract.py
.\.venv\Scripts\python.exe scripts/test_s4_c03_contract_line_endings.py
```

## Review and handoff

Record latest-head CI separately from these author-local results. An actual
non-author review/approval is still required; the Scrum hygiene gate is not
disabled or auto-approved. Request review on the final executable PR head and
retain the existing C05 clean-clone/P0 ownership and pending Story #19 AC.
No merge, issue closure or private account operation is performed here.
