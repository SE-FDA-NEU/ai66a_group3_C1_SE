# S4-T12 author verification

Initial capture: 2026-10-25 (Asia/Saigon). Author/tester: Codex in the user's
local workspace. Base commit: `d3c24acec0e1e0d67c4004328e7cf096775f8f6f`,
which contains merged T01 PR #224. At the time of this initial capture, the
T12 changes were uncommitted. A later committed-head and post-setup recheck is
recorded below.

The initial uncommitted backend/frontend source fingerprint, recorded with the
script version at that time, was
`files=26 sha256=ed6210072c19a17f3ccb8c5791c365fff631abc5dcd8c94333f744f10c0692dc`.
The built frontend JavaScript SHA-256 was
`18C19F38576BBFA80998F49F938D4E788A9830BF773464C6B936CC0A85785FD1`.
These hashes identify the initial, uncommitted source snapshot; they are not
the current committed-head fingerprint.

| Verification                                                                                                                                                                      | Expected                                                                                                                                                                                                           | Observed                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `python backend/scripts/run_isolated_tests.py -q` using `.venv\Scripts\python.exe`                                                                                                | Offline isolated suite, no TMDb token                                                                                                                                                                              | 576 passed, 1 skipped; temporary DB migrated to `e9b6f0a42c17`. This run preceded one additional focused DELETE-failure test; production code did not change afterward.                                                                             |
| `.venv\Scripts\python.exe -m pytest backend/tests/test_s4_t12_watchlist.py backend/tests/test_s4_t12_watchlist_migration.py -q`                                                   | Profile A3/2/B1/1, reset isolation, watchlist auth/validation/idempotency/rollback, fresh/populated migration, real file DB concurrent PUT, reset failures and engine restart                                      | 19 passed, 1 warning; no live provider calls                                                                                                                                                                                                        |
| `.venv\Scripts\python.exe -m ruff check backend`                                                                                                                                  | No lint findings                                                                                                                                                                                                   | Passed                                                                                                                                                                                                                                              |
| `cd frontend; npm.cmd test`                                                                                                                                                       | Frontend component/regression suite                                                                                                                                                                                | 316 passed across 30 files                                                                                                                                                                                                                          |
| `cd frontend; npm.cmd run lint; npm.cmd run build`                                                                                                                                | Lint and production build                                                                                                                                                                                          | Both passed                                                                                                                                                                                                                                         |
| `git diff --check`                                                                                                                                                                | No whitespace errors                                                                                                                                                                                               | Passed                                                                                                                                                                                                                                              |
| `cd frontend; $env:S04_BROWSER_CHANNEL='chrome'; $env:T12_SCREENSHOT_DIR='<repo>\docs\evidence\s4-t12-watchlist'; node scripts/run-s04-e2e.mjs --config playwright.t12.config.ts` | Detail save/remove, reload, A/B later login, safe guest sign-in return, no guest private fetch, list return, 11-row paging, last-row clamp, mobile/tablet/desktop, themes, keyboard focus, guest/error/empty views | Both Playwright test bodies reported `ok` with real Chrome and isolated migrated SQLite. The pre-existing Windows runner did not exit after Playwright's web-server teardown and was interrupted; therefore this is not a clean exit-code pass.     |
| `cd frontend; $env:S04_BROWSER_CHANNEL='chrome'; npm.cmd run test:t01:ui`                                                                                                         | Existing T01 regression                                                                                                                                                                                            | Second full run reported 11 `ok`, 1 expected live-import-only skip. An earlier full run had one timeout in the genre-card test; that test passed alone and on the second full run. The same Windows teardown hang required interrupting the runner. |

## Recheck after local setup and main merge

On 2026-10-25, the checked-out HEAD was
`e9151449b6746960a798c590a9e066e05222f9b9`. Its tree is identical to the
preceding merge commit `c73b2d0`; the merged T03 ranking changes are included
in this recheck. Run `.\.venv\Scripts\python.exe scripts/s4_t12_fingerprint.py`
from the repo root. The updated script compares the
backend/frontend source tree with the T12 base commit, including files from the
merged main branch. Before the real-catalogue visual test below was added, it reported
`files=34 sha256=b2704f28708914c0da199435b2efe729ba3e83caedc4fc9059f51043e3168ecb`.

The existing local SQLite database was backed up with SQLite's backup API,
then migrated from `c6f8a2d4e901` through `d8a4e6f20195` to
`e9b6f0a42c17`. The documented 15-page TMDb import completed with 290 active
movies, and the local review account command returned `created`. A post-setup
integrity check returned `quick_check=ok`; `/health` and the first ten local
movie summaries both returned HTTP 200. A disposable SQLite backup of that
imported database passed real API checks for two isolated accounts, save,
reset preserving both watchlists, logout/later login, remove, and persisted row
counts. The disposable copy was removed; the original database was not used
for those account writes.

