# Sprint 4 core integration / pre-G4 verification

Executed 29–30 October 2026, Asia/Ho_Chi_Minh (+07:00).
Tested committed candidate: **`24e8086f23e7567f20a9e9c237400bf15adf12b1`**.
The original run kept application, test, script and workflow files equal to
this commit. **Correction, 30 October:** direct pytest isolation was incomplete:
`test_health_reads_database` used the default engine and failed with 503 until
the operator manually migrated a database. Those passes prove regression with
manual provisioning, not #219 EARLY_TEST_SETUP or the required direct-pytest
rehearsal. The earlier claim that no requirement remained uncovered is withdrawn.
The [follow-up](follow-up/README.md) records the scoped bootstrap fix and new
results. The [resumed smoke](follow-up/windows-portability/README.md) subsequently
imported **964 real TMDb movies**, verified index readiness and passed API/UI
checks, and corrected Windows assertions on both PRs. Independent reviewer
execution and PO/SM capacity and G4 records remain outstanding;
**T18 is not complete**.

[manifest.json](manifest.json) records identity, versions and browser statistics.
[tested-source.sha256](tested-source.sha256) historically covers 316 tracked files under
`backend/`, `frontend/`, `tests/`, `scripts/` and `.github/workflows/` (raw-byte
SHA-256, including existing binary assets). Its SHA-256 is
`ada822707fc62638e950fee59fcc559ed7280e2d7f53695730e742a8dd5d36a2`.
Verify that historical manifest in a checkout of `24e8086`; the follow-up changes
pytest setup/tests/CI and has its own [source manifest](follow-up/tested-source.sha256).
Do not use the original manifest as a fingerprint of the corrected candidate.

The evidence directory was renamed from `s4-core-pre-g4` to
`s4-t18-core-pre-g4` for delivery. Historical commands and raw logs retain the
original run paths; relative report links and the artifact manifest use the
delivery path.
Directory-local Git attributes preserve captured terminal whitespace and keep
pytest summary separators from being mistaken for merge-conflict markers.

## Inspection and scope

Before verification, inspected the current merged T01 UI contract/components,
T03 service/ranker/signals, T05 root acceptance/effectiveness evidence, T08
Similar, T10 Search, T12 watchlist/profile repositories/API, T15 reset
acceptance, T16 detail/session/navigation, T17 filtering/pagination, C03
API/architecture/design/testing contracts, README, SETUP and CI workflows.
The current merge history includes PRs #220/#224, #226, #229/#233,
#228/#232, #230, #235/#236, #237 and #238; issue numbers in the work request
identify work items rather than those implementation PR numbers.

The [C01 scope](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/216)
was also read: mandatory core includes watchlist, while trailer work remains
gated. No locally identifiable merged C01 delivery or #219
`EARLY_TEST_SETUP` marker was found at the original tested SHA. Remote #219 reads were unavailable and
`gh` is not installed. This run uses the committed setup, isolated backend
runner and existing root fixtures actually present at the tested SHA; it does
not claim a later C05 setup slice exists or has been accepted.

Pre-change findings, also reported in chat:

| Area | Existing implementation and decision |
|---|---|
| Rating degradation | `backend/app/recommendations/service.py` reads genres/core candidates first; only optional rating SQL failures are caught. `ranker.py` emits zero adjustment, unchanged/null baseline score and `basis=rating_unavailable`. |
| Core failure | Required preference/catalogue/candidate reads propagate to the existing 503 error handler. Authentication resolution stays outside rating degradation. |
| Ordering | Personal ranking covers the full eligible set before view filtering and slicing. Popular fallback bypasses personal signals and uses popularity descending, title ascending, ID ascending. Public Home has its separate alphabetical comparator. |
| Stale/account guards | Session generations, account IDs, recommendation scope/version, request aborts and account/revision-stamped return contexts guard private state. A current 401 drops authentication; obsolete replies cannot retarget the new account. |
| S02/S04 coverage | Six distinct root cases for each Story already cover success, refusal and numeric boundaries; existing backend/React/browser tests cover later rating and request races. No new test gap was demonstrated. |
| Pagination | Existing 25-movie fixtures assert 10/10/5 distinct pages; other fixtures cover 0/1/10/11/255, full-set reranking and post-rank genre filtering. |
| Commands/change scope | Existing pytest, isolated runner, npm scripts/configs, migrations and setup were reused. Expected changes were evidence only unless a real failure required a scoped fix. |

