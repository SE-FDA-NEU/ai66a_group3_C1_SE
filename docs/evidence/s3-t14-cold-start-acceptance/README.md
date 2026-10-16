# S3-T14: S04 real-browser acceptance

Run date: 2026-10-16 (Asia/Ho_Chi_Minh).

- Task: [S3-T14 #116](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/116).
- Parent Story: [S04 #20](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/20); keep open until the complete AC and [DoD](../../definition-of-done.md) pass.
- Tested source: local working tree based on [`6a57b6ebbb58217525cf127ffbd31ebb3fdfd6aa`](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/commit/6a57b6ebbb58217525cf127ffbd31ebb3fdfd6aa), including the Node/Vitest test-discovery fix. [results.json](results.json) records the base commit, working-tree status, and SHA-256 manifest for the actual application, fixture, harness, wrapper and cleanup tests. This run started at **14:58:41 Asia/Ho_Chi_Minh**.
- Hosted CI: [S04 acceptance succeeded](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/38864844350/job/116855188548) on [PR #176](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/176); [Python and frontend CI also succeeded](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/38864844447).
- Independent review: [Hoàng (`@hoang3003`) approved](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/176#pullrequestreview-5544269476) at **14:16:59 Asia/Ho_Chi_Minh** on 2026-10-16. These hosted results and approval apply to `fbc1897`; the cleanup changes here have the local verification below.
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

[Parent runner](../../../frontend/scripts/run-s04-e2e.mjs) creates a unique
`s04-browser-*` directory and passes it to the backend as `S04_DATABASE_DIR`.
[Playwright configuration](../../../frontend/playwright.s04.config.ts) starts
the [test-only server](../../../backend/scripts/s04_acceptance_server.py) and
Vite on loopback ports **8014/5174**, refusing to reuse existing servers.
The server creates `acceptance.db` inside that directory and applies the real
Alembic migrations using the existing T21 migration helper. Playwright stops
its server process trees before exiting; the parent awaits that exit and
removes only its own directory in `finally`, on both successful and failed runs.
Cleanup does not depend on ASGI lifespan callbacks or graceful SIGTERM, which
Playwright does not support on Windows. No prefix scan or deletion of other
runs' directories is used.
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
| `npm --prefix frontend run test:s04:e2e` | 7 passed in 14.1s, no retries, no skips; Chromium 156.0.8078.4; [actual output](t14-browser-run-output.txt) |
| `.venv/bin/python backend/scripts/collect_s04_evidence.py` | Exported all 7 cases: API JSON, screenshots, fixture summaries and source manifest; refuses failed/flaky/partial runs |
| `npm --prefix frontend run test:s04:runner` | 3 passed: forced backend termination followed by Playwright success/failure, startup failure; another run's database survives; [actual output](t14-runner-cleanup-output.txt) |
| `npm --prefix frontend test` | 199 passed in 18 files; Vitest does not collect the Node runner checks |
| `.venv/bin/python -m ruff check backend/scripts/s04_acceptance_server.py backend/scripts/collect_s04_evidence.py --output-format=concise` | All checks passed |
| `npm --prefix frontend run lint` | Passed |
| `npm --prefix frontend run build` | Passed |

The parent logged `s04_temporary_database_removed=true` after the seven-test
run. Cleanup tests hold the database file open in a backend subprocess, kill
that subprocess without cleanup, and verify removal only after it stops;
a separate `s04-browser-*` directory and its database remain intact.
Python 3.12.4 and Node v24.21.0 were used locally on macOS. The
[workflow](../../../.github/workflows/s04-e2e.yml) also runs these cleanup
tests on Ubuntu and Windows. On `6a57b6e`, both
[Windows cleanup](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/38870301880/job/116872558234)
and [Ubuntu cleanup](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/38870301880/job/116872558423)
passed. The full frontend suite on that commit failed because Vitest collected
the Node `node:test` file named `*.test.mjs`. The file is now named
`run-s04-e2e.node-test.mjs`, outside Vitest's discovery pattern, and is still run
explicitly by `test:s04:runner`. The commands above verify both runners after
that rename.
The earlier backend regression baseline was 373 tests passed (1 existing
skip); the full backend suite was not rerun for this test-discovery fix.

## Reproducible reviewer steps

1. Check out the cleanup change based on the commit linked above and install the locked backend/frontend dependencies using the repository README. Compare the runtime/test files with `testedSource.sourceSha256` in `results.json`. Activate Python 3.12; alternatively set `S04_PYTHON` to its executable. Keep ports 8014/5174 free.
2. In `frontend`, run `npx playwright install chromium` once (`npx playwright install --with-deps chromium` on Linux CI), then return to the repository root. A provider token is unnecessary.
3. Run `npm --prefix frontend run test:s04:runner`, followed by `npm --prefix frontend run test:s04:e2e`. Require all seven browser tests to pass without retries and the parent cleanup marker to appear after the results.
4. Run `python backend/scripts/collect_s04_evidence.py`. Inspect `results.json`, every API JSON and the linked screenshots. Each case logs only safe recommendation/genre/preference bodies, browser version and fixture metadata; auth cookies, passwords and trace/HAR files are excluded.
5. Run lint and build above. The dedicated [CI workflow](../../../.github/workflows/s04-e2e.yml) repeats the browser run, checks cleanup on Ubuntu/Windows, and uploads `frontend/test-results/` even on failure.
6. The hosted CI and Hoàng approval for `fbc1897` are linked above. Publish the cleanup change and verify its new hosted checks and review before merge; keep the distinction between the approved base and this local patch. Do not close Story #20 based solely on this local run.

## Explicit remaining gates

- Unimplemented S04 behavioural criteria identified by these four AC: **none**. All four have real-browser/API coverage.
- Tested source: base commit plus the local cleanup changes, identified by the refreshed SHA-256 manifest above.
- Hosted CI and independent approval for `fbc1897`: **passed**, with permanent links above. The local cleanup patch still needs publication and its own hosted checks/review; PR #176 is open and unmerged. Clean-clone reviewer verification is not recorded here.
- Required Sprint 3 TMDb staging/demo import and provenance smoke: **not performed by this synthetic suite**. Track separately using the [runbook](../../tmdb-sprint3-runbook.md); passing controlled tests does not satisfy that DoD gate.
- Story #20 and task #116 remain open until their respective remaining checks pass.
