# S4-T14 reset invalidation: local candidate evidence

Issue [#209](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/209), parent Story [#33](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/33), and open [PR #234](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/234). Date: 2026-10-27 (Asia/Saigon). The implementation was first tested as an uncommitted working tree on base `486adabf3d2b33805082c5a7a236e52c119c29a8`, which contains merged T01 polish PR #224. The user subsequently made three T14 commits: implementation `45131b0`, tests `32c137a`, and evidence `196a102`; documentation commit `ab62c61` followed. PR #234 currently points at `ab62c61a8256c433ddf74cb0f324f9ca24c78612`. The later browser-gate correction and this evidence update are still uncommitted, so that SHA does not identify the final local candidate. No independent review, merge or issue closure is claimed.

## Scope and concurrency decision

`ProfilePage` calls the dedicated `invalidatePersonalisationAfterReset` helper only after the existing client validates `200 {data:{reset:true}}`. It discards its pre-reset summary immediately and uses the existing Profile GET for the replacement. The helper checks the originating account and calls the shared `invalidateRecommendations()`, which advances the request generation and rotates the account's recommendation navigation scope. This invalidates old cards, matched-genre reasons, page/filter context and late recommendation reads. The existing route lifecycle unmounts Preferences and Rating when Profile opens; those pages abort their requests and use their existing GET clients when reopened. No auth, watchlist, catalogue, theme, rating or notification store is changed.

Cancel, explicit rejection and unconfirmed/lost responses never invoke the helper. A known ACK does not sign out the viewer. A later deliberate preferences/rating save goes through the existing SQLite transaction policy; the browser scenario verifies both values are visible after a new Profile read. The production backend is unchanged; the later correction changes only the test acceptance server.

The original historical estimate was 3 author hours plus 0.5 independent review hours. This local reforecast separates 1 hour for scoped integration, 1 hour for focused/API/browser checks, 1 hour for evidence/contracts, a 0.5 hour correction buffer and 0.5 hour for non-coauthor review. It is a planning estimate, not a claim that independent review happened or that team capacity was approved.

## Reproduce

Run from the repository root with the locked frontend/backend setup and installed Chrome (or Playwright Chromium). The browser runner creates an isolated SQLite database with synthetic catalogue data; no TMDb token or external provider call is used.

```powershell
npm.cmd --prefix frontend ci
npm.cmd --prefix frontend test -- src/tests/reset-invalidation.test.tsx src/tests/profile.test.tsx src/tests/list-context-invalidation.test.tsx
npm.cmd --prefix frontend test
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run build
.\.venv\Scripts\python.exe -m pytest backend/tests/test_profile_reset_api.py backend/tests/test_profile_reset_concurrency.py backend/tests/test_s04_acceptance_gate.py -q
.\.venv\Scripts\python.exe -m ruff check backend/scripts/s04_acceptance_server.py backend/tests/test_s04_acceptance_gate.py
.\.venv\Scripts\python.exe scripts/verify_s4_c03_contract.py
.\.venv\Scripts\python.exe scripts/test_s4_c03_contract_line_endings.py
npm.cmd --prefix frontend run test:s04:runner
$env:S04_PYTHON = (Resolve-Path '.\.venv\Scripts\python.exe').Path
$env:S04_BROWSER_CHANNEL = 'chrome'
npm.cmd --prefix frontend run test:t13:ui
npm.cmd --prefix frontend run test:t01:ui
npm.cmd --prefix frontend run test:t13:ui
npm.cmd --prefix frontend run test:t01:ui
git diff origin/main...HEAD --check
git diff --check
```

### Historical checks before the browser-gate correction

| Check | Expected | Observed |
|---|---|---|
| Focused unit tests | ACK once invalidates; cancel/rejection/lost response/account switch do not; old Profile data cannot remain visible after ACK/read failure; a read started before reset cannot restore old recommendation cards or reasons | 40 existing focused cases plus the new integrated reset-generation case passed; the final full run includes all 393 cases |
| Full frontend suite | No component/API regressions | 393 passed, 36 files; rerun on committed HEAD `196a102` |
| Backend reset/API concurrency | Reset preserves B and watchlist, rollback and later writes follow the existing transaction policy | 68 passed on committed HEAD `196a102`, one inherited TestClient/httpx deprecation warning |
| Lint, build and diff whitespace | No ESLint/TypeScript/bundle errors or whitespace defects | Lint and build rerun successfully on committed HEAD `196a102`; commit-range whitespace check passed |
| C03 document structure | Existing contract links and structure remain valid | Passed, 208 local links checked, none missing |
| Real T13 browser | A 3/2 to 0/0; next API recommendations popular/false/false, empty reasons; Preferences 0/5; rating null; watchlist 2; B stays 1/1/1; later A save/refetch 1/1/2 | 4 browser test bodies passed with Chrome and isolated SQLite before commit and again on current HEAD `ab62c61`. The Windows Playwright runner did not exit after printing pass results and was interrupted during web-server teardown. |
| T01 browser regression | All tests pass | The full run failed at the existing Similar Movies gate: expected one captured request, received two on the dev server, which mounts React StrictMode. The isolated Similar Movies case passed. A second run excluding S07 had 12 passed, one skipped and one Home-to-Preferences timing failure in the star test; that isolated star case also passed. The full gate is **not green**. No unrelated assertion was removed. |

The default Playwright Chromium Headless Shell was not installed locally; the initial browser attempt failed at browser launch before any application assertion. Setting `S04_BROWSER_CHANNEL=chrome` used installed Chrome. The historical Windows runner printed passing test bodies but did not exit cleanly. Those failures are retained above; the later corrected runs are recorded below.

The tested executable/test commit for the historical post-commit unit, backend, lint and build checks is `196a10225a7936cefc887b39eda2eadb4fbdbc46`. The following SHA-256 values describe those earlier browser-tested source/test files. The T13 browser test and harness have changed since then; current candidate hashes appear below.

| File | SHA-256 |
|---|---|
| `frontend/src/auth/resetInvalidation.ts` | `00a115dbb8d4850cfb6f9d90379e6ae034b7a6e01d6924962d9a54f8a84c41d7` |
| `frontend/src/pages/ProfilePage.tsx` | `c3bbdfdbee2646621ffcdf9127138ce158de91460876cf576555a6e1ad3ad399` |
| `frontend/src/tests/profile.test.tsx` | `da5793083d83ddfef3ec40b644c20358dbed09ff1785120440c635dc8acf5ceb` |
| `frontend/src/tests/reset-invalidation.test.tsx` | `7725f45f896b91b2e4a5304eae7fae8a0162c71b442044b6c4c92413536e3593` |
| `frontend/e2e/t13.profile.ts` | `5ea8bc28d7c5c67cb810913b5c153b9d626a83925d1c09f9b2b1a0facd592fe1` |

## Real browser captures

- [Committed Profile, dark desktop](../images/sprint4/t14-reset/profile-success-dark-1440.png)
- [Reset confirmation, dark desktop](../images/sprint4/t14-reset/profile-confirm-dark-1440.png)
- [Committed Profile, light mobile](../images/sprint4/t14-reset/t14-profile-success-light-375.png)
- [Empty Preferences after reset](../images/sprint4/t14-reset/t14-preferences-empty-light-1440.png)
- [Popular recommendations after reset, synthetic poster fallback](../images/sprint4/t14-reset/t14-recommendations-popular-light-1440.png)
- [Popular recommendations after reset, real imported TMDb posters](../images/sprint4/t14-reset/t14-recommendations-popular-live-posters-1440.png)

The first five captures are from the synthetic isolated browser fixture. The T13 browser test also checks the committed state in both themes at 375, 768 and 1440 pixels without horizontal overflow. The last capture uses an isolated copy of the imported TMDb database and is a live-poster T14 reset capture.

### Setup refresh and imported-catalogue capture

The T14 browser runner creates an isolated SQLite catalogue with synthetic movies and no `poster_path` values. Its original recommendation screenshot therefore shows the expected `Poster unavailable` fallback. It proves the reset-to-popular transition without testing poster delivery.

Later on 2026-10-27, the documented Windows setup steps were rerun on the **existing workspace**, not a clean clone. The configured `.env` was preserved. A consistent SQLite backup was made at `data/app-before-setup-20261027-151835.db` and passed `PRAGMA integrity_check`. Python 3.12.3 from the existing pyenv installation was used because `py -3.12` was unavailable. Pip was upgraded to 26.2.2, the locked backend requirements and editable backend package installed, `npm.cmd --prefix frontend ci` installed 240 packages, and Alembic reported `e9b6f0a42c17 (head)`. The first TMDb import attempt failed on a transient connection error; a retry of `--pages 15` completed with active revision `81b3d225-abf2-4f67-a6a4-c1f5cf20d108`, 44 inserted, 251 updated, 5 rejected and 295 active movies. The review-account command returned `already_exists`. The active revision had 295/295 stored poster paths, and a direct `image.tmdb.org` poster request returned HTTP 200. The health route returned `200` with `status=ok`, `database=connected` and migration `e9b6f0a42c17`; `pip check`, frontend build and SQLite integrity also passed.

Observed importer and health output (token omitted):

```text
TMDb catalogue import complete
provider=tmdb
active_revision=81b3d225-abf2-4f67-a6a4-c1f5cf20d108
inserted=44
updated=251
rejected=5
movies=295
Local review account: already_exists
health_status: 200
health_body: {'status': 'ok', 'database': 'connected', 'migrationVersion': 'e9b6f0a42c17'}
```

Before the gate correction, the full frontend suite passed 393/393, two focused frontend files passed 16/16, backend reset/API tests passed 68/68, lint and the C03 document contract passed (208 links, 0 missing). The T13 runner still stalled at teardown and the full T01 gate had not passed at that point. These statements record that earlier candidate only; see the corrected local candidate below.

For the new [T14 imported-catalogue screenshot](../images/sprint4/t14-reset/t14-recommendations-popular-live-posters-1440.png), a second SQLite online backup of the refreshed 295-movie database was mounted on separate local ports. A disposable account was given 3 genres and 2 ratings, then reset through the browser. Profile displayed 0/0; the recommendations API returned `mode=popular`, `personalised=false`, `noMatch=false`. Chrome loaded and decoded all 10 first-page TMDb poster images before the full-page capture. The screenshot visibly shows `Popular`, `Not personalised`, the reset success toast and 10 real posters. The temporary database and capture servers were removed; the original database and its accounts were not modified by this capture. Screenshot SHA-256: `435d1c0f2ffb43dc041211fec432f2d82ffc9a2ca880b9fae2f974bb7eb486d8`.

## Browser-gate correction and final local checks (uncommitted)

The Similar gate now matches the request method, exact movie endpoint and a per-test browser request tag. It captures repeated StrictMode requests without requiring exactly one response, records aborted requests, releases every held response, and waits for the gate to drain. `afterEach` releases gates after any assertion failure. Regression tests use the actual test-server ASGI controls to exercise two matching requests, a cancelled request, nonmatching movies, cleanup after an intentional assertion failure, and a subsequent reuse of the same gate name. The loading, source detail, API order, selected-ID navigation and stale-response assertions remain in the full T01 suite. The search gates use the same scoped helper.

The T01 feedback test now observes its pending login state before awaiting the click that depends on the held request. The T01 genre-card test and T13 sign-in helper wait for confirmed authenticated navigation before their next route action. On Windows, the S04 runner owns direct backend/frontend fixture processes so Playwright does not wait indefinitely for shell-based web-server teardown; it stops only those processes and removes its own temporary SQLite directory. The runner's existing cleanup unit tests still pass.

Intermediate failures during the correction are retained here: the original Similar gate failed on two StrictMode requests; the feedback test then timed out while awaiting a held login click; one T13 run landed on Home after a rapid post-login Profile click; one full T01 run landed on Home before the genre-card assertion. A sandboxed run also denied `taskkill` and left SQLite locked. The login waits and direct-server runner addressed these observations. The final browser runs below used the normal Windows process permissions required to stop their own fixture servers.

Environment: Windows PowerShell, Python 3.12.3, Node.js 24.20.0, npm 11.19.0 and Chrome 156.0.8078.48. The local working tree is based on HEAD `ab62c61a8256c433ddf74cb0f324f9ca24c78612`; the gate correction is not yet a commit. All checks below ran after the source changes above. Browser JSON reporters record that HEAD, the dirty working tree, source hashes, zero unexpected/flaky results and the isolated-fixture mode.

| Command/check | Expected | Actual | Exit code |
|---|---|---|---:|
| `npm.cmd --prefix frontend ci` | Locked frontend dependencies install | 240 packages installed after briefly stopping the local Vite dev server that held a Windows binary; the dev server was restarted and returned HTTP 200 | 0 |
| Focused frontend command above | Reset, Profile and navigation-context behavior | 25 passed in 3 files | 0 |
| `npm.cmd --prefix frontend test` | No frontend regression | 393 passed in 36 files | 0 |
| Backend reset/API plus new gate command above | Reset ownership/concurrency and duplicate/cancel cleanup | 70 passed: the existing 68 plus 2 new gate regressions | 0 |
| Frontend lint/build and Ruff | No lint, type or bundle errors | All passed | 0 |
| C03 verifier and line-ending script | Contract links and LF/CRLF hashes valid | 208 local links, 0 missing; LF and CRLF checks passed | 0 |
| `npm.cmd --prefix frontend run test:s04:runner` | Runner removes only its own database after success/failure | 3 passed | 0 |
| T13 browser, first final run | Four Profile journeys, clean exit and SQLite cleanup | 4 passed; `s04_temporary_database_removed=true` | 0 |
| Full T01 browser, first final run | All fixture tests, clean exit and SQLite cleanup | 16 passed, 1 live-only test skipped; cleanup confirmed | 0 |
| T13 browser, second final run | Same result under a fresh runner/database | 4 passed; cleanup confirmed | 0 |
| Full T01 browser, second final run | Same result under a fresh runner/database | 16 passed, 1 live-only test skipped; cleanup confirmed | 0 |
| `git diff origin/main...HEAD --check` and `git diff --check` | No whitespace defects in committed range or current tracked changes | Passed; `upstream` remote is not configured, so `origin/main` was used | 0 |

The 1 skipped T01 case is explicitly marked as a read-only *live imported-catalogue screenshot* test and requires `T01_LIVE_URL`; it is outside the fixture-mode browser gate. The screenshot linked above separately records a real imported-catalogue reset with loaded posters. T13 checks reset/cancel/rejection/lost response, A/B ownership, watchlist, later save/refetch, both themes, 375/768/1440 viewports and keyboard behavior. Focused frontend tests additionally check stale Profile/recommendation responses and invalidated page/filter context.

### Fresh checkout plus uncommitted candidate overlay

To check setup without committing on the author's behalf, a new local clone of HEAD `ab62c61` was created under the Windows temporary directory with `git clone -c core.longpaths=true --no-hardlinks . <temporary clone>`. The current `git diff --binary HEAD` was applied there and the untracked gate regression test, PR draft and poster screenshot were copied into that clone. This is a **fresh checkout plus an uncommitted candidate overlay**; it does not establish a clean clone of a final committed SHA.

The setup commands executed inside that clone, using the installed Python 3.12 interpreter in place of the unavailable `py -3.12` launcher, were:

```powershell
Copy-Item .env.example .env
New-Item -ItemType Directory -Force data
& 'C:\Users\MY PC\.pyenv\pyenv-win\versions\3.12.3\python.exe' -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip --index-url https://pypi.org/simple --quiet
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.lock.txt --index-url https://pypi.org/simple --quiet
.\.venv\Scripts\python.exe -m pip install -e './backend[dev]' --no-deps --index-url https://pypi.org/simple --quiet
npm.cmd --prefix frontend ci
.\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini upgrade head
.\.venv\Scripts\python.exe -m app.cli.import_tmdb_catalogue --pages 15
.\.venv\Scripts\python.exe -m app.cli.create_review_account --confirm-local-demo
npm.cmd --prefix frontend run build
.\.venv\Scripts\python.exe -m pytest backend/tests/test_profile_reset_api.py backend/tests/test_profile_reset_concurrency.py backend/tests/test_s04_acceptance_gate.py -q
```

The three pip commands used `--quiet` during execution to keep the terminal output bounded; the import command inherited the privately configured TMDb token from its parent process rather than from the cloned `.env`.

In that clone, `.env.example` was copied to `.env`; the TMDb token was supplied privately as a process environment variable for the importer and was not written into the cloned `.env` or logs. A new Python 3.12.3 `.venv` was created, pip and the locked backend dependencies plus editable package were installed, `pip check` passed, and `npm.cmd --prefix frontend ci` installed 240 packages. Alembic migrated a new SQLite database from base to `e9b6f0a42c17 (head)`. `import_tmdb_catalogue --pages 15` completed with 297 inserted, 3 rejected and 297 active movies; all 297 had poster paths. The local review-account command returned `created`. SQLite integrity was `ok`; the backend health route returned HTTP 200 with `status=ok` and `migrationVersion=e9b6f0a42c17`. Frontend build and all 70 backend reset/gate tests passed. A separate backend on port 8020 and frontend on port 5180 returned HTTP 200 and the frontend proxy returned 10 movies. Those temporary services were stopped without touching the running application on ports 8000/5173. The temporary clone is not a substitute for rerunning CI on the future committed PR head.

### Candidate source hashes and remote PR state

SHA-256 values for the files tested in the final local runs:

| File | SHA-256 |
|---|---|
| `frontend/src/auth/resetInvalidation.ts` | `00a115dbb8d4850cfb6f9d90379e6ae034b7a6e01d6924962d9a54f8a84c41d7` |
| `frontend/src/pages/ProfilePage.tsx` | `c3bbdfdbee2646621ffcdf9127138ce158de91460876cf576555a6e1ad3ad399` |
| `frontend/e2e/t01.visual.ts` | `20b2090f6580b5790c72baffeb3dfc125cac76f4a468361d142ac64e326a2f7b` |
| `frontend/e2e/t13.profile.ts` | `4a341a127c8d5ccc5e4878c062888f38f190895b94eac2fe0c46e0d011633d2b` |
| `frontend/playwright.s04.config.ts` | `2f13848dc0534f38d9c404d3f4c277780a1e3fbd8dd3fe60e51fdad3beb8ba8a` |
| `frontend/scripts/run-s04-e2e.mjs` | `b5a67787c9d605d876c93794159ec1a292de2e08a704d917f51a773522a00952` |
| `backend/scripts/s04_acceptance_server.py` | `52389bd07f153f7364c438bdf25e29fe7498515c0e32f482435724c8c1486cb5` |
| `backend/tests/test_s04_acceptance_gate.py` | `7b729aaff95ba5fbc20fc9d9b2e942d22e118f46b92360c419e3c48544c1f459` |

At the 2026-10-27 audit, the public GitHub API showed PR #234 open at `ab62c61`, targeting base `486adab`, mergeable for the **committed** head, with 0 reviews and no requested reviewer. Of 21 check runs on that old head, 20 succeeded and only `Someone else must review` failed. Issue #209 remained open. None of those remote checks covers the uncommitted correction; a new commit and push, CI on its SHA, author declaration and an independent teammate review are still required before merge.

## Acceptance and remaining gates

The four S11 Story criteria recorded in `docs/requirements.md` are reset A from 3/2 to 0/0, no change on cancellation, exact success message, and B retaining 1/1. The T13/T14 browser path exercises all four, but T15 #210 owns the complete independent Story acceptance; this document does not mark Story #33 done. The local T01 and T13 fixture gates now pass twice with clean runner exits. Remaining closure work: the author commits and pushes the candidate, checks CI and clean-checkout evidence on that new SHA, confirms the author declarations, obtains a substantive non-coauthor review and approval, then merges and verifies issue/board closure. No teammate approval or merge is claimed here.
