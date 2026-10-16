# S3-T14: S04 real-browser acceptance

Run date: 2026-10-16 (Asia/Ho_Chi_Minh).

- Task: [S3-T14 #116](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/116).
- Parent Story: [S04 #20](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/20); keep open until the complete AC and [DoD](../../definition-of-done.md) pass.
- Tested source: the exact commit and file SHA-256 manifest are recorded in [results.json](results.json). The final immutable candidate link is pending the acceptance commit/run.
- Independent review and hosted CI: pending the T14 PR. Local success does not establish either gate.
- Scope: acceptance automation and evidence. Existing production components, auth, API and ranking are reused unchanged.

## Reviewed/merged prerequisites

| Dependency | Contract or merged implementation |
|---|---|
| T06 #108: deterministic fixtures | [PR #149](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/149), [fixture contract](../../evidence/s3-t06-recommendation-fixtures.md) |
| T05 #107: preference save/restore | [PR #158](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/158) |
| T10 #112: real recommendation client/cards | [PR #160](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/160) |
| T11 #113: error/retry and request lifetime | [PR #164](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/164) |
| T13 #115: cold-start guidance and committed-save invalidation | [PR #171](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/171) |

The current [API contract](../../api.md) and [business rules](../../business-rules.md)
define `mode`, `personalised`, `noMatch`, finite popularity and BR4/BR5.
T14 adds browser evidence missing from the existing T06/T10/T11/T13 suites;
it does not reimplement their features or claim another task's completion.

## Controlled setup and test boundaries

[Playwright configuration](../../../frontend/playwright.s04.config.ts) starts
the [test-only server](../../../backend/scripts/s04_acceptance_server.py) and
Vite on loopback ports **8014/5174**, refusing to reuse existing servers.
The server creates its own temporary SQLite file, applies the real Alembic
migrations using the existing T21 migration helper, and deletes it on shutdown.
The normal `.env` database is never selected. Auth, sessions, preferences,
recommendation queries and responses run through the production FastAPI app.
Registration uses the real API; each fresh browser context signs in through
the real login form and receives an HttpOnly cookie. Browser requests use
Vite's proxy. There is no browser route interception or mocked fetch.

The [synthetic S04 fixture](../../../backend/tests/fixtures/s04_browser_acceptance.json)
specialises the reviewed T06 contract for the Story's exact **A=90, B=80,
C=80** example. It has 12 finite-popularity candidates A–L plus one Archive
movie with null popularity. Rows are inserted in reverse order, proving the
B/C tie is resolved by the backend ordering. The top ten must be A–J; K/L
and the null-popularity movie must be absent. Empty and no-usable-popularity
fixtures are separate: the latter retains 13 rows with only NULL, positive
infinity or negative infinity scores. Recorded fixture summaries show actual
row/finite-score counts and migration version.

For true no-match, Archive is offered while its movie is active. After the
editor loads, the harness retires that movie to an inactive revision. Saving
the still-valid canonical genre through the UI then produces an actual
`noMatch=true` response, including a separate case with zero popular
alternatives. No success response is substituted by the harness.

For DB failure, the harness renames only the temporary `catalog_movies`
table. SQL queries really fail, and the real error handler emits
`503 SERVICE_UNAVAILABLE`. Restoring the table and clicking Retry recovers.
Committed preference rows before and after the failure must be identical.

For the race, server-side ASGI gates buffer already-computed real responses.
The old popular response remains held while the browser saves Action. The
new personalised response is held too, proving loading contains zero old
cards. It is released first; then the old popular response is released.
The UI must still show only the seven Action matches A/B/D/F/H/J/L.
The production AbortController can cancel the old browser request; the
existing T13 unit test also resolves an obsolete response despite cancellation
and verifies it cannot change the current snapshot.

## All four Story AC mapped to API and browser evidence

| Story #20 obligation | Implementation / task ownership | Real-browser assertion | API evidence | Browser evidence |
|---|---|---|---|---|
| AC1: newly signed-in account without preferences, A/B/C order, distinct, at most ten, Not personalised | Existing S2 fallback + T10/T13; T14 verifies | Seven-test suite case 1: full A–J order, IDs/detail links, no matching reasons, visible label | [Case 1](01-recommendations-api.json): `200`, `popular`, false/false, count 10, exact scores | [Cold start](01-cold-start.png) |
| AC2: Enter preferences navigates to `/preferences` | T05/T13; T14 verifies | Case 1 clicks the actual link, checks URL and unchecked Action checkbox | [Genre/preference GET and committed PUT](01-preferences-api.json); [test source](../../../frontend/e2e/s04.acceptance.ts) asserts the PUT is 200 | [Genre picker](01-preferences.png) |
| AC3: empty popular data shows guidance and no fake cards | T10/T13; T14 verifies | Cases 3/4 check exact no-data heading, Enter preferences link, zero cards, no error/retry | [Empty catalogue](03-recommendations-api.json), [no finite popularity](04-recommendations-api.json): `200`, movies `[]`, count 0 | [Empty catalogue](03-browser.png), [unusable popularity](04-browser.png) |
| AC4: saved preferences use S02, with BR4 when no match | T05/T10/T11/T13; T14 verifies | Case 1 checks seven Action matches and reasons; cases 2/5 check true no-match, alternatives or zero cards, Edit preferences and Retry | [Matches](01-recommendations-api.json), [no-match](02-recommendations-api.json), [no alternatives](05-recommendations-api.json) | [Personalised](01-browser.png), [alternatives](02-browser.png), [no alternatives](05-browser.png) |

Additional task checks:

| Obligation | API evidence | Browser evidence |
|---|---|---|
| SQL failure is Error/Retry, not empty success; saved genres survive; Retry recovers | [503 and recovered 200](06-recommendations-api.json), [equal preference rows](06-db-failure-fixture.json) | [Error](06-db-failure.png), [recovered](06-browser.png) |
| A delayed pre-save response cannot restore the fallback after a fresh response | [Real held old/fresh payloads and completion counts](07-delayed-real-api.json), [browser-received responses](07-recommendations-api.json) | [Loading with zero cards](07-fresh-loading.png), [final personalised cards](07-browser.png) |

## Commands and observed results

| Command from repository root | Local result |
|---|---|
| `npm --prefix frontend run test:s04:e2e` | 7 passed, no retries, no skips; Chromium 156.0.8078.4 |
| `python backend/scripts/collect_s04_evidence.py` | Exports API JSON, screenshots, fixture summaries and source manifest; refuses failed/flaky/partial runs |
| `python -m pytest backend/tests/test_popular_recommendations.py backend/tests/test_personalised_recommendations_api.py backend/tests/test_recommendation_fixtures.py -q -p no:cacheprovider` | 43 passed |
| `npm --prefix frontend test -- src/tests/recommendations.test.tsx src/tests/recommendation-preference-transition.test.tsx` | 22 passed in 2 files |
| `python -m pytest backend/tests -q -p no:cacheprovider` | 373 passed, 1 skipped, 1 existing Starlette deprecation warning |
| `npm --prefix frontend test` | 199 passed in 18 files |
| `python -m ruff check backend --output-format=concise` | All checks passed |
| `npm --prefix frontend run lint` | Passed |
| `npm --prefix frontend run build` | Passed |

Python 3.12.4 and Node v24.21.0 were used locally. The backend skip is the
existing `test_auth_catalogue_handoff.py` rating-write placeholder (its reason
still says S05a is pending). Rating suites already exist separately; T14
does not change or conceal that unrelated placeholder.

## Reproducible reviewer steps

1. Check out the tested source commit linked above and install the locked backend/frontend dependencies using the repository README. Activate Python 3.12; alternatively set `S04_PYTHON` to its executable. Keep ports 8014/5174 free.
2. In `frontend`, run `npx playwright install chromium` once (`npx playwright install --with-deps chromium` on Linux CI), then return to the repository root. A provider token is unnecessary.
3. Run the focused backend/frontend commands above, followed by `npm --prefix frontend run test:s04:e2e`. Require all seven tests to pass without retries.
4. Run `python backend/scripts/collect_s04_evidence.py`. Inspect `results.json`, every API JSON and the linked screenshots. Each case logs only safe recommendation/genre/preference bodies, browser version and fixture metadata; auth cookies, passwords and trace/HAR files are excluded.
5. Run the full regressions, lint and build above. The dedicated [CI workflow](../../../.github/workflows/s04-e2e.yml) repeats the browser run and uploads `frontend/test-results/` even on failure.
6. An independent teammate reviews the actual tested diff and records approval on the PR. Link that review and green hosted CI before marking T14 complete. Do not merge or close Story #20 based solely on this local run.

## Explicit remaining gates

- Unimplemented S04 behavioural criteria identified by these four AC: **none**. All four have real-browser/API coverage.
- Final tested immutable candidate link: pending the source commit/run, with per-file hashes already included in the machine-readable results.
- Independent teammate approval, hosted CI, merge and clean-clone reviewer verification: **pending**. No review approval is inferred from automated tests or the author's own inspection.
- Required Sprint 3 TMDb staging/demo import and provenance smoke: **not performed by this synthetic suite**. Track separately using the [runbook](../../tmdb-sprint3-runbook.md); passing controlled tests does not satisfy that DoD gate.
- Story #20 and task #116 remain open until their respective remaining checks pass.