## Environment and isolation

macOS 26.2 arm64; Python **3.12.4**; SQLite **3.45.3**; Node **24.21.0**;
npm **11.19.0**; Chrome **156.0.8078.48**. Working pip: 24.0; fresh-clone
pip after the documented upgrade: 26.2.2.

pytest 9.1.1, FastAPI 0.141.1, Starlette 1.7.0, Pydantic 2.13.5,
SQLAlchemy 2.1.1, Alembic 1.20.0, httpx 0.28.1, Ruff 0.16.9,
Uvicorn 0.54.0, React 19.3.0, React Router 7.18.4, Vitest 5.0.2,
Vite 8.3.1, TypeScript 6.0.3, ESLint 10.11.0, Playwright 1.64.1.
Full installed lists: [Python](checks/python-packages.txt),
[frontend](checks/frontend-packages.txt).

All test commands set `TMDB_READ_ACCESS_TOKEN='' TMDB_NETWORK_DISABLED=1`.
The root run additionally used `PYTHONPATH=backend` and a new migrated
`DATABASE_URL=sqlite:////private/tmp/s4-pre-g4-default.db`.
Existing API/DB fixtures and browser runners own migrated temporary SQLite
databases, fake provider boundaries and synthetic catalogues. No configured
developer database was used, and no provider token was inspected or used. Browser
traces remain off; no cookie/token dump or live TMDb import was performed.
Dependency downloads during clean installation are separate from test execution.

Migration head: **`f2c7e4a91b60`**. Shared index model:
`overview-tfidf-v1`, artifact version 1, config fingerprint
`41785781f34ba44091ac64f3b1c0503402ee760c518af1429d0acb94bbc31c99`.
[Config output](checks/index-config.log). Browser fixture catalogue revision:
`s04-browser-main`; rating verifier: `fixture-revision-s4-t04`. Tests create
their own replacement/empty revisions and index artifacts, so there is no
single shared test corpus digest. No live imported catalogue/index revision is
certified. The clean clone intentionally has no imported catalogue/index.

## Executed core checks

Commands below ran from the repository root with the environment above.
Every final command in this table exited **0**. Counts explicitly retain skips;
a skipped case is not a passed case. Earlier failures are recorded separately.

| Command | Expected / actual | Full output |
|---|---|---|
| `.venv/bin/python -m alembic -c backend/alembic.ini upgrade head` | Fresh default-test DB reaches head; reached `f2c7e4a91b60`. | [Migrations](checks/default-migrations.log) |
| `.venv/bin/python -m pytest -v` | Default repository discovery executes core/root/backend cases; **762 passed, 1 skipped, 210 subtests passed**, 86.80s. | [Default](checks/default-pytest-migrated.log) |
| `.venv/bin/python backend/scripts/run_isolated_tests.py -v` | Documented extended runner migrates its own DB; **705 passed, 1 skipped**, 114.35s. | [Backend](checks/backend-extended-escalated.log) |
| `npm --prefix frontend test` | Existing React/client regressions; **439 passed / 39 files**. | [Frontend](checks/frontend-tests.log) |
| `npm --prefix frontend run test:t04:integration` | Real React/FastAPI/SQLite save-to-rerank journey; **1 passed**. | [T04](checks/t04-integration.log) |
| `npm --prefix frontend run test:t16:integration` | Real API/DB filter, rating, return and clear; **1 passed**. | [T16](checks/t16-integration.log) |
| `npm --prefix frontend run test:t33:integration` | Rating save/update/failure/retry/session/persistence; **1 passed**. | [T33](checks/t33-integration.log) |
| `.venv/bin/python -m ruff check backend tests` | Backend/root lint passes. | [Ruff](checks/ruff.log) |
| `npm --prefix frontend run lint` | ESLint passes. | [ESLint](checks/frontend-lint.log) |
| `npm --prefix frontend run build` | TypeScript/Vite production build passes. | [Build](checks/frontend-build.log) |
| `.venv/bin/python scripts/verify_s4_c03_contract.py` | Contract shape/links pass; 231 links, 37 P0 IDs, 10 feature IDs. | [C03](checks/c03-contract.log) |
| `.venv/bin/python scripts/verify_s4_t05_trace.py` | Maps **37 unique IDs to 45 collected root nodes**. | [Trace](checks/t05-trace.log) |
| `npm --prefix frontend run test:s04:runner` | Existing runner lifecycle regression; **3 passed**. | [Runner](checks/s04-runner.log) |
| `npm --prefix frontend run test:m3:verifier` | Existing verifier lifecycle regression; **10 passed, 1 Windows-only skipped**. | [Verifier](checks/m3-verifier.log) |

