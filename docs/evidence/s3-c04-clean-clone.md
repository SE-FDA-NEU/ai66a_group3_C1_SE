# S3-C04 clean-clone and offline verification record

Tested by: Codex, 2026-10-18 (Sprint 3), Windows PowerShell, Python 3.12.10,
Node.js 24.15.0.
Base SHA: `86a758eb2468f3e23357b69adf3c3183e5110a40`.
Candidate state: uncommitted changes on `chore/s3-c04-clean-clone-ci-135`.
There is no final candidate SHA until these changes are committed, as requested.

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

The final committed candidate SHA, remote GitHub Actions and PR review remain
pending because this candidate is intentionally uncommitted. The instructor's
independent token setup on a different machine has not been observed; the
procedure is in [SETUP.md](../SETUP.md). The full live-catalogue browser path
from a recommendation card through movie detail, rating, return navigation and
restart/sign-in still needs one manual walkthrough; current evidence combines
T22 live-browser navigation, a separate live-database API restart check and
T34 synthetic browser rating acceptance. Repeat affected checks if a later
migration, importer setting or application change alters this candidate. Do not
attach a token, `.env`, database file or real provider payload.
