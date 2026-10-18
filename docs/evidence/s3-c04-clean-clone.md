# S3-C04 clean-clone and offline verification record

Latest tested by: Codex on the requested C04 review follow-up, 2026-10-18
(Sprint 3), Windows PowerShell, Python 3.12.6, Node.js 24.19.0 / npm 11.17.0,
Microsoft Edge 155.0.4283.62. This is executable verification, not teammate approval.

Tested committed application **and verification-code** SHA:
[`05dda34900fd0fa80cfff323b353a8d4c220a4d8`](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/commit/05dda34900fd0fa80cfff323b353a8d4c220a4d8).
Its base `86a758eb2468f3e23357b69adf3c3183e5110a40` already includes shipped
T26/T27/T37 and [T28 / #131 acceptance](s3-t28-backdrop-acceptance/README.md).
The review follow-up changes documentation/screenshots/evidence only; it does
not alter application, migration, test, runner, lockfile or CI executable code.

The normalized UTF-8/LF executable-source SHA-256 is
`8ac82a4ed16a3a80692dc1341032c0d8ff971f79d4d26b893678e2f57f5c8ac5`.
The [live report](s3-c04-final/live/results.json) records its exact file manifest,
commit, clean working tree, browser, provenance and actual assertions. This
identifies what was tested without placing a future/self-referential commit
hash in its own file. The PR records the final documentation commit and checks.

**Setup and functional verification passed. Independent teammate review,
approval and merge remain required before closing #135.**

## Latest committed-candidate clean clone and complete UI replay

A new local `git clone --no-hardlinks` of the committed candidate was created
in a separate Windows path containing Vietnamese characters. No `.env`, DB,
venv or `node_modules` was copied from an existing checkout. Python 3.12 created
a new venv; the locked backend install, editable install, `pip check` and
`npm.cmd --prefix frontend ci` all passed. The clone's ignored `.env` contains
only the example database setting and a **blank** token. A private configured
token was supplied only to the live importer child process, never copied to a
file, printed or supplied to browser/runtime acceptance.

| Verification | Actual result |
|---|---|
| Fresh migration | All migrations applied; exactly one head, `c6f8a2d4e901`. No seed command. |
| Missing token before import | Exit 1 with actionable configuration guidance; 0 revisions and 0 movies. |
| Real bounded import | Exit 0; provider `tmdb`; revision `6988eeeb-79e0-41ad-ab7a-5248f06a0659`; 20 inserted, 0 updated/rejected; 20 movies, 13 associated genres, 20 finite-popularity movies. |
| Read-only provenance | 20 distinct source IDs, 20 TMDb rows, 20 fetch timestamps. Fetched `2026-10-18T08:18:02.966596Z`; imported `2026-10-18T08:18:04.026754Z`. CLI sample source IDs: `969681`, `1291595`, `1148365`. The live report's sorted SQL sample is labelled separately. |
| Actual browser journey | Home → Sign in → Create an account → Create account → Sign in → popular cold start → Enter preferences → save 3 genres → personalised recommendations → View details → save rating 4 → Back to recommendations → Sign out. No feature-URL shortcuts or mocked API responses. |
| Actual restart | Both owned FastAPI and Vite processes were terminated and started again on the same DB, without migration/import/seed between starts. A new browser context signed in as A: all 3 selections were checked and the same movie showed `Your saved rating: 4/5` without another write. |
| Second account | B was registered through visible links, had 0 preferences and popular cold start, and saw `Not rated yet` on the same movie. The disposable DB held 2 users, 3 preference rows and 1 rating. |
| Missing token after import | Exit 1; a logical snapshot of **all nine application tables** was identical before/after, including the revision, catalogue, users, sessions, preferences and rating. |
| Offline backend runner | New locked Python environment; inherited fake token was cleared; 419 passed, 1 inherited skip. Ruff passed. The runner creates/migrates/removes its own test DB, not the live-imported clone DB. |
| Frontend | 236 tests / 20 files passed; ESLint, TypeScript/Vite build and 3 runner-cleanup tests passed. |
| S04/S13 synthetic browser | `S04_BROWSER_CHANNEL=msedge`, blank token, `TMDB_NETWORK_DISABLED=1`: 10 passed, 1 intentional opt-in live skip; disposable DB removed. |
| T28 synthetic | 18 real-browser/API/DB cases passed using the new clone's dependencies; `temporary_database_removed=true`. |
| T28 manual live image | 2 cases passed at 1280px and 375px against a read-only backup of the clone's imported DB. Actual public CDN images loaded, the source DB hash stayed unchanged and the temporary DB was removed; [machine-readable report](s3-c04-final/backdrop-live/results.json). |
| Production dependency audit | `npm.cmd --prefix frontend audit --omit=dev`: 0 vulnerabilities. Full audit retains the existing high-severity transitive dev-only `source-map-js` advisory; lockfiles were not changed by this follow-up. |

The browser replay used a local Playwright utility with real clicks, the real
FastAPI API and the freshly imported SQLite DB. Reproduce it manually using
the numbered [setup journey](../SETUP.md#disposable-test-account-and-p0-journey).
It is not evidence that an unfamiliar human or the instructor used the app.
Runtime acceptance used a blank token and disabled TMDb API networking; public
image-CDN requests are separate from API metadata requests.

Real, sanitized browser captures:

- [Personalised list](s3-c04-final/live/01-live-recommendations.png).
- [Rating confirmed before restart](s3-c04-final/live/02-live-rating-saved.png).
- [Saved rating restored after actual restart](s3-c04-final/live/03-live-after-restart.png).
- [Account B remains unrated](s3-c04-final/live/04-live-account-b.png).
- [Actual live backdrop, desktop](s3-c04-final/backdrop-live/live-1280.png)
  and [375px](s3-c04-final/backdrop-live/live-375.png).

These are page captures, not address-bar screenshots for the C05 submission PDF.
They prove the labelled UI states, not completion of every parent Story.
Early rating captures may precede image loading; actual image-load acceptance
comes from the separately labelled T28 live report, not those rating captures.

An initial **utility** run used an exact link name without the visible arrow
in `Enter preferences →` and timed out. The local selector was corrected; the
sole generated account from that failed probe was removed only from the
disposable clone DB, and the complete replay passed. No product code was changed
to obtain a pass. The user's existing `.env` and 255-movie development database
were not modified or reseeded.

## Hosted CI for the committed executable candidate

All 11 technical checks on `05dda34900fd0fa80cfff323b353a8d4c220a4d8` passed:
[Python/Node/secrets](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/39109933393),
[S04 and Windows/Linux cleanup](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/39109933409),
[T16](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/39109933381),
[T33](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/39109933413),
[T34](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/39109933450),
and [T28](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/39109933387).
The follow-up documentation commit must also pass hosted checks. Technical
success does not establish independent approval; the Scrum review gate remains
separate. Use `Closes #135` in the completed PR description, not only `Refs #135`.

## Earlier preparation history (not the latest candidate result)

The original preparation below ran with Python 3.12.10 / Node.js 24.15.0 on
base `86a758eb2468f3e23357b69adf3c3183e5110a40` plus then-uncommitted changes.
Its DNS failures and later successes are retained as history, not relabelled
as a run of the final committed candidate.

## Fresh environment

A new local Git clone was made without copying the original `.env`, database,
Python environment or `node_modules`. The uncommitted candidate files were
copied into it. `.env` was copied from `.env.example` with a blank token. The
Python 3.12 retry used a new virtual environment inside that clone.

| Check | Actual result |
|---|---|
| Python 3.12 prerequisite | Passed: Python 3.12.10 at `$env:LOCALAPPDATA\Programs\Python\Python312\python.exe`; `py -3.12` does not detect it, so the full executable path was used. |
| Locked backend install | Passed in a new Python 3.12 virtual environment. Network escalation was needed to reach the package index for the lockfile and editable build dependency. |
| `npm.cmd --prefix frontend ci` | Passed: 240 packages installed from the lockfile. |
| Migration from empty SQLite database | Passed with Python 3.12.10: Alembic head `c6f8a2d4e901`. |
| Import with blank token | Failed as required, exit 1, with safe `TMDB_READ_ACCESS_TOKEN` setup guidance. No active revision or movie rows were created. |
| Import with private locally configured token | Failed, exit 1: DNS/network access to `api.themoviedb.org` was unavailable, including on a retry with elevated sandbox permissions. A later diagnostic found that the default resolver returned loopback (`127.0.0.1`/`::1`) for that hostname; a public resolver returned CDN addresses and an unauthenticated HTTPS request with a temporary curl DNS override reached TMDb (`401` as expected). Token value was not printed or copied into the clone. Active revisions: 0; movies: 0. |
| Frontend unit tests, lint, build in fresh clone | Passed: 236 tests across 20 files; lint and production build passed. |
| Backend isolated suite | Run through `backend/scripts/run_isolated_tests.py` in the new Python 3.12 environment: disposable migrated SQLite, blank token and `TMDB_NETWORK_DISABLED=1`. Results recorded below. |

At the time of that fresh-clone run, the development/staging path was
**pending**: no successful live TMDb catalogue, source IDs, fetch/import
timestamps, catalogue counts or API smoke could be claimed from that clone.
The historical M2 seed was used only in
the separate automated restart-persistence test database. It was never loaded
into the development clone's database.

## Live development checkout after DNS repair

The Windows DNS resolver initially returned `127.0.0.1`/`::1` for
`api.themoviedb.org`. After the network/DNS configuration changed, it returned
public CDN addresses and port 443 connected. A token-free HTTPS request reached
TMDb and returned the expected unauthenticated `401`. The private token remained
in the ignored local configuration and was never printed.

On the existing development checkout, the Python 3.12.10 importer completed on
2026-10-18 with exit 0. This was a live development result; the later final
clean-clone result is recorded below:

| Check | Actual result |
|---|---|
| Schema | Alembic `c6f8a2d4e901` (head). |
| Import | `provider=tmdb`; revision `dc3ab8e4-476e-4d93-a172-59c4e154312e`; inserted 20, updated 0, rejected 0. |
| Provenance SQL, read only | 20 active movies, 20 distinct source IDs, 0 non-TMDb movies, 20 finite-popularity movies, 20 fetch timestamps, 13 associated genres. Source fetched at `2026-10-18T07:28:10.417341Z`; revision created/imported at `2026-10-18T07:28:12.121371Z`. Sample stored source IDs: `1058424`, `1084244`, `1101383`. |
| API smoke via FastAPI TestClient | `/health`, `/api/movies?limit=10`, `/api/movies/popular?limit=10`, and one `/api/movies/{movieId}` each returned 200. Both lists referenced the same active revision; popular had 10 distinct finite-popularity movies in descending score order. |
| Real Chrome navigation on a disposable copy | S01/T22 passed: first screen, account creation/sign-in, catalogue-backed genre selection, recommendations, preference restoration and account isolation. The copy was deleted; the original development database was not used for test-account writes. |

## Isolated verification

- The process-restart persistence test passed, verifying saved preferences
  and a rating on a migrated, synthetic database after a new application
  process started. The offline guard test passed with an inherited fake token.
- A synthetic S04 Chrome browser case passed its assertions for real sign-in,
  visible preference navigation and recommendations, including on the Python
  3.12 retry. The local Playwright runner did not exit during server teardown,
  so this is partial browser evidence, not a completed S04 run. Its temporary
  directories were removed manually after interruption. The separate S04
  runner cleanup suite passed all 3 tests.
- T16 integration: 1 passed. T33 integration: 1 passed. Both used the new
  Python 3.12 environment, temporary migrated databases, blank tokens and
  `TMDB_NETWORK_DISABLED=1`.
- Backend Ruff passed with Python 3.12. The full isolated Python 3.12 backend
  suite passed: 419 passed, 1 skipped. One Starlette/httpx deprecation warning
  was emitted. The temporary test database was removed by the runner.
- A local T28 synthetic browser run initially completed its assertions but
  failed to remove its locked Windows database. After the runner waited for
  child processes to exit, the repeat passed all 18 cases and reported
  `temporary_database_removed=true`.
- T34 real-browser synthetic acceptance passed with Python 3.12.10 and Chrome
  after Chrome's GPU process failed under the restricted sandbox. It verified
  rating protection/recovery, account isolation and database integrity.
- S04 real-browser synthetic acceptance completed with exit 0: 10 passed, one
  separate live-TMDb case skipped by design, and the temporary database was
  removed. The earlier Windows teardown hang did not recur outside the
  restricted sandbox.

## Final clean clone after DNS repair

A second local clone was created from base SHA
`86a758eb2468f3e23357b69adf3c3183e5110a40` and overlaid with all current
uncommitted candidate files. It had no prior `.env`, project database, venv or
`node_modules`. The ignored `.env` was copied from `.env.example` with a blank
token. The private local token was passed only to the live import process via
its environment; it was not written into the clone or output.

| Check | Actual result |
|---|---|
| Locked setup | Fresh Python 3.12.10 venv, locked backend install, editable backend install, `npm.cmd --prefix frontend ci`, and `pip check` passed. |
| Empty database migration | Applied every migration to `c6f8a2d4e901` (head), including nullable backdrop storage. No M2 seed was run. |
| Missing token before import | Exit 1 with safe configuration guidance; active revisions 0, movies 0. |
| Live import | Exit 0; provider `tmdb`, revision `848e4a68-d45e-4aca-a207-88d5f9f3b266`; 20 inserted, 0 updated/rejected; 20 movies, 13 associated genres, 20 finite-popularity movies. |
| Read-only provenance | 20 distinct source IDs, 0 non-TMDb rows, 20 fetch timestamps. Fetched at `2026-10-18T07:39:34.086300Z`; imported at `2026-10-18T07:39:35.659465Z`. Sample stored source IDs: `1058424`, `1084244`, `1101383`. |
| API smoke | Health, movie list, popular list and one detail returned 200 on the imported revision; popular returned 10 distinct movies with finite popularity. |
| Browser navigation and personal data | S01/T22 passed on the clone's live catalogue through visible Start/account/preferences/recommendations navigation with two disposable accounts. A separate API process saved rating 4; a later application process restored five preferences, rating 4 and recommendations for A, while B had no access to A's rating. The live-browser run did not click a movie detail link or save a rating through the visible UI. |
| Missing token after import | Exit 1; the same active revision and all 20 active movies remained. |
| Backend suite with inherited real token | The isolated runner blanked the token, disabled provider networking, migrated a disposable database and passed 419 tests (1 skipped). The accepted TMDb revision and 20 active movies remained unchanged. |
| T28 live backdrop check | On a temporary copy, desktop/mobile Chrome image cases passed; CDN responses were 200, no credential-bearing image requests or unexpected hosts occurred, the source database hash was unchanged, and the temporary database was removed. |
| Frontend lint | Passed after the Windows T28 runner cleanup fix. |

The first T28 live invocation stopped before any case because the sandbox-owned
clone failed Git's ownership check when run as the interactive Windows user.
A process-scoped `safe.directory` setting allowed the repeat to run; no global
Git setting was changed.

## Remaining review checks

The latest replay above resolves the earlier uncommitted-candidate and missing
detail/rating/restart walkthrough gaps. Obtain a substantive independent
teammate review and approval, verify checks on the final PR head, and merge
before closing #135. A later executable, migration or configuration change
requires affected checks to be repeated on its actual candidate.

Instructor token setup on another machine has **not** been observed. The
documented path is the instructor/operator's own private token, or a privately
prepared staging backend if local provisioning is unavailable. Confirm the
chosen arrangement before review; never distribute a team token or claim an
unperformed instructor-machine check. No token, `.env`, DB/dump or live
provider payload is part of this evidence.