Both Python suites retain the historical obsolete rating-write placeholder in
`backend/tests/test_auth_catalogue_handoff.py`; current rating API tests actually
execute and pass. The existing Starlette/httpx deprecation warning remains.
The root and extended counts overlap and must not be added together.

## Rating, failure, fallback and account results

The [node excerpt](checks/story-and-rating-excerpt.log) is extracted from the
successful default run, not an additional run. Full results remain linked above.

| Requirement | Executed assertion / observed result |
|---|---|
| Rating-only failure | `backend/tests/test_rating_aware_recommendations.py::test_only_rating_query_failure_degrades[ratings]` and `tests/test_rating_ranking_acceptance.py::test_s05b_rating_query_failure_is_truthful_and_core_failure_is_error`: real SQL rating read interrupted; **200**, baseline order, zero adjustment, `basis=rating_unavailable`, adjusted score equals original popularity (including null). Next request recovers. Browser verifier displays the explicit unavailability explanation. |
| Catalogue/core failure | The same parametrized test's `[catalogue]`, `[preferences]`, `[candidates]` and `[auth]` SQL-fault variants return **503 SERVICE_UNAVAILABLE**, without private DB details or success data. `[auth]` here is a DB fault, distinct from an invalid-session 401. S02-005 and S04 browser real SQL failure retain preferences and recover on Retry. |
| No ratings | S02-002 and initial rating verifier/API snapshots preserve valid preference-based baseline results; null popularity remains null. Ratings remain optional. |
| Popular/no-match | S04-002 asserts **A90 → B80 → C80**; S04 browser checks that same fixture order for both cold start and no-match, including Retry. `test_popular_fallbacks_keep_order_and_omit_private_scores[genres0/genres1]` proves saving a related 5-star rating leaves the entire cold-start/no-match response unchanged. No private adjusted-score fields are emitted. |
| Full-set/no-match distinction | `test_recommendation_filter_uses_all_candidates_before_page_slice` keeps `personalised=true,noMatch=false` on an empty view filter or beyond-last page when the base has matches. Home alphabetical order is asserted separately from popularity fallback. |
| Save/return | `test_s05b_save_to_rerank_exact_scores_and_account_isolation`, T04/T16 integrations and T16 browser `TC-S4-T16-RET-003` refetch current-account recommendations after confirmed save and detail return, use 81/80 or 79/80 order and preserve saved genres/page/filter context. |
| 401/account switch | S02-004, S13 root/browser and React guards refuse missing/expired/revoked sessions, drop current authentication and never turn 401 into empty/no-match/old-account retry. Logout replay fails; later valid login restores only that account's persisted data. |
| Delayed A replies | React recommendation/preference/rating/profile tests plus S13 and T16 browser hold real old requests across navigation/account changes. T16 `TC-S4-T16-ASYNC-001/002` prevents late detail/rating/membership/Similar/private reads or a committed write response from filling B. Historical return contexts cannot restore A's watchlist page for B. |
| Watchlist/profile/reset | Existing migrated DB tests verify uniqueness, persistence, idempotent membership, ownership, rollback/commit failures and reset contention. T12/T13/T15 browsers verify corresponding UI/DB outcomes and later login. Reset removes only A's genres/ratings; **watchlist is preserved**, B and shared catalogue/index remain intact. Explicit watchlist removal removes only the requesting account's membership. |

## S02 #18 — six distinct executed cases

All nodes below are in `tests/test_p0_acceptance.py`, each **PASSED** in the
default run and clean-clone rerun. These cases are separate from S04's six.

