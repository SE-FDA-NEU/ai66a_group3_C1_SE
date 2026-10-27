# S4-T10 public search and S08 acceptance

Latest UI screenshots: [2026-10-27 keyboard-submit capture](#current-ui-screenshots-2026-10-27).
The original 2026-10-26 screenshots and source manifest remain historical evidence.

Verified locally on 2026-10-26 (Asia/Ho_Chi_Minh). Story #30's five criteria
are taken in order from [requirements.md](../../requirements.md#s08-search-for-a-movie-by-title-or-description-p1-5-points).
This records executed local acceptance; it does not change GitHub issue state
or claim independent review, CI, or verification of later remote edits.

## Tested source and reused dependencies

Tested base HEAD: `657025bf451d2f932c94d29b87a6bb29108e030d`, plus the
feature changes listed below. Verification ran before the delivery commit;
`tested-source.sha256` preserves the exact verified source bytes.
[tested-source.sha256](tested-source.sha256) identifies the exact changed
implementation/test files and reused API/index/browser support inputs.
The manifest's SHA-256 is
`e0a2e701e433412db720f67ecf3af144c557ac0f808afb739d4b32ec18371555`.

Inspected merged T09 #204 through PR #228 (`79880b3`, implementation
`ec4b68d` and Unicode fix `1394685`), shared T06 index through PR #225,
T01 #195 through PRs #220/#224 and the subsequent button/title-sort amendment,
and C03 #217 through PR #222 (`37c2f66`). Scope and criteria use the current
local requirements/business rules and
[C03 search contract](../s4-c03-acceptance-matrix.md#s4-t09-search-api-consumer-amendment-2026-10-25).
Existing contracts/evidence are reused rather than submitted again:

- [T09 public API/index contract](../../api.md#132-shared-nlp-search-and-similar-reads).
- [T01 components, semantic tokens and safe navigation](../../s4-t01-ui-contract.md).
- [T01 onboarding/feedback/browser evidence](../s4-t01-onboarding-polish.md).

## Implementation and changed files

| Files | Change |
|---|---|
| `frontend/src/pages/SearchPage.tsx` (new) | Public URL-backed `q` input; trimmed Unicode validation; loading/results/empty/error/retry; abort and completion guards; first ten results in unchanged API order. |
| `frontend/src/api/movies.ts` | Typed `searchMovies` method, encoded trimmed query, shared API errors and AbortSignal. |
| `frontend/src/App.tsx`, `components/AppFrame.tsx` | Public `/search` route and active shared navigation link; existing session restoration. |
| `frontend/src/navigation/movieDetailReturn.ts` | Add only `/search` to the existing internal-route return allowlist. Cards preserve query, other URL parameters and hash. |
| `frontend/src/index.css` | Four scoped search-control rules using shared styling/tokens. |
| `frontend/src/tests/movies.test.tsx`, `cinematic-ui.test.tsx` | Extend existing movie tests; replace obsolete assertion that Search must be absent with a functional-link assertion. |
| `backend/tests/test_movie_search_api.py` | Extend existing SQLite/API fixtures with explicit positive/zero scores, wildcard validation/exclusion, empty catalogue, recovery and static-route checks. |
| `backend/scripts/s04_acceptance_server.py` | Add synthetic search scenarios and real search-response gates; keep index files in the runner-owned temporary directory. Existing scenarios restore original titles/overviews. |
| `frontend/e2e/t01.visual.ts` | Two search acceptance tests using existing T01 runner, screenshots, themes, focus and overflow helpers. |
| `docs/api.md`, `docs/traceability.md`, this directory | Link implemented UI and record acceptance, logs, screenshots and source hashes. |

Search updates as the user types; valid queries call only the existing local
search endpoint. The page uses `MovieGrid`/`MovieCard`, existing poster fallback,
shared status/button styles and theme tokens. It adds no ranking, notification,
auth or navigation store. The standard feedback provider remains in the shared
shell; automatic search reads use inline live status/alerts like the existing
public lists. No backend production, schema, dependency or provider change.

## Five S08 acceptance criteria — expected and observed

| AC | Expected | Actual observed result and evidence |
|---|---|---|
| 1 — known title | Searching `Inception` includes `Inception`; case and surrounding spaces do not alter matching. | Passed. Public real API fixture returns the expected ID for `  inCEPTION  `. Browser query `  inCEPTION  ` renders `Inception` first without login, then opens the real detail page and returns to the same search. API title response is in [browser/API/DB observations](screenshots/search-api-db.json). |
| 2 — ten-result cap | More than ten matches display only the server's first ten, retaining title-first ordering. | Passed. Backend fixture has 12 title hits; IDs equal the first ten in server order. Browser fixture has 11 title hits and renders exactly ten matching the API response. Frontend additionally receives 11 deliberately non-alphabetic mock results and displays the first ten unchanged, proving no client re-sort. |
| 3 — short query | Fewer than two trimmed characters shows exactly `Enter at least 2 characters`. | Passed. Empty, whitespace, `a`, ` a `, `%`, `_`, and one emoji are rejected before any frontend search request. Backend returns 400 `VALIDATION_ERROR` with the exact text. Browser sees the same prompt. Valid literal `%_`/backslash fixtures return only their literal title; `%%`, `__`, `in%`, `in_` return no unrelated rows. |
| 4 — positive description order | For `astronaut rescue moon`, both Moon Rescue and independent City Robot have positive overview scores, with Moon Rescue above City Robot. | Passed. Actual shared-index browser scores: Moon Rescue `0.8454552137315112` > City Robot `0.17077611319011649` > 0. City Robot's independent detective overview includes a rescue. Real API/browser order is Moon Rescue, City Robot in all six width/theme combinations. Backend also asserts both positive scores before checking API order and forbids refitting on a read. |
| 5 — no positive match | A valid query with no positive overview scores shows exactly `No movies found`, without unrelated fallback movies. | Passed. Real API/index all-zero query `volcano jazz galaxy` produces an empty array and zero browser cards. Separate City Robot theft overview has score exactly 0 and is excluded while Moon Rescue remains positive. A valid active empty catalogue with a built empty index also returns empty success and the exact message. Missing/stale/corrupt index remains an error rather than false empty success. |

Focused API/index results are in [focused-backend.log](checks/focused-backend.log);
frontend results are in [focused-frontend.log](checks/focused-frontend.log).
Fixtures are synthetic and offline. Browser DB controls report 13 real SQLite
rows, 11 title hits, positive/zero cosine values and the active empty revision.
The JSON evidence contains only public movie data and fixture observations.

## Recovery, race, auth and route checks

- Removing the real index gives 503 `INDEX_UNAVAILABLE` and a visible inline
  error/Retry. Title search still succeeds with ten results. Rebuilding the
  index then clicking Retry resends exactly the current trimmed query and
  renders the positive pair. This runs at all three widths in both themes.
- Harness gates hold actual computed API responses, rather than fabricating
  replies. An old Inception response is released after a newer description
  result; the current pair remains. A second held response is released after
  navigating Home; Search does not return or replace Home.
- Unit tests also resolve/reject transports that deliberately ignore abort,
  including after unmount and after editing down to a short query. Cleanup
  aborts the signal; late success/error cannot update the current view.
- Guest search/details issue no `/api/me/*` reads or writes and no TMDb metadata
  requests. Standard `/api/auth/me` restoration may return 401 without blocking
  search. No protected-route/request guard is changed.
- Unit detail-return coverage preserves `q`, `source` and `#results`; external,
  protocol-relative, backslash and unlisted return paths retain the safe
  catalogue fallback. Browser checks details return and reload preserve `q`.
- The API static-route test makes any movie-ID lookup fail, then verifies
  `/api/movies/search` reaches search validation/results. Frontend direct
  `/search` mounts the search page, never a movie detail route.

## Executed commands and regression results

Python is the repository's `.venv/bin/python`. The isolated runner migrates a
disposable DB and invokes `pytest backend/tests -v`, preserving the user's DB.

| Command | Observed result | Log |
|---|---|---|
| `.venv/bin/python -m pytest backend/tests/test_movie_search_api.py backend/tests/test_overview_index.py -v -s` | 33 passed | [Focused backend](checks/focused-backend.log) |
| `npm --prefix frontend test -- src/tests/movies.test.tsx` | 22 passed (16 search cases, 6 existing movie cases) | [Focused frontend](checks/focused-frontend.log) |
| `.venv/bin/python backend/scripts/run_isolated_tests.py -v` | 656 passed, 1 existing skip | [Backend regression](checks/backend-regression.log) |
| `.venv/bin/python -m ruff check backend` | Passed | [Ruff](checks/ruff.log) |
| `npm --prefix frontend test` | 367 passed, 32 files | [Frontend regression](checks/frontend-regression.log) |
| `npm --prefix frontend run lint` | Passed | [ESLint](checks/frontend-lint.log) |
| `npm --prefix frontend run build` | Passed, TypeScript and Vite | [Production build](checks/frontend-build.log) |
| `npm --prefix frontend run test:t01:ui -- --grep S08` | 2 passed | Included again in full T01 run below |
| `T01_SCREENSHOT_DIR=../docs/evidence/s4-t10-search/screenshots npm --prefix frontend run test:t01:ui` | 13 passed, 1 imported-DB-only case intentionally skipped | [T01 browser regression](checks/t01-regression.log) |
| `npm --prefix frontend run test:s04:e2e` | 10 passed, 1 live-provider case intentionally skipped | [S04/S13 browser regression](checks/s04-regression.log) |
| `git diff --check` | Passed | Checked after implementation and evidence changes |

The first sandboxed browser attempt could not bind port 8014. An initial full
backend run had six existing HTTP-server setup errors for the same restriction;
authorized reruns outside the sandbox passed as recorded above. An initial
frontend run found the obsolete Search-absent assertion; the updated suite
passed. The existing Starlette/httpx deprecation warning remains. No provider
token or provider network access was needed, and runner-owned DB/index files
were removed by the runner. No developer database or `.env` was changed.

## Browser/UI evidence and limits

Chromium `156.0.8078.4`; widths 375, 768 and 1440, height 960, both light and
dark themes. All six combinations exercise validation, held-response loading,
ten-title results, description results, all-zero empty, index error/retry,
zero-score exclusion and active-empty-catalogue results. Checks assert no
horizontal overflow, visible input focus, Tab/Shift+Tab movement to/from the
existing detail links, query restoration and absence of page errors. Existing
T01 checks cover shared semantic-token contrast and the other public/auth/rating
flows. This is Chromium verification, not a full accessibility or cross-browser
certification. Screenshots show real rendered synthetic fixture data with the
shared poster-unavailable fallback, not imported TMDb data.

| View | Light | Dark |
|---|---|---|
| Mobile 375px results | [Screenshot](screenshots/search-results-375-light.png) | [Screenshot](screenshots/search-results-375-dark.png) |
| Tablet 768px results | [Screenshot](screenshots/search-results-768-light.png) | [Screenshot](screenshots/search-results-768-dark.png) |
| Desktop 1440px results | [Screenshot](screenshots/search-results-1440-light.png) | [Screenshot](screenshots/search-results-1440-dark.png) |

Additional mobile/light states: [Loading](screenshots/search-loading-375-light.png),
[No movies found](screenshots/search-empty-375-light.png),
[Index error](screenshots/search-error-375-light.png),
[Retry recovered](screenshots/search-retry-375-light.png).

No scoped Story #30 criterion remains unimplemented. Live provider/imported-DB
checks were intentionally outside this synthetic offline acceptance. Independent
review, CI and GitHub Story closure remain separate from these local results.

## Keyboard submit and C03 follow-up (2026-10-27)

The follow-up adds a native labelled search form with a Search submit button.
Enter in the input and keyboard activation of the button repeat the current
trimmed read without reloading the document or changing the URL. Live results
remain available while typing. Short-query submission sends no search request;
resubmission aborts the previous read and rejects its late success/error.
The [T01 integration contract](../../s4-t01-ui-contract.md#s4-t10-search-integration-and-keyboard-submit-2026-10-27)
now records this behaviour and reuse of shared UI/navigation components.

The [C03 matrix](../s4-c03-acceptance-matrix.md#s4-t10-search-ui-consumer-amendment-2026-10-27)
appends the missing normalized-LF SHA-256 for the current `docs/api.md`.
Earlier matrix entries, the 2026-10-26 manifest, logs and screenshots above
remain historical evidence for their original source; they do not describe
the form added by this follow-up.

Executed locally against the changed working tree:

| Command | Observed result |
|---|---|
| `python3 scripts/verify_s4_c03_contract.py` | Passed; all seven current normalized hashes found, no missing local links |
| `python3 scripts/test_s4_c03_contract_line_endings.py` | Passed; LF and CRLF exports produce identical seven hashes |
| `npm --prefix frontend test -- src/tests/movies.test.tsx` | 24 passed, including short-query submission and stale success/error after resubmission |
| `npm --prefix frontend test` | 369 passed, 32 files |
| `npm --prefix frontend run lint` | Passed |
| `npm --prefix frontend run build` | Passed, TypeScript and Vite |
| `npm --prefix frontend run test:t01:ui -- --grep S08` | 2 passed; real API/index, Enter in input, keyboard button submit, Tab/Shift+Tab, retained focus/URL, both themes at 375/768/1440px, delayed responses |
| `git diff --check` | Passed |

The browser runner initially could not bind port 8014 inside the sandbox.
Its authorized rerun outside the sandbox passed and removed its temporary
database. No historical screenshot or source manifest was regenerated.

## Current UI screenshots (2026-10-27)

Captured from implementation commit `8ead5af8c809e41d72e14c641dce309e56b3b356`
using the existing Playwright S08 tests. These images show the native Search
button and Enter instructions added by the keyboard follow-up. The original
images above are retained; the PR's displayed images now use this new capture.

The database is an isolated synthetic fixture. `Moon Rescue` and `City Robot`
are test movies with no poster path, so `Poster unavailable` is expected.
These screenshots verify the current UI and fallback, not a TMDb import or
live poster delivery. No developer database was imported or modified.

| View | Light | Dark |
|---|---|---|
| Mobile 375px results | [Screenshot](screenshots/2026-10-27-keyboard-submit/search-results-375-light.png) | [Screenshot](screenshots/2026-10-27-keyboard-submit/search-results-375-dark.png) |
| Tablet 768px results | [Screenshot](screenshots/2026-10-27-keyboard-submit/search-results-768-light.png) | [Screenshot](screenshots/2026-10-27-keyboard-submit/search-results-768-dark.png) |
| Desktop 1440px results | [Screenshot](screenshots/2026-10-27-keyboard-submit/search-results-1440-light.png) | [Screenshot](screenshots/2026-10-27-keyboard-submit/search-results-1440-dark.png) |

Additional mobile/light states: [Loading](screenshots/2026-10-27-keyboard-submit/search-loading-375-light.png),
[No movies found](screenshots/2026-10-27-keyboard-submit/search-empty-375-light.png),
[Index error](screenshots/2026-10-27-keyboard-submit/search-error-375-light.png),
[Retry recovered](screenshots/2026-10-27-keyboard-submit/search-retry-375-light.png).

Reproduction command:

```bash
T01_SCREENSHOT_DIR=../docs/evidence/s4-t10-search/screenshots/2026-10-27-keyboard-submit npm --prefix frontend run test:t01:ui -- --grep S08
```

Observed result: **2 passed**. The checks cover real API/index responses,
Enter in the input, keyboard activation of Search, Tab/Shift+Tab order,
focus/URL preservation, both themes at 375/768/1440px, loading/empty/error/retry,
stale responses and safe detail return. Chromium version and API/DB
observations are in [search-api-db.json](screenshots/2026-10-27-keyboard-submit/search-api-db.json).
The runner removed its temporary database after completion.

Capture log: [keyboard-submit-browser.log](checks/keyboard-submit-browser.log).
The new [tested-source manifest](screenshots/2026-10-27-keyboard-submit/tested-source.sha256)
uses repository-relative paths; the [screenshot manifest](screenshots/2026-10-27-keyboard-submit/screenshots.sha256)
uses paths relative to its capture directory. Historical manifests are unchanged.
