# Post-M3 catalogue pagination and shared session navigation

Collected 2026-10-19 (Asia/Saigon) on branch
`feature/catalogue-pagination-session-nav`. This is new Task evidence; it
does not replace the recorded Sprint 3/M3 acceptance artifacts.

Tracking: [Task #193](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/193)
and [draft PR #194](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/194).

## Automated checks

- Backend: `python -m pytest backend/tests -q --disable-warnings --maxfail=10`:
  442 passed, 1 skipped. The Python interpreter was the existing isolated
  Python 3.12 environment in the workspace.
- Backend lint: `python -m ruff check backend`: passed.
- Frontend: `npm --prefix frontend test -- --reporter=dot`: 223 passed.
- Frontend lint: `npm --prefix frontend run lint`: passed.
- Frontend build: `npm --prefix frontend run build`: passed.
- Current T16 filter integration and T33 rating integration: each passed after
  updating their journeys for server-side filtering and alphabetical Home.
- Existing S04/S13 browser acceptance: 10 cases reported pass, 1 configured
  live smoke skipped on each of two runs. The Windows runner did not exit
  after test execution on either run; it was interrupted during server
  teardown. Treat these as reported test results, not a completed green runner
  exit. A clean rerun remains required.

`backend/tests/test_catalogue_pagination.py` covers 0, 1, 10, 11, 25 and 255
eligible movies; complete-set S06 filtering; mode preservation; alphabetical
Home vs finite-popularity Popular; out-of-range pages; and stale revision 409.
`frontend/src/tests/pagination-navigation.test.tsx` covers page/detail return,
whole-set filter navigation and revision reset. Existing affected tests were
updated for the new contract without changing submitted historical evidence.

## Configured TMDb database

The configured SQLite database was backed up to an ignored local
`data/backups/pre-pagination-20261019-014531.sqlite` before refresh. A first
15-page import attempt failed on sandbox DNS access and left the old revision
with 20 movies intact. The authorized network retry succeeded with 15 TMDb
pages: 252 active movies, 252 distinct source IDs, no non-TMDb active rows,
252 finite-popularity movies and 18 associated genres. The local review
account was created in that database and its login returned 200. See
[`live-import.json`](live-import.json) for the active revision, timestamps,
provenance counts and application API checks. Home `meta.total=252`, matching
the active count; Popular `meta.total=252`. The review account was reset to
its cold-start state after live browser capture.

## Live browser checks

Seven genuine Chrome viewport images are under [`browser/`](browser/), with
their actual routes in [`browser-results.json`](browser-results.json). They
show authenticated Home, Home page 2, Popular page 2, personalised Comedy
filter pages 1 and 2, a Music filter with zero matches, and clearing that
filter. The 102-item Action base mode remained personalised throughout; the
Comedy filter had 11 matches across two pages. The zero-match Music filter
showed an empty filtered view without popular fallback.

The execution session could capture browser viewports but Windows screen
capture returned an invalid handle for the full Chrome window. These images
therefore **do not include the address bar**. They must not be presented as
meeting the address-bar screenshot requirement. A reviewer with an interactive
desktop needs to repeat those captures before merge.

[`network-observation.json`](network-observation.json) records browser request
hosts during page-2 navigation. All 194 observed requests were to the local
Vite/application origin; none went to the TMDb metadata API. Its application
API paths exclude cookies, request bodies and credentials.

## Remaining release gates

- Create/link the GitHub Task and apply forward-looking Story amendments while
  retaining previous Sprint 3 acceptance history.
- Obtain an independent teammate's substantive review of the final changes.
- Repeat the browser screenshots with a visible address bar and rerun the
  current S04/S13 browser runner to a clean process exit.