| Full test function (prefix `tests/test_p0_acceptance.py::`) | Class / actual assertion |
|---|---|
| `test_TC_P0_S02_001_full_set_paging_has_25_distinct_movies` | Numeric/full-set: **10/10/5**, 25 unique IDs, total 25, 3 pages. |
| `test_TC_P0_S02_002_rating_free_order_and_reasons` | Normal: saved Action preference returns ordered baseline and exact genre-match reasons without ratings. |
| `test_TC_P0_S02_003_no_match_uses_unboosted_popular` | Alternative: saved unmatched genre returns honest unpersonalised popular fallback, preserves saved genre. |
| `test_TC_P0_S02_004_guest_and_expired_cookie_are_private` | Authentication refusal: guest and expired session return **401 AUTHENTICATION_REQUIRED**. This is a business/auth refusal, not a 5xx substitute. |
| `test_TC_P0_S02_005_core_failure_then_retry_preserves_preferences` | Recovery: core read fault returns 503; retry succeeds with saved genres intact. |
| `test_TC_P0_S02_006_filter_after_whole_set_ranking` | Boundary/validation: 12 filtered candidates across **10/2**, full base 35; genre IDs 0 and 2147483648 reject with 400, largest supported 2147483647 is checked and returns unknown-genre refusal. |

## S04 #20 — six distinct executed cases

All nodes below are in `tests/test_p0_acceptance.py`, each **PASSED** in both runs.

| Full test function (same file prefix) | Class / actual assertion |
|---|---|
| `test_TC_P0_S04_001_public_catalogue_pages_include_null_popularity` | Normal/full-set: public alphabetical catalogue includes null-popularity movie; **10/10/5**, 25 unique IDs. |
| `test_TC_P0_S04_002_cold_start_has_no_personal_score` | Normal/cold start: **A90 → B80 → C80**, null-popularity excluded from Popular, no private score fields. |
| `test_TC_P0_S04_003_limit_9_and_10_keep_full_total` | Numeric around-limit: limits **9 and 10** return exact counts with total 25. |
| `test_TC_P0_S04_004_limit_and_page_refusals` | Validation refusal/bounds: limits **0/11**, pages **0/10001/noninteger** return 400; maximum page **10000** is accepted with an empty page. |
| `test_TC_P0_S04_005_empty_active_versus_missing_revision` | Empty active catalogue is valid empty success; missing active revision is **503 CATALOGUE_UNAVAILABLE**, not fake empty success. |
| `test_TC_P0_S04_006_stale_catalogue_revision_is_409` | Revision refusal: stale requested catalogue returns **409 CATALOGUE_CHANGED**. |

The backend pagination suite also runs public catalogue/Popular cases for
0/1/10/11/**25**/255 rows, rating-aware rank-before-slice cases, alphabetical
Home vs popularity comparators, descending Home sort and empty-filter semantics.
Root P0 tests execute all six Stories: S01, S02, S03, S04, S12 and S13.
Existing [T05 effectiveness evidence](../s4-t05-acceptance.md) and
[mutation log](../s4-t05-mutations.txt) are preserved; no new mutation or
historical feature-TDD claim is made by this verification run.

## Rendered browser/UI checks

Browser commands set `S04_BROWSER_CHANNEL=chrome`; suites sharing 8014/5174
were run serially. The separate rating verifier uses 8000/5173. Each suite
uses isolated servers/SQLite and reports cleanup. API-only or jsdom runs above
are not used as proof of rendered browser behaviour.

| Command | Expected / actual | Raw report / log |
|---|---|---|
| `npm --prefix frontend run test:t01:ui` | **16 passed, 1 live-import-only skipped**; Search/Similar success/loading/empty/error/retry, public/auth/preferences UI, keyboard, stars and themes at **375/768/1440px**. | [JSON](browser/t01-results.json), [log](checks/t01-browser-escalated.log) |
| `npm --prefix frontend run test:s04:e2e` | **10 passed, 1 live-TMDb-only skipped**; cold-start/no-match, SQL failure/retry, genre transitions, auth and delayed account replies. | [JSON](browser/s04-results.json), [log](checks/s04-browser.log) |
| `npm --prefix frontend run test:t13:ui` | **4 passed**; profile reset ownership, both themes/layouts, keyboard, rollback/ambiguous recovery and session guard. | [JSON](browser/t13-results.json), [log](checks/t13-browser.log) |
| `npm --prefix frontend run test:t15:ui` | **12 passed**; full reset/reselection/persistence, B isolation, preserved watchlists, keyboard confirmation and stale profile/recommendation responses. | [JSON](browser/t15-results.json), [log](checks/t15-browser.log) |
| `npm --prefix frontend run test:s4:t16:ui` | **20 passed**; details, backdrop failure/next slide, half-star pointer/keyboard/touch, full-set navigation/returns, filtering, stale private responses and failure isolation. | [JSON](browser/t16-results.json), [log](checks/t16-browser.log) |
| `node frontend/scripts/run-s04-e2e.mjs --config playwright.t12.config.ts` | **2 passed**; persisted add/reload/remove, A/B isolation, empty/error and watchlist layouts in both themes at all three widths. | [JSON](browser/t12-results.json), [log](checks/t12-browser.log) |
| `.venv/bin/python backend/scripts/verify_s4_t04_ranking_ui.py --browser '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' --evidence-dir docs/evidence/s4-core-pre-g4/ranking-ui` | **7 checks PASS**, database integrity `ok`; baseline/null, 81/80, 79/80, rating-read failure disclosure, keyboard, six theme/width layouts, unboosted Popular/account switch. | [Output](ranking-ui/t04-browser-run-output.txt), [API/DB](ranking-ui/t04-api-db-evidence.json), [log](checks/t04-ranking-browser-explicit.log) |

