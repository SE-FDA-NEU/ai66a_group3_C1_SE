# S4-T13 profile and reset evidence

Issue: [#208](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/208).
Base: merged main `3e6a0494369842bc66cfa5170e7e078f2acf73d8`.
Tested executable/test/CI-source commit:
`0b02ab6ae20628410a0675eb05a96d242a0de035`.
The following evidence/documentation commit changes no executable source.
Operator: Codex assisting @kietxuan, 2026-10-26, Windows PowerShell,
Python 3.12.6 / Node.js 24.19.0 / Chromium through Playwright.

## Delivered behaviour and scope

- Existing protected `/profile` now renders a real account summary and has a
  signed-in navbar link. Genres, rating count and watchlist count come from
  `GET /api/me/profile`; unavailable data is not replaced with invented zeros.
- Shared `ConfirmDialog` provides safe Cancel focus, Tab containment, Escape,
  focus restoration and pending controls. Cancel sends no reset request.
- One explicit confirmation sends `POST /api/me/profile/reset` with exactly
  `{confirm:true}` and session cookies. Only HTTP 200 plus `{data:{reset:true}}`
  triggers `Your personalisation profile was reset.`. The page then rereads
  its summary; watchlist and auth are preserved.
- A documented backend rejection/rollback keeps the shown data and offers a
  newly confirmed attempt. Unknown responses require a fresh Profile read.
  A failed reconciliation blocks reset; a successful read reports current
  server data without claiming which operation produced it. No automatic POST
  retry occurs. A confirmed success stays acknowledged if its later read fails.
- The client has a 15-second deadline, no-store reads, typed/validated payloads
  and existing 401 handling. Generations, account-keyed content and aborts
  prevent stale replies; cleanup dismisses only owned pending feedback.
- The page uses T01 components/tokens in both themes and at 375/768/1440 px.
  Feature-specific CSS is scoped to Profile. The existing guard test now uses
  a real summary fixture instead of the retired Profile placeholder.
- T14 #209 owns shared preferences/ratings/recommendation invalidation after
  known success. T15 #210 owns full S11 acceptance. This evidence does not
  claim those tasks or all Story #33 criteria have been accepted.

## Reproduce

From the repository root after locked dependency installation:

```powershell
npm.cmd --prefix frontend test -- src/tests/profile.test.tsx src/tests/profile-client.test.ts
npm.cmd --prefix frontend test
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run build
$env:S04_PYTHON = (Resolve-Path '.\.venv\Scripts\python.exe').Path
npm.cmd --prefix frontend run test:t13:ui
npm.cmd --prefix frontend run test:t01:ui
.\.venv\Scripts\python.exe scripts/verify_s4_c03_contract.py
.\.venv\Scripts\python.exe scripts/test_s4_c03_contract_line_endings.py
git diff --check
```

Optional real browser captures (not generated illustrations):

```powershell
$env:T13_SCREENSHOT_DIR = Join-Path (Get-Location) 'docs/images/sprint4/t13-profile'
npm.cmd --prefix frontend run test:t13:ui
Remove-Item Env:T13_SCREENSHOT_DIR
```

The browser runner creates/migrates a disposable SQLite DB, serves the real
backend and Vite app on 8014/5174, then removes its database. No live TMDb/token
is used. Its explicit failure responses are network-test controls, not claims
that a real DB failure was induced; a separate lost-response case forwards the
real reset to completion before aborting the response. The forwarding transport
retains the browser's same-origin Fetch Metadata; production origin guards are
unchanged. No traces, cookies, account passwords or .env files are committed.

## Expected and observed

| Check | Expected | Actual |
|---|---|---|
| New client/component tests | Exact payload/ack, error classification/deadline, cancel, duplicate guard, unknown outcome, 401, A/B and unmount guards | 31 cases passed within the full suite |
| Frontend suite | Existing assertions retained with the Profile placeholder fixture updated | 351 passed, 32 files |
| ESLint / build | No lint or TypeScript/bundler errors | PASS / PASS |
| T13 browser | Real reset/cancel/persistence/A-B/watchlist, both themes/viewports/keyboard, failure/reconciliation, auth intent and expiry | 4 passed |
| T01 browser | Existing onboarding, theme, sort/paging, stars and feedback assertions retained | 11 passed; one separate imported-catalogue capture mode intentionally skipped |
| Database cleanup | Browser runner removes its temporary database | `s04_temporary_database_removed=true` after both suites |
| Fresh clone | Clone the tested branch into a new temporary directory, create a separate Python venv, install locked Python packages/editable backend and `npm ci`, then build and run T13 against a new disposable DB | Build PASS, 4 browser tests PASS; no existing .env, node_modules, database or Python environment copied |

The clean-clone check verifies this feature's offline setup and browser
integration, not a fresh live TMDb import. The existing operator database
retains 255 active TMDb movies; this implementation/test effort did not reset
or reseed that database. The fresh clone reused the installed Playwright browser
binary; CI installs Chromium explicitly. Both use isolated synthetic data.

`npm ci` reports six inherited dependency audit findings (4 high, 2 moderate).
The package lock is byte-for-byte unchanged from main. They concern the
development/test toolchain; upgrading it is a separate dependency maintenance
change, not silently bundled into Profile work. The current feature's build,
unit and browser checks pass. `npm --prefix frontend audit --omit=dev --json`
reports zero runtime findings. This report does not claim the full dependency
audit is clean.

Browser journey: A has 3 genres, 2 ratings and 2 watchlist rows; B has 1/1/1.
Cancel leaves A unchanged with zero POSTs. Confirm commits one POST, A becomes
0 genres/0 ratings/2 watchlist rows; B stays 1/1/1. Later login/reload of A reads
0/0, with both watchlist movies still visible on the actual Watchlist page.

The lost-response browser case receives 200 from the real reset backend before
aborting the browser response. The first reconciliation GET is deliberately
unavailable, so another reset is blocked. The next GET returns 0 ratings and
2 watchlist movies; the page describes current data, never announces the exact
reset-success sentence and never automatically sends a second POST.

Measured contrast ratios for the actual shared theme tokens used on Profile
(normal text threshold 4.5:1; this is not a full WCAG certification):

| Theme | Main text | Muted text | Error text | Success text | Primary button |
|---|---:|---:|---:|---:|---:|
| Dark | 15.47 | 8.45 | 9.02 | 10.88 | 5.33 |
| Light | 16.52 | 6.47 | 6.28 | 6.31 | 6.75 |

## Screenshots

All screenshots below are actual browser captures of the feature on synthetic,
isolated data. They do not claim a live-provider import or independent human review.

- [Dark desktop summary](../images/sprint4/t13-profile/profile-dark-1440.png)
- [Light mobile summary](../images/sprint4/t13-profile/profile-light-375.png)
- [Dark mobile summary](../images/sprint4/t13-profile/profile-dark-375.png)
- [Dark tablet summary](../images/sprint4/t13-profile/profile-dark-768.png)
- [Light tablet summary](../images/sprint4/t13-profile/profile-light-768.png)
- [Light desktop summary](../images/sprint4/t13-profile/profile-light-1440.png)
- [Desktop confirmation](../images/sprint4/t13-profile/profile-confirm-dark-1440.png)
- [Dark mobile confirmation](../images/sprint4/t13-profile/profile-confirm-dark-375.png)
- [Light mobile confirmation](../images/sprint4/t13-profile/profile-confirm-light-375.png)
- [Committed reset](../images/sprint4/t13-profile/profile-success-dark-1440.png)
- [Explicit rejection](../images/sprint4/t13-profile/profile-rollback-dark-1440.png)
- [Unconfirmed reset and failed read](../images/sprint4/t13-profile/profile-unconfirmed-dark-1440.png)
- [Reconciled current state](../images/sprint4/t13-profile/profile-reconciled-dark-1440.png)
- [Light mobile reconciliation](../images/sprint4/t13-profile/profile-reconciled-light-375.png)

## Remaining review and integration gates

The designated independent reviewer is @NguyenTuanAnh0608, or another
non-coauthor if required. Their own functional/browser checks, substantive
GitHub review and final decision must be recorded after they actually happen.
Author-operated automation is not that independent review. CI for the pushed
head must be checked before merge; issue #208 is not closed by this evidence.

T14 integrates shared-state invalidation at the acknowledged-success branch
inside `ProfilePage.confirmReset`. Ambiguous/failed/cancelled requests must not
call that invalidation. Existing backend reset and concurrency semantics are
reused; this feature changes no schema/API endpoint or ranking algorithm.

## CI startup repair follow-up

The PR-triggered T34 run failed before application UI assertions while reading
`http://127.0.0.1:<port>/json/list`: the first 2-second HTTP timeout escaped the
existing 30-second startup loop. The original failed run is
[browser-rating-acceptance](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/40280475927/job/121432429967).

The shared `browser_websocket` helper now retries transport failures, partial
port/JSON responses and missing page targets within that same deadline. It
still fails immediately when Chromium exits, requires an actual page websocket,
and fails after the deadline. Business assertions, origin/auth protection,
rating behaviour and the teammate-review gate are unchanged.

Regression on base `62c2992` with the new tests and old helper: **9 failed,
2 passed** (timeout, incomplete target and partially written response cases).
With the repair: **11 passed**. These are real before/after runs with identical
test assertions and a deterministic clock; the clock avoids waiting 30 seconds
for failure-path unit cases.

The full isolated backend suite then passed **644 tests, 1 existing skip**.
Ruff, C03 structure, LF/CRLF and diff whitespace checks also passed. The
inherited TestClient/httpx deprecation warning remains unchanged.

The unchanged real rating verifier then passed using a migrated temporary
SQLite database and Chrome 154.0.8037.100 on Windows. Its checks include guest
protection, save/update/rollback/retry, A/B isolation, delayed account/movie
replies, revoked/expired session handling and preserved return/preferences.
Database integrity was `ok`; no development database was used.

```powershell
.\.venv\Scripts\python.exe backend/scripts/run_isolated_tests.py -q --tb=short -k browser_readiness
.\.venv\Scripts\python.exe backend/scripts/verify_s13_rating_ui.py --evidence-dir .artifacts/t13-ci-readiness
.\.venv\Scripts\python.exe backend/scripts/run_isolated_tests.py -q --tb=short
.\.venv\Scripts\python.exe -m ruff check backend
```

The real verifier's candidate-source fingerprint was
`7d98b6d73802672f9d870d4f03165a712aac96f627a564d6e960c2a1ab8785be`
(capture base `62c2992` plus this repair). Exact repaired source is identified
by the following normalized-LF SHA-256 values and the final PR commit:

| File | SHA-256 after UTF-8 LF normalization |
|---|---|
| `backend/scripts/verify_s02_recommendations_ui.py` | `8f1df94c7ea5850f44eced7727cc44965615e575afe5da152b2be46739792534` |
| `backend/tests/test_browser_readiness.py` | `e697bee38c22662d7b8e604725fcada6768730565b68e20b3aac1c69439f8015` |
