# S3-T09 recommendation failure, empty-result, and recovery evidence

Issue: [#111](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/111)

Parent: [#18 / S02](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/18)

Branch: `feature/s3-t09-error-empty-recovery`

Dependency: [T08 / PR #156](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/156),
already merged. Base: `74ea814` on team `main`.

Verification date: 2026-10-12. Environment: Windows, Python 3.12.6,
Node.js 24.19.0. All committed documentation is in English.

## 1. Scope and implementation

T08 already supplies the route, orchestration, and shared SQLAlchemy error
handler. T09 reuses them instead of adding a duplicate route, fallback, or
exception handler. The service docstring and API contract now explicitly state
the read-only, failure/retry, and Sprint 4 rating boundaries.

The new tests interrupt actual SQL execution through a temporary
`before_cursor_execute` listener. They do not simply mock an endpoint response.
The fault matrix uses a new SQLAlchemy Session for each HTTP request, with
context-managed cleanup matching the production request lifecycle.

Accounts are registered and signed in through the public APIs and use two
independent cookie stores. Committed preference rows are observed through a
separate Session, not just response JSON or the request's identity map.

All fault injection and catalogue-pointer removal happen only in isolated,
synthetic SQLite fixtures. Neither the application database nor a real TMDb
credential is used or changed. Provider calls are explicitly forbidden in the
failure/retry matrix.

## 2. Response contract

| Situation | Expected result |
|---|---|
| Matching movies exist | `200`, `mode=personalised`, `personalised=true`, `noMatch=false` |
| Saved genres have no match | `200`, `mode=popular`, `personalised=false`, `noMatch=true`; alternatives in `data.movies` |
| No saved genres | `200`, `mode=popular`, `personalised=false`, `noMatch=false` |
| Active catalogue and successful reads yield no usable movies | `200`, `movies=[]`; flags retain their ordinary meaning |
| No active catalogue pointer | `503 CATALOGUE_UNAVAILABLE` / `Movie catalogue is unavailable` |
| A catalogue/preference/candidate/genre database query fails | `503 SERVICE_UNAVAILABLE` / `Service is temporarily unavailable` |
| Missing, invalid, expired, or revoked session | `401 AUTHENTICATION_REQUIRED` / `Authentication required` |

An error body contains only `error`, with `code`, `message`, and a
`req_[0-9a-f]{32}` request ID. It is not a successful empty or no-match response.
Raw SQL, underlying exception details, account emails, and credentials must not
appear in that public error. Repeated failed requests receive different IDs.

## 3. Acceptance mapping

Tests are in `backend/tests/test_personalised_recommendations_api.py`.

| Issue #111 check | Evidence |
|---|---|
| Database failure is an error, not `200/noMatch=true` | `test_t09_query_failure_is_not_empty_and_retry_restores_both_accounts`: 13 stage/mode combinations; actual query interruption, exact 503 envelope, two consecutive failures, and no SQL writes during those requests. |
| Retry success replaces the error | The same 13 cases remove the listener and retry the same authenticated client and `limit=2`. Both accounts recover their exact pre-failure response without login or preference rewrites. |
| Catalogue absence is distinct from query failure | `test_t09_missing_catalogue_preserves_preferences_and_recovers_after_activation`: remove the synthetic active pointer, verify both accounts receive `CATALOGUE_UNAVAILABLE`, reactivate the same revision, and verify recovery. |
| Preferences survive source failure | The matrix and missing-pointer case compare all committed preference rows before failure, immediately after failure, and after recovery. API preference reads remain identical for A and B. |
| Valid empty data is still a success | `test_t09_active_empty_catalogue_is_cold_start_success_not_a_source_error` plus the existing T08 `test_no_match_with_no_usable_popular_alternative_is_a_valid_empty_success` cover cold-start and no-match empty responses. |
| Ratings remain a Sprint 4 extension | `test_t09_saved_ratings_do_not_change_sprint3_ranking_or_preferences`, parameterised with 1 and 5: ratings save/read correctly and remain account-owned, but neither account's recommendation response or preferences change. |
| Focused automated checks and reproducible reviewer steps | Commands and reviewer journey below. |
| Tested SHA and independent review | Tested implementation SHA below; teammate review/remote checks must be linked to the actual PR before closing #111. |

### Query-failure matrix

| Interrupted read | Personalised | No match / alternatives | Cold start |
|---|---|---|---|
| Active catalogue revision | Tested | Tested | Tested |
| Account preferences | Tested | Tested | Tested |
| Genre-matched candidates | Tested | Tested | Not executed in this mode |
| Popular candidates | Not executed in this mode | Tested | Tested |
| Movie genre hydration | Tested | Tested | Tested |

The matrix observes two failing requests followed by recovery. It also compares
B's independent preferences and recommendations after A's failures. Recovery
returns the same list only because the test catalogue, account preferences, and
query are unchanged; this is not a promise of frozen live-catalogue results.

## 4. Reproduce automated verification

Follow README dependency setup first. Use a separate PowerShell test terminal
at the repository root; these environment overrides must not be put in `.env`
or reused to start the development backend. Close the terminal afterwards.

```powershell
$env:PYTHONUTF8 = "1"
$env:TMDB_READ_ACCESS_TOKEN = ""
$env:DATABASE_URL = "sqlite:///./data/t09-tests.db"
New-Item -ItemType Directory -Force data | Out-Null

.\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini upgrade head
.\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini heads

.\.venv\Scripts\python.exe -m pytest backend/tests/test_personalised_recommendations_api.py -k t09 -v
.\.venv\Scripts\python.exe -m pytest backend/tests/test_personalised_recommendations_api.py backend/tests/test_popular_recommendations.py -q
.\.venv\Scripts\python.exe -m pytest backend/tests -q
.\.venv\Scripts\python.exe -m ruff check backend

npm.cmd --prefix frontend test
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run build
git diff --check origin/main...HEAD
```

For a checkout with the team repository configured as `upstream`, use
`git diff --check upstream/main...HEAD` instead of `origin/main`.
Tests use synthetic catalogue data and are not live TMDb provenance evidence.
No migration or dependency addition is required by T09.

### Recorded results

Tested implementation commit:
[`b44225c203f40debb1ba99e4d576b7da648fd8bd`](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/commit/b44225c203f40debb1ba99e4d576b7da648fd8bd).
The later evidence-only commit does not change the tested implementation.

| Check | Actual local result |
|---|---|
| Fresh isolated SQLite migration | Passed; one head, `b7e4c2d91f30` |
| New T09 cases | 17 passed, 11 existing cases deselected |
| Personalised + popular API regression | 36 passed |
| Full backend | 300 passed, 1 existing skipped placeholder, 1 compatibility warning |
| Backend Ruff | Passed: `All checks passed!` |
| Frontend regression | 62 passed across 8 files |
| Frontend lint | Passed |
| Frontend production build | Passed |
| Branch diff whitespace | Passed against team `upstream/main` |
| Separate clean Git clone | Fresh Python venv/locked install/editable backend install, migration and backend lint/tests passed; fresh `npm ci`, frontend tests/lint/build also passed |

The clean-clone check used a separate local Git clone of the tested
implementation commit, not the existing workspace's `.venv`, `node_modules`,
`.env`, or database. It reproduced 300 backend passes (1 existing skip) and 62
frontend passes. This verifies offline setup/automated behaviour, not a new
live TMDb import or independent teammate browser acceptance.

The existing TestClient warning concerns the installed FastAPI/Starlette HTTP
client compatibility layer. It is not a T09 failure and does not require an
unrelated dependency upgrade in this PR.
The single skipped case is the existing rating-handoff placeholder in
`test_auth_catalogue_handoff.py`; T31 and the T09 rating boundary tests run
normally. No skip or xfail was added by T09.

### Pre-existing dependency audit finding (outside T09)

Fresh `npm ci` also reported one High advisory for dev-only
`source-map-js@1.2.1`:
[GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).
`npm audit --omit=dev --json` reported zero vulnerabilities. `npm explain`
places this dependency under jsdom/css-tree and Vite/PostCSS development
tooling. The lockfile is unchanged from team `main`; T09 neither introduces
nor resolves this finding. Track a separate dependency-maintenance change,
upgrade to a patched version with its own verification, and do not interpret
passing tests as a claim that the full dependency audit is clean.

## 5. Reviewer journey

1. Check out this branch and note the actual candidate SHA. Run the commands
   above against a separate migrated test database.
2. Run only `-k "t09 and query_failure" -v`. Confirm all 13 matrix cases pass.
   Each case verifies a successful baseline, two real-query 503 failures, fresh
   committed-row equality, and 200 recovery for the same accounts/query.
3. Run `-k "t09 and missing_catalogue" -v`. Verify a genuinely absent synthetic
   pointer produces `CATALOGUE_UNAVAILABLE`, not `SERVICE_UNAVAILABLE` or empty
   success, and reactivation recovers without rewriting genres.
4. Run `-k "t09 and active_empty" -v` and the existing no-match/empty test. They
   must succeed with `200/movies=[]` and different appropriate `noMatch` flags.
5. Run `-k "t09 and saved_ratings" -v`. Check both boundary values and account
   ownership, with unchanged genre/popularity ranking and preferences.
6. Inspect the diff: no new endpoint, browser implementation, database dump,
   migration, dependency, token, ranking formula, or fake production fallback.
7. Leave a substantive independent review on the final PR candidate. Record the
   review and green CI links before merging/closing #111.

## 6. Frontend handoff and remaining Story #18 criteria

T10 (#112) owns the typed client and real card rendering. T11 (#113) owns the
Error/Retry UI, no-match actions, account/query races, and 401 auth handling.
T12 (#114) owns integrated acceptance. None of those UI tasks is claimed done
by this backend verification.

- Read `data.movies` and state flags only after a successful response.
- Non-2xx errors and network failures are not successful empty/no-match data.
- Keep saved preferences; do not PUT an empty set or reset personalisation on
  recommendation errors.
- Retry for the current authenticated account and query; clear the error only
  after the successful current request. Ignore obsolete responses in T11.
- Handle 401 through the existing auth handler, not as catalogue empty state.
- Preserve server order. Rating-adjusted ranking remains Story #22 / Sprint 4.

| S02 acceptance criterion | Boundary after T09 |
|---|---|
| Up to 10 distinct matching movies | Existing T08 backend coverage reused; browser list is T10/T12. |
| Cards show title, genres, and matching reason | T08 API provides these fields; card rendering is T10/T12. |
| No-match message, popular alternatives, edit/retry actions | API no-match/alternatives and valid empty states covered; UI actions are T11/T12. |
| Source-error message/retry with unchanged preferences | API error and committed preference preservation covered; user-visible controls remain T11/T12. |
| Successful retry displays results | API recovery covered; browser state replacement remains T11/T12. |

Reference #18 without closing it in the T09 PR.

## 7. Publication gates

Local implementation verification is not an independent teammate approval.
After the owner creates the PR, add the actual PR URL, final candidate SHA,
remote CI URL/result, and an independent review URL to its description or the
issue. Do not mark clean-clone/manual browser acceptance as verified solely
from the workspace test run: the separate clean-clone automated check above
was performed, but independent teammate replay and integrated browser
acceptance remain distinct gates. Merge only after the applicable review/CI
gates pass; #111 and parent Story #18 are not closed by this evidence file.