Total Playwright: **64 passed, 2 live-only skipped**, no unexpected/flaky cases;
the seven rating-verifier checks are separate. Agent visually inspected all six
Search theme/width screenshots and the degraded-rating screenshot. Text,
controls and cards were legible, with no observed clipping/overlap in those
captures; no independent human visual review is claimed. Preserved screenshots:
[six Search layouts and loading/empty/error/retry](screenshots/),
[ranking layouts and rating degradation](ranking-ui/).

## Separate clean-clone/setup verification

Actually executed in **`/private/tmp/s4-pre-g4-24e8086-clean`**:

```sh
git clone --no-hardlinks --no-checkout . /private/tmp/s4-pre-g4-24e8086-clean
# In the new clone:
git checkout --detach 24e8086f23e7567f20a9e9c237400bf15adf12b1
python3.12 -m venv .venv
.venv/bin/python -m pip install --no-cache-dir --upgrade pip
.venv/bin/python -m pip install --no-cache-dir -r backend/requirements.lock.txt
.venv/bin/python -m pip install --no-cache-dir -e './backend[dev]' --no-deps
cp .env.example .env
mkdir -p data
```

These completed successfully. No `.venv`, `node_modules`, `.env`, database,
build output or cache was copied from the working copy. Dependencies were
downloaded; `--no-cache-dir` disabled pip cache reuse. npm used its own initially
empty cache inside the clone. The shell outside the working repository initially
selected Node 26.10.0/npm 11.19.1. The required Node 24 setup was then executed
with an explicit PATH and another fresh cache:

```sh
export PATH='/Users/trantuananh/.nvm/versions/node/v24.21.0/bin':$PATH
npm --prefix frontend ci --cache /private/tmp/s4-pre-g4-24e8086-clean/.npm-cache-node24
export TMDB_READ_ACCESS_TOKEN='' TMDB_NETWORK_DISABLED=1
.venv/bin/python -m alembic -c backend/alembic.ini upgrade head
.venv/bin/python -m alembic -c backend/alembic.ini current
.venv/bin/python -m alembic -c backend/alembic.ini check
.venv/bin/python -m pip check
.venv/bin/python -m pytest -v
.venv/bin/python backend/scripts/run_isolated_tests.py -v
npm --prefix frontend test
npm --prefix frontend run build
```

| Clean-clone check | Actual result / output |
|---|---|
| Fresh Python locked install/editable install | Exit 0; [locked install](clean-clone/python-install-escalated.log), [editable](clean-clone/editable.log), [pip upgrade](clean-clone/pip-upgrade-escalated.log). |
| Fresh Node 24 locked install | Exit 0; [npm ci](clean-clone/npm-install-node24.log). |
| Migrations/current/schema drift | Head **f2c7e4a91b60**, **No new upgrade operations detected**; [upgrade](clean-clone/migrations.log), [current](clean-clone/migration-current.log), [check](clean-clone/migration-check.log). |
| Installed dependency compatibility | Exit 0, **No broken requirements found**; [pip check](clean-clone/pip-check.log). |
| Default pytest | Exit 0, **762 passed, 1 skipped, 210 subtests passed**, 109.61s; [log](clean-clone/default-pytest.log). |
| Extended backend | Exit 0, **705 passed, 1 skipped**, 117.13s; [log](clean-clone/backend.log). |
| Node 24 frontend tests | Exit 0, **439 passed / 39 files**; [log](clean-clone/frontend-node24.log). |
| Node 24 production build | Exit 0, TypeScript/Vite pass; [log](clean-clone/build-node24.log). |
| Backend/frontend startup and health | Real Uvicorn/Vite processes on unused ports **8029/5179**; HTTP **200** health with head revision and HTTP **200** frontend React entry; [assertions](clean-clone/startup-health-node24.log), [backend](clean-clone/uvicorn-node24.log), [frontend](clean-clone/vite-node24.log). Both owned process groups stopped afterward. |

