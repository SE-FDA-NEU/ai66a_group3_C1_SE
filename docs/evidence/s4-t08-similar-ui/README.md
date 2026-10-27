# S4-T08 similar-movie UI and Story #24 acceptance

Issue [#203](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/203),
Story [#24](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/24).
Executed locally on 2026-10-27 (Asia/Ho_Chi_Minh). Story #24's five criteria are
taken in order from the story text. This records the author's executed
acceptance. It does not claim the independent re-run that the issue requires of
the reviewer (@NguyenTuanAnh0608), CI, or any change to GitHub issue state.

## Tested source and reused dependencies

Tested base: `a478bb08ba274230475ceae998e03bb0fdb9edaa` (main after PR #231),
plus the working-tree changes below; verification ran before the delivery
commits. [tested-source.sha256](tested-source.sha256) lists the changed and
reused files, hashed after UTF-8 LF normalisation.

Reused, not resubmitted:

- T07 public API `GET /api/movies/{movieId}/similar`, its ranking and its
  backend tests (PR #229, `backend/tests/test_similar_movies_api.py`).
- T06 shared TF-IDF index (PR #225) and T01 shared UI components and tokens
  ([contract](../../s4-t01-ui-contract.md)).
- T10's Playwright runner, isolated database and response-gate harness.

## Implementation and changed files

| File | Change |
|---|---|
| `frontend/src/components/SimilarMovies.tsx` (new) | Separate widget: loading, up to five distinct cards other than the source in API order, empty state, error with `Retry similar movies`. Request identity is the movie ID plus retry; every read is aborted on change and late completions are ignored. |
| `frontend/src/pages/MovieDetailPage.tsx` | Mounts the widget below the body, `key`ed by movie, passing the already validated return destination and list context. |
| `frontend/src/api/movies.ts` | Typed `getSimilarMovies(movieId, signal)` using the shared error mapping. |
| `frontend/src/index.css` | Two scoped rules (section spacing and the mobile gutter); cards reuse the shared grid, poster fallback and tokens. |
| `frontend/src/tests/similar-movies.test.tsx` (new) | 10 widget and page tests (see below). |
| `frontend/src/tests/movie-detail-rating.test.tsx`, `movie-backdrop.test.tsx`, `movies.test.tsx`, `onboarding-polish.test.tsx` | Existing detail-page tests now answer the new Similar read and count it. No assertion was removed or relaxed. |
| `backend/scripts/s04_acceptance_server.py` | Test-only harness: eight `similar-*` scenarios on the real SQLite catalogue that rebuild the real index and return the real cosine scores; `/similar` responses can be held by the existing gate; every scenario now restores the seed `movie_genres`. |
| `frontend/e2e/t01.visual.ts` | Three `S07` browser tests on the existing T01 runner. |
| `docs/api.md`, `docs/s4-t01-ui-contract.md`, `docs/traceability.md`, `docs/evidence/s4-c03-acceptance-matrix.md` | Link the delivered UI and record the new `api.md` hash. |

No production backend, schema, dependency or provider change. The widget never
calls the account, rating or watchlist APIs and never calls TMDb.

## Five Story #24 criteria: expected and observed

Fixtures are synthetic and offline. Source `Moon Source` (Action, Archive) has
seven distinct eligible candidates; `Moon Rescue` matches through both genres,
so the raw genre join returns it twice. Popularity runs opposite to cosine and
the most popular candidate has no overview, so a popularity-only or
text-ignoring order would be visibly wrong. Scores below are the real index's
cosine values read from the harness
([similar-api-db.json](screenshots/similar-api-db.json)).

| AC | Expected | Observed (real API, SQLite and browser) |
|---|---|---|
| 1 — up to 5 different movies sharing a genre | At most five distinct movies, never the source, each sharing at least one genre. | Passed. API returns exactly 5 distinct IDs: Moon Rescue, Orbit Medic, City Robot, Desert Heist, Jazz Voyage. The source is absent and each shares a genre with the source (checked from the detail API). The two further candidates, Quiet Archive and Archive candidate, are not shown. The browser renders the same five links in the same order at 375, 768 and 1440 px in both themes. |
| 2 — no suitable candidate | A clear no-similar message and the original details stay visible. | Passed. `Archive candidate` is the only Archive movie: API `data.movies = []`. The page shows the `Archive candidate` heading and Overview plus `No similar movies are available`, with no alert and no card. |
| 3 — select a similar movie | Opens the details page for the selected movie ID. | Passed. A click (light theme) and Enter on the keyboard-focused link (dark theme) open `/movies/<selected id>`. The heading is the selected movie, and its own Similar section equals that movie's API response, which excludes itself. |
| 4 — higher TF-IDF cosine first | Cosine A above B means A is listed before B. | Passed. Cosines are Moon Rescue `0.8277369360823477` > Orbit Medic `0.23829541906570992` > City Robot `0.1078680014034405` > 0, while popularity is 5, 10 and 20. UI and API order is Moon Rescue, Orbit Medic, City Robot. Without a missing-text candidate (`0.8060212567376087` > `0.21474145467528344`) the order is Moon Rescue, Orbit Medic. Adding Quiet Archive (no overview, popularity 100) gives Moon Rescue, Orbit Medic, Quiet Archive, so the A/B order is unchanged. |
| 5 — missing overview does not fail | No error; genre-and-popularity fallback ordering. | Passed. Missing, blank (`"   "`) and zero-vector (`"the of and"`) sources all give `sourceUsable: false` and the whole eligible list in popularity order: Quiet Archive (100), Orbit Medic (10), Moon Rescue (5). Candidates with valid cosine `0` (Desert Heist, Jazz Voyage) stay ahead of the missing-text candidate despite its higher popularity. No alert and no page error in any case. |

## Failure, race, account and navigation checks

- **Failed index.** Deleting the real index file gives 503 `INDEX_UNAVAILABLE`
  and an inline alert, `Similar movies are unavailable. Search index is
  temporarily unavailable`, with a `Retry similar movies` button. The source
  details stay visible; the empty message and any fallback ordering are absent.
  Rebuilding the index and clicking Retry shows the five movies; the observed
  `/similar` statuses are `[503, 200]`.
- **Delayed response.** The harness holds the real computed response for movie
  A, the browser leaves A and opens B through Search, and the held response is
  then released. B's section equals B's own API response and never contains
  A's list. Unit tests cover a transport that ignores abort: after a prop-only
  movie change, and after a late failure, the section shows only the current
  movie.
- **Public and account-independent.** Guest and two registered accounts see
  identical IDs and order. The signed-in account has saved genre Action; its
  preferences are identical before and after, with no preference write. A
  Playwright route makes the rating API return 503 for that account: the rating
  widget reports it while the Similar cards still render. Conversely, a failed
  Similar read leaves the rating widget loaded (unit test). The page makes no
  request to `api.themoviedb.org`.
- **Safe return context.** From `/search?q=astronaut+rescue+moon#results` the
  details page and the next similar movie keep the link
  `Back to search` pointing to the same query and fragment, and following it
  restores the query. Unit tests show an unsafe `returnTo` falls back to the
  catalogue.
- **Keyboard and layout.** From the last details control Tab enters the first
  similar link, follows API order through all five and Shift+Tab reverses it.
  The focus outline is present. No horizontal overflow at 375, 768 or 1440 px
  in either theme.
- **Unit comparator coverage (unchanged T07 tests).** Ties, null popularity,
  missing/blank/zero-vector source and candidates, duplicates, source exclusion
  and the five-item limit are covered by the comparator and API cases in
  [test_similar_movies_api.py](../../../backend/tests/test_similar_movies_api.py).

### Widget unit tests (`similar-movies.test.tsx`)

Loading then five distinct cards in API order (duplicate and source removed);
public guest read with no `/api/me/` request; independence from failing
rating/watchlist reads and the reverse; empty state with details visible;
error, Retry and unchanged details; exact selected ID with safe return context;
unsafe return path fallback; movie change clears the section and aborts the old
read; prop-only rekey with a transport that ignores abort; late failure for A
cannot replace B. A mutation check removing the request-identity and abort
guards made the two ignore-abort tests fail; the file was then restored.

## Executed commands and results

Python is the repository `.venv`; the browser is Microsoft Edge
`156.0.4314.42` through Playwright's `msedge` channel (`S04_BROWSER_CHANNEL`),
because Playwright's own Chromium is not installed on this machine. Earlier
evidence used Chromium `156.0.8078.4`. `node_modules` was reinstalled from the
lockfile with `npm ci`; no package file changed.

| Command | Observed result | Log |
|---|---|---|
| `npm --prefix frontend test -- src/tests/similar-movies.test.tsx` | 10 passed | [focused-frontend.log](checks/focused-frontend.log) |
| `npm --prefix frontend test` | 392 passed, 35 files | [frontend-regression.log](checks/frontend-regression.log) |
| `npm --prefix frontend run lint` | Passed | [frontend-lint.log](checks/frontend-lint.log) |
| `npm --prefix frontend run build` | Passed, TypeScript and Vite | [frontend-build.log](checks/frontend-build.log) |
| `.venv/Scripts/python.exe -m pytest backend/tests/test_similar_movies_api.py backend/tests/test_overview_index.py backend/tests/test_auth_acceptance.py -v` | 37 passed (existing T07 API/comparator cases, T06 index, and the harness seed) | [focused-backend.log](checks/focused-backend.log) |
| `.venv/Scripts/python.exe backend/scripts/run_isolated_tests.py -v` | 656 passed, 1 existing skip | [backend-regression.log](checks/backend-regression.log) |
| `.venv/Scripts/python.exe -m ruff check backend` | Passed | [ruff.log](checks/ruff.log) |
| `T01_SCREENSHOT_DIR=../docs/evidence/s4-t08-similar-ui/screenshots npm --prefix frontend run test:t01:ui -- --grep S07` | 3 passed | [browser-s07.log](checks/browser-s07.log) |
| `npm --prefix frontend run test:t01:ui` | 16 passed, 1 imported-DB-only case skipped | [t01-regression.log](checks/t01-regression.log) |
| `npm --prefix frontend run test:s04:e2e` | 10 passed, 1 live-provider case skipped | [s04-regression.log](checks/s04-regression.log) |
| `git diff --check` | Passed | |

The runner removed its temporary database after each browser run. No
developer database or `.env` was read or changed, and no provider token or
network access was used.

## Screenshots (isolated synthetic fixture)

Captured by the S07 tests. Movies have no poster path, so the shared
`Poster unavailable` fallback is expected; these show the real UI and data of
the isolated fixture, not a TMDb import.

| View | Light | Dark |
|---|---|---|
| Mobile 375 px | [results](screenshots/similar-results-375-light.png) | [results](screenshots/similar-results-375-dark.png) |
| Tablet 768 px | [results](screenshots/similar-results-768-light.png) | [results](screenshots/similar-results-768-dark.png) |
| Desktop 1440 px | [results](screenshots/similar-results-1440-light.png) | [results](screenshots/similar-results-1440-dark.png) |

Other 375 px light states: [loading](screenshots/similar-loading-375-light.png),
[no similar movies](screenshots/similar-empty-375-light.png),
[index error](screenshots/similar-error-375-light.png),
[retry recovered](screenshots/similar-retry-375-light.png).

## Limits and what remains

- Chromium-family verification only (Edge); not a full accessibility or
  cross-browser certification. The rating outage is injected with a Playwright
  route; it is not a real rating-service failure.
- Live provider and imported-database checks are outside this synthetic offline
  acceptance.
- Independent review, the reviewer's own API/DB/browser re-run (expected and
  actual results, SHA and tester identity), CI and issue closure are still
  open. No Story #24 criterion in scope is unimplemented.
