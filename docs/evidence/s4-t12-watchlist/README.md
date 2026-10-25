# S4-T12 author verification

Date: 2026-10-25 (Asia/Saigon). Author/tester: Codex in the user's local
workspace. Base commit: `d3c24acec0e1e0d67c4004328e7cf096775f8f6f`,
which contains merged T01 PR #224. No commit, PR, merge or issue closure was
created, per the user's instruction.

Reproduce the changed backend/frontend source fingerprint with
`.\.venv\Scripts\python.exe scripts/s4_t12_fingerprint.py` from the repo root.
Tested output: `files=26 sha256=ed6210072c19a17f3ccb8c5791c365fff631abc5dcd8c94333f744f10c0692dc`.
The built frontend JavaScript SHA-256 was
`18C19F38576BBFA80998F49F938D4E788A9830BF773464C6B936CC0A85785FD1`.
These hashes identify local, uncommitted files; they are not a tested commit SHA.

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

This is author evidence. Independent non-coauthor API/DB/browser review,
reviewer identity, a tested commit SHA, required CI, merge and issue closure
remain pending. Actual profile confirmation/cancel/navigation UI belongs to
S4-T13/T15 and is not claimed by this API/watchlist implementation. No Story
#33 UI acceptance was marked complete from API tests.

The issue's historical 17h author/3h reviewer estimates were not treated as
approved capacity or actual time. C01/PO reforecast and the named reviewer's
expected/actual record still need to be completed in the project workflow.
