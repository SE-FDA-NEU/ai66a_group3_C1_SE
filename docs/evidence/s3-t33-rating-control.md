# S3-T33: safe account rating control and recoverable saved state

Task: [#139](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/139).
Parent: [S05a #21](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/21),
supporting [S13 #45](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/45).
Owner: @kietxuan. Verification date: 2026-10-14 (Asia/Ho_Chi_Minh).

Dependencies: merged T31 [#138](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/138)
rating API and T17 [#119](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/119)
detail return; independent API verification is under T32
[#140](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/140). The initial
contract from [#134](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/134)
can be consumed before that multi-stage Chore closes.

Application baseline after conflict resolution:
`ad43ec76cf55b068ad4e1e28c475f53d9f409b43`.
The initial implementation was verified against
`434156701373cc6763e6272ee9bfe5f52a24a552` before T16 merged.
The tested task SHA is the commit containing these files; obtain it with
`git rev-parse HEAD` on the PR branch and link that exact SHA and its CI runs.

## 1. Delivered scope

- A separate `MovieRating` widget on valid public movie details.
- A typed GET/PUT client using existing session cookies, opaque movie IDs and the
  existing rating API. No account identifier is sent in the payload.
- Integer values 1–5; JSON `null` explicitly means unrated, never zero.
- Separate draft and last-confirmed committed values, loading/saving/error states
  and separate read/session/save retry actions.
- Save success only after a valid acknowledgement for the requested movie/value.
- Account/movie-keyed private state, cancellation and stale-response rejection,
  including delayed error/401 responses and logout followed by same-account login.
- A session check for valid direct/F5 public details, using existing AuthProvider.
  Public content remains visible while auth/rating checks wait or fail.
- Central protected-401 recovery plus explicit login navigation on this public route.
- Detail-loader lifecycle correction so changing movies or retrying an old movie
  cannot retain the previous movie's private widget or replace a newer route.
- A generation guard in the existing AuthProvider so an old session bootstrap
  cannot overwrite a later sign-in, sign-out or central invalidation.
- Focused tests, cross-runtime API/database acceptance, dedicated CI and updated
  API/setup/design/architecture documentation.

No production backend, database schema, TMDb importer, ranking, search, similar
movies, trailer or profile UI is changed. Rating-adjusted recommendations remain
S05b #22 / Sprint 4. T16 is inherited from main through merged PR #167;
this task does not reimplement T16.

## 2. Completion-check mapping

| Issue check | Implementation / evidence |
|---|---|
| Guests view public details without private rating requests | Session eligibility is checked only for a valid movie; guest UI never GETs/PUTs a rating. Public details stay visible. |
| Guest rating action opens login without private reads/writes | Sign in to rate this movie is a `/login` link. Automated App/API acceptance audits guest requests. |
| Signed-in own integer rating 1–5 | Typed client validates all five values; real API resolves ownership from its session. No `userId`/email in rating payload. |
| Unrated differs from zero | GET `null` renders Not rated yet; invalid zero is rejected before client writes. |
| Success only after commit | UI waits for the existing backend's committed-success response and validates movie/value before displaying Rating saved. |
| Failed save preserves draft and committed value | Tests preserve committed 3 and draft 5 after HTTP, network and malformed-response failures. |
| Clear message and retry | Separate Retry session check, Retry loading rating and Retry save controls; public content is not replaced by a private error. |
| Retry does not duplicate ratings | Real API/SQLite acceptance inspects one account/movie row after update and retry. |
| Movie/account/logout clear private state | Keyed private subtree, unmount cleanup, route-aware detail loading and account-switch/logout tests. |
| Ignore previous movie/account responses | Deferred read/save 200/401/503 tests, StrictMode cleanup and old-detail-retry tests. |
| Protected 401 uses central handler | Current rating read/save 401 invalidates existing AuthProvider and navigates to login; stale 401 does neither. |
| Accessible labels, return context and preferences | Labelled native select/form/buttons, status/alert messages, existing safe return helper and real unchanged-preference comparison. |
| Focused tests and browser reviewer steps | Commands below plus the reproducible manual checklist. |
| Actual results, tested SHA and independent review | Observed results below; exact SHA/CI in the PR. Human independent review remains required. |

## 3. Test layers and boundaries

### Frontend suites

- `ratings-client.test.ts`: values 1–5 and null reads, strict invalid-input rejection,
  cookies/URL/body/signal, HTTP status/code preservation and invalid acknowledgements.
- `movie-rating.test.tsx`: guest/auth/loading/unrated/save/update/failure/retry,
  pending double-click protection, current and stale 401, movie/account/logout
  lifecycle, same-account relogin and StrictMode cleanup.
- `movie-detail-rating.test.tsx`: direct session restoration, public content during
  pending/failed session checks, movie switches and an old detail retry resolving late.
- `rating-session-refresh.test.tsx`: late bootstrap responses cannot overwrite a
  new account or restore signed-out/invalidated identity.
- Existing details/return/auth-handoff tests retain public access and safe navigation
  assertions. Valid details may now check `/api/auth/me`; guest private rating
  reads/writes remain forbidden. Other public routes are not globally auth-guarded.

These suites use controlled fetch responses in jsdom. They are not browser or
live-provider evidence. The T33 source adds 71 tests to the baseline frontend suite.

### Real React -> FastAPI -> migrated SQLite acceptance

The separate `test:t33:integration` suite renders the real App/components and
substitutes only fetch transport. A test-only JSON-lines Python bridge forwards
requests to real FastAPI TestClient routes and their cookie/session middleware.
Response data is not mocked. A new temporary database is migrated and populated
using the existing explicitly synthetic M2 fixtures, with a blank TMDb token.
This fixture is only for automated verification, not Sprint 3 live-data acceptance.

The journey checks:

1. Guest details stay public and no private rating request is sent.
2. Actual UI login for A; recommendations-to-detail navigation retains return context.
3. Save 3; a fresh read-only SQLite connection observes one committed A/movie row.
4. Select 5 and inject `Session.commit` failure inside the real rating request.
   The existing API returns 503 and rolls back; the UI keeps draft 5 and committed 3.
5. Retry the same PUT; the one row becomes 5, without a duplicate.
6. A's recommendation response before/after rating is identical: no S05b reranking.
7. A fresh App instance with the same session reads saved 5, simulating reload.
8. Actual login for B; the same movie is unrated for B. B saves 2.
9. Database state is A=5 and B=2 on the same movie; both accounts' preference rows
   are exactly unchanged and integrity_check is ok.
10. Actual UI sign-out returns home; a fresh details load is guest and does not read
    private rating data. Signing in A again restores 5, not B's 2.

The bridge is not a production/debug endpoint. It closes read-only connections,
TestClients and the engine before deleting its temporary Windows database. Startup,
request and shutdown guards prevent hung child processes. The original developer
database and imported catalogue are not written or reseeded.

This is cross-runtime component/API/database integration, not real browser HTTP,
browser cookie-policy, visual, keyboard or mobile end-to-end evidence. Delayed
responses are exercised separately by the focused frontend suites. T34 #141 owns
independent real-browser/account-switch acceptance after T33 merges.

## 4. Reproduce automated verification

Run from the repo root after installing both locked runtimes using [SETUP.md](../SETUP.md).
On Windows PowerShell:

```powershell
$env:PYTHONUTF8 = "1"

npm.cmd --prefix frontend test -- src/tests/ratings-client.test.ts src/tests/movie-rating.test.tsx src/tests/movie-detail-rating.test.tsx src/tests/rating-session-refresh.test.tsx
npm.cmd --prefix frontend run test:t33:integration
npm.cmd --prefix frontend test
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run build
.\.venv\Scripts\python.exe -m ruff check backend
git diff --check
```

Expected focused count: 71 passed. The integration command detects the repository
`.venv` on Windows/Linux, or uses `T33_PYTHON` when explicitly supplied. Both backend
and frontend dependencies must be installed; no real TMDb token is needed.

For full backend regression, use a separate test terminal and disposable database:

```powershell
$t33Directory = Join-Path $env:TEMP ("t33-review-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $t33Directory | Out-Null
$t33Database = Join-Path $t33Directory "test.db"
$env:DATABASE_URL = "sqlite:///" + $t33Database.Replace("\", "/")
$env:TMDB_READ_ACCESS_TOKEN = ""
$env:PYTHONUTF8 = "1"
$env:COVERAGE_FILE = Join-Path $t33Directory ".coverage"

.\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini upgrade head
.\.venv\Scripts\python.exe -m pytest backend/tests -q --cov=backend/app --cov-report=term
```

Close that test terminal afterwards. Do not start the demo backend in it: its
DATABASE_URL deliberately points to an empty isolated test catalogue. Do not
overwrite `.env` or run the M2 seed on the accepted TMDb database.

## 5. Observed results

The final source is verified on Windows with Python 3.12.6, Node 24.19.0 and
npm 11.17.0. Baseline dependencies remain locked; no application dependency is added.

| Check | Result |
|---|---|
| New focused frontend suites | 71 passed |
| Full frontend | 15 test files, 181 passed |
| Inherited T16 UI/API/database integration | 1 passed |
| Cross-runtime rating acceptance | 1 passed |
| Full backend regression | 372 passed, 1 inherited skipped test; app coverage 91% |
| Ruff, ESLint, TypeScript/Vite build | Passed |

The skipped rating-write placeholder and Starlette/httpx deprecation warning are
inherited from the baseline. T33 introduces no skipped tests. They are recorded,
not hidden or changed as unrelated backend work.

The initial fresh-runtime verification used a new local Git clone of the baseline
plus the exact candidate source, a fresh Python venv, locked installs, `npm ci`, empty
database migration and the same full suites. Hosted Ubuntu CI for the pushed
task commit remains a separate check; review both ordinary CI and the dedicated
T33 rating UI/database workflow for the exact SHA.

### Main synchronization and conflict resolution (2026-10-14)

Main now contains the merged T16 filter verification. Its
`test:t16:integration` package script conflicted with T33's new
`test:t33:integration` script. The resolution keeps both entries and their
separate Vitest configurations, integration bridges and CI workflows. The
production rating/authentication code is unchanged by this conflict resolution;
the PR remains one T33 commit rebased onto the current main baseline.

After resolving the conflict, the focused T33 suites, all frontend tests, both
T16/T33 integration commands, ESLint, the TypeScript/Vite build, all backend
tests, coverage and Ruff were rerun successfully. The results in the table above
are from this combined candidate, not just the initial pre-T16 implementation.
Backend regression used a new temporary migrated database with a blank provider
token; the integration commands used their own isolated databases. No developer
database was imported, reseeded or modified. This rerun is local regression
verification, not a new fresh-clone or real-browser claim.

## 6. Real-browser reviewer steps

1. Keep the configured `.env`/TMDb database; do not re-import the existing 255-film
   catalogue simply to test this frontend task. Fresh environments follow SETUP.md
   and the TMDb runbook. No new migration is introduced.
2. Start backend with `.venv/Scripts/python.exe -m uvicorn app.main:app --app-dir backend --reload`
   and frontend with `npm.cmd --prefix frontend run dev` in separate root terminals.
3. Use `http://localhost:5173/` consistently. `/health` is at backend port 8000;
   backend root is not the frontend. Requests use the same-origin Vite `/api` proxy.
4. In Incognito, open a valid movie. Public content is visible. Network shows no
   rating GET/PUT; Sign in to rate this movie leads to login without a private write.
5. Use a synthetic test account A, sign in, and open the same film. Unrated is not
   zero. Save 3, select 5 without saving (saved remains 3), then save 5. F5 and
   logout/relogin restore the last committed rating.
6. Load committed 3, select draft 5, stop backend and attempt save. No success;
   draft stays 5 and the last confirmed value stays 3. Restart backend and Retry save.
   This manual fault is network failure, not a claim that a 503/rollback was observed.
7. Sign out and sign in B. B must not see A's rating; B can save 2 independently.
   A subsequently still sees 5. Confirm database ownership/row counts separately.
8. Return through the existing recommendations/detail back link. Preferences stay
   intact. Rating is optional and does not change Sprint 3 ranking.
9. Verify Tab/keyboard select/submit/retry, visible focus and no overflow on mobile.
10. Capture actual images with the address bar visible if recording browser evidence.
    Do not include passwords, cookies, tokens or `.env`. Never present automated
    jsdom output as a browser screenshot.

No actual browser screenshots are attached by this implementation task. The
automated results above are actual test runs; browser steps and their expected
outcomes are not falsely marked as manually executed. Independent human review
and T34 browser verification remain required before closing parent Stories.

## 7. Handoff

PR links `Closes #139`, `Refs #21`, `Refs #45`; it does not close either Story.
T34 [#141](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/141) can independently
verify browser/API/database behaviour after T33 merges. The existing GET/PUT API,
same-origin protection and account ownership stay unchanged. The widget does not
invalidate/write preferences, cache another account's ratings or rerank results.

Network loss or cancellation is not proof that an already-sent server write was
rolled back. The UI therefore reports an unconfirmed save and retries the same
idempotent account/movie PUT; an explicit injected commit failure is verified
separately using the real backend transaction. This distinction is intentional.