Startup used `.venv/bin/python -m uvicorn app.main:app --app-dir backend
--host 127.0.0.1 --port 8029` and, from `frontend/`, `node
node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5179 --strictPort`.
The new database deliberately remains unimported: `/api/movies` correctly returns
503 `CATALOGUE_UNAVAILABLE`, without invented data. This is a verified offline
setup/build/startup result, **not live catalogue acceptance**. No M2 seed was
used to stand in for a live import. The documented TMDb import and live index
build/readiness steps remain operator verification.

## Initial failures and resolutions

These attempts are not counted as passes, and raw output is retained.

| Attempt | Actual failure / resolution |
|---|---|
| Initial default pytest with `DATABASE_URL=sqlite:///:memory:` inside sandbox | **1 failed, 755 passed, 1 skipped, 6 errors**: health used an unmigrated DB; six auth fixtures could not bind local sockets. [Log](checks/default-pytest.log). |
| Same default command outside sandbox, before fixing DB setup | **1 failed, 761 passed, 1 skipped**: only health failed. [Log](checks/default-pytest-escalated.log). Manually migrating a new DB made this historical run pass, but was a workaround for missing automatic pytest setup. It did not satisfy #219's default-engine isolation requirement. See the bootstrap correction and reruns in [follow-up](follow-up/README.md). |
| Initial extended backend inside sandbox | **699 passed, 1 skipped, 6 errors**, all local socket permission failures. [Log](checks/backend-extended.log). Authorized rerun passed 705/1. |
| Initial T01 browser inside sandbox | Server bind denied before assertions; [log](checks/t01-browser.log). Authorized rerun passed 16/1. |
| Rating verifier without explicit browser | Browser auto-detection did not find macOS Chrome; [log](checks/t04-ranking-browser.log). Used the existing `--browser` option, then all seven checks passed. |
| Initial clean dependency downloads inside sandbox | DNS/network restrictions prevented the locked Python/npm downloads. Initial pip upgrade exited 0 but only retained old pip after retry warnings; this was not treated as proof of upgrade. [Python](clean-clone/python-install.log), [npm](clean-clone/npm-install.log), [pip](clean-clone/pip-upgrade.log). Authorized network reruns downloaded dependencies and upgraded pip successfully. |
| Initial clean frontend runtime selection | Node 26 was selected outside this repository. Its initial passing outputs are retained with unsuffixed filenames for transparency; final Node 24 `ci`, test, build and startup logs have `node24` in the filename and are the setup evidence used above. |

## Reviewer/operator steps still open

Recommendation for the optional trailer gate: **Defer** until the operator
checks, independent review, hosted CI and an explicit PO/SM capacity decision
are recorded. Current available author/reviewer/final-regression hours were
not supplied; historical issue estimates are not treated as current capacity.

- Live TMDb import was **attempted in the follow-up and failed** because HTTPS
  connections to the provider reset outside the sandbox as well. The separate
  migrated DB contains zero movies and no active revision. Index rebuild/check
  fail without an accepted catalogue. These required gates remain unfulfilled;
  original clean-clone startup evidence is offline only. Follow the existing
  [SETUP](../../SETUP.md) and [TMDb runbook](../../tmdb-sprint3-runbook.md);
  retain only redacted safe evidence. The two live-only browser skips are not passes.
- Human independent substantive review, reviewer identity/eligibility,
  per-member contribution thresholds, PO/SM Go and G4 capacity decisions remain
  project steps. This report does not resolve historical T02 TDD provenance or
  T05 authorship/issue-wording gates recorded in the existing evidence.
- Hosted CI on a submitted final head, GitHub publication/merge, issue closure,
  dossier acceptance and final M4 submission are not performed or certified here.
- No unexecuted required automated core check is labelled Pass. Clean clone is
  actually executed, with the live-provider portion explicitly excluded.