| Recheck on this source tree | Observed |
| --- | --- |
| `.\.venv\Scripts\python.exe backend/scripts/run_isolated_tests.py -q` | 594 passed, 1 skipped; exit 0. One Starlette/httpx dependency deprecation warning. |
| `cd frontend; npm.cmd test` | 316 passed across 30 files; exit 0. |
| `.\.venv\Scripts\python.exe -m ruff check backend` and `cd frontend; npm.cmd run lint` | Both passed; exit 0. |
| `npm.cmd --prefix frontend run build` | TypeScript and Vite production build passed; exit 0. |
| `cd frontend; $env:S04_BROWSER_CHANNEL='chrome'; node scripts/run-s04-e2e.mjs --config playwright.t12.config.ts` | With normal local process-tree rights: 2 passed, exit 0, `s04_temporary_database_removed=true`. A prior run inside the restricted process sandbox reported both test bodies `ok` but hung during web-server teardown and was interrupted; that restricted run is not counted as a pass. |
| `cd frontend; $env:S04_BROWSER_CHANNEL='chrome'; npm.cmd run test:t01:ui` | 11 passed, 1 expected live-import-only skip, exit 0, `s04_temporary_database_removed=true`, with normal local process-tree rights. |

The tracked setup example previously showed the older migration version in its
`/health` response. It has been corrected to `e9b6f0a42c17`. No new package or
environment variable was required after setup.

Expected/observed API details: profile GET returned A's three genres, two
ratings and one saved movie, while B had one rating and its own saved movie.
Confirmed A reset returned exactly `{data:{reset:true}}`, then A read 0/0/1
while B's data and both watchlists remained. Missing/invalid confirmation,
session failures and injected mid-delete/commit failure did not mutate rows.
Watchlist repeated PUT returned the original `addedAt` and one row; two
simultaneous PUTs against separate real SQLite connections both returned 200
with the same timestamp and one row. Known unsaved DELETE returned 200.
Invalid paging, forged account selectors, unknown local ID and cross-origin
writes returned 400/404/403 without mutation. A write DB/commit failure
returned 503 and a fresh membership read remained false. A forced timestamp
tie ordered rows by internal ID before the ten-item slice. The
file-backed reset failure/commit-failure cases retained both A/B watchlists
while the confirmed reset cleared only A's genres/ratings. The populated
migration and re-import retained users, sessions, preferences, ratings, media,
internal movie IDs and watchlist rows; a new engine and later A/B logins read
both saved lists.

The browser screenshots are actual Chrome captures against a synthetic local
catalogue, with null posters exercising the shared fallback:

- [Guest detail](detail-guest-dark-1440.png), [saved detail](detail-saved-dark-1440.png), [empty state](watchlist-empty-dark-1440.png), [error state](watchlist-error-light-1440.png)
- [Dark mobile](watchlist-dark-375.png), [dark tablet](watchlist-dark-768.png), [dark desktop](watchlist-dark-1440.png)
- [Light mobile](watchlist-light-375.png), [light tablet](watchlist-light-768.png), [light desktop](watchlist-light-1440.png), [ten-card page](watchlist-grid-light-1440.png)

### Real imported-catalogue screenshots

The PR's primary screenshots use the local 15-page TMDb import: 290 active
movies, all with a stored poster path at capture time. The acceptance harness
copies that SQLite database to its own temporary directory, disables the TMDb
token, and creates `watchlist-visual@example.test` only in the copy. It saves
the ten most popular local movies, checks that all ten real CDN posters load,
then captures the watchlist and exact-movie detail page. The original local
database and its accounts are unchanged. Reproduce from the repo root with
Chrome installed:

```powershell
$env:S13_TMDB_SMOKE = '1'
$env:S13_TMDB_DATABASE = (Resolve-Path data/app.db).Path
$env:T12_REAL_SCREENSHOT_DIR = (Resolve-Path docs/evidence/s4-t12-watchlist).Path
$env:S04_BROWSER_CHANNEL = 'chrome'
Push-Location frontend
node scripts/run-s04-e2e.mjs --config playwright.t12-real.config.ts
Pop-Location
```

Observed on 2026-10-25: 1 Playwright test passed, exit 0, and
`s04_temporary_database_removed=true`. All ten list posters had a nonzero
image width in Chrome. The capture ran at HEAD
`b60a55885ad46d308643d901606f3d601c9cccc8` with the new visual test and
config still in the working tree; its backend/frontend fingerprint was
`files=36 sha256=611ac92fc2783b98c7ac24fa51068702147b69826ad76a28a3d936604d12e511`.
The screenshots were inspected after capture:

- [Real watchlist, dark desktop](watchlist-real-dark-1440.png): ten named movies with loaded posters and remove/detail controls.
- [Real saved-movie detail, dark desktop](detail-real-dark-1440.png): the selected film's poster, title, return link, and saved state.
- [Real watchlist, light mobile](watchlist-real-light-375.png): responsive header and movie cards with loaded posters.

The earlier synthetic screenshots remain as evidence for null-poster fallback,
empty/error states, pagination, focus, and both themes.

This is author evidence at the committed source SHA above. Independent
non-coauthor API/DB/browser review, reviewer identity, required CI, merge and
issue closure remain pending. Actual profile confirmation/cancel/navigation UI
belongs to S4-T13/T15 and is not claimed by this API/watchlist implementation.
No Story #33 UI acceptance was marked complete from API tests.

The issue's historical 17h author/3h reviewer estimates were not treated as
approved capacity or actual time. C01/PO reforecast and the named reviewer's
expected/actual record still need to be completed in the project workflow.
