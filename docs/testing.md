# Sprint 4 C03 testing contract

Status: expected contract for [S4-C03 #217](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/217),
dated 2026-10-24, with the S03 execution amendment from
[S4-T16 #211](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/211).
S03 now has scoped executable root pytest and separate interface tests; its
commands and limits are below. Other planned rows and the shared six-P0
default discovery/clean-clone gate still need C05 #219 and their assigned
authors. This document does not certify independent review. The current implemented boundary is
[api.md](api.md#1-conventions); planned additions are in its section 13.
Historical M2/M3 evidence remains historical.

## 1. What we test, and why

| Layer | Production nodes | Test method and purpose |
|---|---|---|
| Services | [recommendation service](../backend/app/recommendations/service.py), [ranker](../backend/app/recommendations/ranker.py), [security](../backend/app/security/) and later NLP/profile/watchlist services | Unit tests with controlled inputs/fake repository at service boundaries check decisions and ranking; real integration cases still assert production behaviour. |
| Repository | [repositories](../backend/app/repositories/), [models](../backend/app/db/models.py) | Temporary migrated SQLite with foreign keys on checks uniqueness, account isolation, atomic replace/reset and rollback; no developer database. |
| Routes | [FastAPI routes](../backend/app/main.py), [schemas](../backend/app/schemas/) | In-process FastAPI `TestClient` against migrated temporary SQLite checks exact HTTP status, DTO/error shape, cookie/origin/session and persistence. No running server. |
| Interface | [React frontend](../frontend/src/) | Existing Vitest/React Testing Library and browser checks cover labels, navigation, both themes, keyboard, responsive states and stale requests. Python `TestClient` cannot verify rendered React or browser navigation; interface evidence is separately required. |

The highest risks are account leakage across sessions, partial reset/save
transactions, and false success when catalogue or index data is unavailable;
these get real-DB and route assertions before visual polish. Whole-set
ranking/paging and stable error messages are next because a superficially
correct first page can conceal missing movies or broken P0 journeys.
Optional media is verified without real network in CI.

## 2. Test cases for every P0 story

Each ID below specifies a root pytest case; the S03 rows link to the executed
implementation added by T16, while other rows remain planned until their own
test/evidence is supplied. `Normal`,
`Refusal`, `Boundary`, `Failure` and `Isolation` are case kinds, not
claims of a run. The linked node is the production rule the assertion must
exercise. One test may share setup, but every ID needs its own meaningful
production assertion and appears in its test name or parameter ID. Mocked
provider responses and deterministic seeded movie IDs are allowed; a
hard-coded fake return value is not a substitute for the production rule.
For a 400, assert `VALIDATION_ERROR`; for a source failure assert the
actual 503 envelope rather than a business-rule refusal.

| ID | Story | Input | Expected result | Kind |
|---|---|---|---|---|
| TC-P0-S01-001 | S01 #17 | Authenticated A reads selectable genres and empty saved preferences | 200 local canonical active genres; A's saved list empty; no provider call ([routes](../backend/app/main.py), [preferences repo](../backend/app/repositories/preferences.py)). | Normal |
| TC-P0-S01-002 | S01 #17 | A saves 0 genre IDs after having 2 | 400 `VALIDATION_ERROR`; prior 2 remain in DB ([preference schema](../backend/app/schemas/preferences.py), [repo](../backend/app/repositories/preferences.py)). | Boundary below 1 |
| TC-P0-S01-003 | S01 #17 | A saves exactly 1 valid ID | 200 with that committed genre and one DB row ([route](../backend/app/main.py), [repo](../backend/app/repositories/preferences.py)). | Boundary 1 |
| TC-P0-S01-004 | S01 #17 | A saves exactly 2 valid IDs | 200 sorted committed rows; B's rows unchanged ([repo](../backend/app/repositories/preferences.py)). | Boundary 2 |
| TC-P0-S01-005 | S01 #17 | A saves exactly 4 valid IDs | 200 and exactly 4 distinct committed rows ([repo](../backend/app/repositories/preferences.py)). | Boundary 4 |
| TC-P0-S01-006 | S01 #17 | A saves exactly 5 valid IDs | 200 and exactly 5 distinct committed rows ([preference schema](../backend/app/schemas/preferences.py)). | Boundary 5 |
| TC-P0-S01-007 | S01 #17 | A saves 6 IDs, duplicate IDs or boolean/string ID | Each 400; previous selection preserved, no partial delete ([schema](../backend/app/schemas/preferences.py), [repo](../backend/app/repositories/preferences.py)). | Boundary above 5/refusal |
| TC-P0-S01-008 | S01 #17 | Guest PUT or forged `userId`/cross-origin PUT | 401/400/403 as applicable; A/B selections unchanged ([route](../backend/app/main.py), [origin policy](../backend/app/security/origin.py)). | Auth refusal |
| TC-P0-S02-001 | S02 #18 | A has one saved genre and 25 distinct matching movies, request pages 1/2/3 with limit 10 | Personalised page IDs are 10/10/5, no duplicates; `total=25,totalPages=3`, rank whole set before slice ([service](../backend/app/recommendations/service.py), [repo](../backend/app/repositories/recommendations.py)). | Normal/paging |
| TC-P0-S02-002 | S02 #18 | One genre match among several, rating-free baseline | Matching movie precedes lower-popularity match by finite popularity/title/ID; each reason contains actual matched genres ([ranker](../backend/app/recommendations/ranker.py), [service](../backend/app/recommendations/service.py)). | Normal/ranking |
| TC-P0-S02-003 | S02 #18 | A's saved genres match none of active movies | 200 `mode=popular,personalised=false,noMatch=true`; only finite-popularity alternatives; preferences unchanged ([service](../backend/app/recommendations/service.py)). | Business boundary |
| TC-P0-S02-004 | S02 #18 | Guest/expired cookie requests recommendations | 401 `AUTHENTICATION_REQUIRED`, no private DTO ([route](../backend/app/main.py), [sessions](../backend/app/security/sessions.py)). | Auth refusal |
| TC-P0-S02-005 | S02 #18 | Inject catalogue/preference query failure, then restore it | First 503 with requestId and no success `data`; retry returns current results, no preference rewrite ([route](../backend/app/main.py)). | Infrastructure failure |
| TC-P0-S02-006 | S02 #18 | 12 filtered matches occur across a 35-item ranked base, including matches outside page 1 | Filtered pages 10/2, `total=12,unfilteredTotal=35`; base mode and ranking remain, DB preferences unchanged ([service](../backend/app/recommendations/service.py), [route](../backend/app/main.py)). | Whole-set boundary |
| TC-P0-S03-001 | S03 #19 | Public GET for active movie with genres, nullable year/overview/backdrop | 200 stable opaque ID, genres and JSON nulls, no private rating read ([route](../backend/app/main.py), [movie schema](../backend/app/schemas/movies.py)). | Normal |
| TC-P0-S03-002 | S03 #19 | Public GET unknown opaque movie ID | 404 `MOVIE_NOT_FOUND`, never a blank success; UI return target is separately verified in React ([route](../backend/app/main.py), [detail page](../frontend/src/pages/MovieDetailPage.tsx)). | Business refusal |
| TC-P0-S03-003 | S03 #19 | Missing active catalogue versus injected DB fault | Both 503 with correct `CATALOGUE_UNAVAILABLE` or `SERVICE_UNAVAILABLE`, never false 404 ([route](../backend/app/main.py)). | Infrastructure boundary |
| TC-P0-S03-004 | S03 #19 | Guest opens a valid detail ID with a list-context query, then with an external-looking query | In both cases production detail GET remains public 200 with the same movie and no redirect/private data; separate React/browser test must reject unsafe return URLs and restore safe page/filter/revision ([route](../backend/app/main.py), [navigation](../frontend/src/navigation/movieDetailReturn.ts)). | Safe return boundary |
| TC-P0-S03-005 | S03 #19 / T16 #211 | A/B save distinct preferences; guest/A/B read details/similar; A saves a rating and watchlist membership, then reads recommendations | Both persisted preference sets remain identical; B has no A rating/membership ([production routes](../backend/app/main.py), [root API/SQLite tests](../tests/test_s03_details.py)). | Persistence/isolation |
| TC-P0-S03-006 | S03 #19 / T16 #211 | One ASGI event loop, a real list read snapshot and a membership writer at COMMIT; another coroutine releases the reader | Membership returns 200 with true saved state instead of a self-induced SQLite busy 503; worker-thread DB commit leaves the loop available for reader cleanup ([membership route](../backend/app/main.py), [deterministic SQLite/ASGI regression](../tests/test_s03_details.py)). | Concurrent widget/list boundary |
| TC-P0-S04-001 | S04 #20 | Guest with 25 active movies including null popularity requests catalogue pages 1/2/3 | 200 pages 10/10/5, `total=25,totalPages=3`; alphabetical whole-set order and null-popularity entry retained ([movie repo](../backend/app/repositories/movies.py), [route](../backend/app/main.py)). | Normal/paging |
| TC-P0-S04-002 | S04 #20 | Cold-start A with no preferences requests recommendations | 200 `mode=popular,personalised=false,noMatch=false`; finite-popularity order and no private score fields ([service](../backend/app/recommendations/service.py)). | Normal/cold start |
| TC-P0-S04-003 | S04 #20 | Limit 9 and 10 on a 25-movie catalogue | Both accepted; counts 9/10 and totals remain 25 ([route](../backend/app/main.py)). | Boundary 9/10 |
| TC-P0-S04-004 | S04 #20 | Limit 11 or 0, or page 0/non-integer | 400 `VALIDATION_ERROR`, no silent total-catalogue cap or coercion ([route](../backend/app/main.py)). | Boundary 11/refusal |
| TC-P0-S04-005 | S04 #20 | Active empty catalogue versus no active revision | Empty active revision is 200 empty with total 0; missing revision is 503 `CATALOGUE_UNAVAILABLE` ([movie repo](../backend/app/repositories/movies.py), [route](../backend/app/main.py)). | Data boundary |
| TC-P0-S04-006 | S04 #20 | Page 2 with stale `catalogueRevision` after import | 409 `CATALOGUE_CHANGED`; client clears old results/restarts page 1 in separate React check ([route](../backend/app/main.py)). | Revision refusal |
| TC-P0-S12-001 | S12 #44 | Register mixed-case email with 8-character password | 201 safe user DTO; normalized email and Argon2id hash persisted, no session created ([route](../backend/app/main.py), [users repo](../backend/app/repositories/users.py)). | Normal/boundary 8 |
| TC-P0-S12-002 | S12 #44 | Password length 7 | 400 `VALIDATION_ERROR`; no user row ([registration schema](../backend/app/schemas/auth.py), [route](../backend/app/main.py)). | Boundary below 8 |
| TC-P0-S12-003 | S12 #44 | Password length 9 | 201, no password/hash in response ([route](../backend/app/main.py), [passwords](../backend/app/security/passwords.py)). | Boundary above 8 |
| TC-P0-S12-004 | S12 #44 | Existing email with case/whitespace variation | 409 `EMAIL_ALREADY_REGISTERED`, exact `This email is already registered`; one user row ([users repo](../backend/app/repositories/users.py), [route](../backend/app/main.py)). | Business refusal |
| TC-P0-S12-005 | S12 #44 | Invalid email or injected commit fault | Invalid input 400; persistence failure 503; neither exposes secret or creates partial account ([route](../backend/app/main.py)). | Validation/infrastructure |
| TC-P0-S13-001 | S13 #45 | Login valid A then GET `/api/auth/me` | 200 safe A DTO; opaque HttpOnly same-origin cookie, no token in body ([route](../backend/app/main.py), [sessions](../backend/app/security/sessions.py)). Browser companion `TC-S4-AUTH-001` verifies the amended Home landing. | Normal |
| TC-P0-S13-002 | S13 #45 | Wrong password and unknown email | Both 401 `INVALID_CREDENTIALS`, exact `Email or password is incorrect` ([route](../backend/app/main.py)). | Auth refusal |
| TC-P0-S13-003 | S13 #45 | Logout A, replay old cookie, login A again | Logout 204; replay gets 401; new session accesses persisted A preferences/ratings ([route](../backend/app/main.py), [sessions](../backend/app/security/sessions.py)). | Session lifecycle |
| TC-P0-S13-004 | S13 #45 | Missing/expired/revoked cookie on protected reads/writes | Each 401; no personal rows leak or change ([route](../backend/app/main.py), [sessions](../backend/app/security/sessions.py)). | Session boundary |
| TC-P0-S13-005 | S13 #45 | A and B have different genres/ratings; B forges A identity field | B sees and changes only B rows; malformed identity body is rejected where schema forbids it ([route](../backend/app/main.py), [repositories](../backend/app/repositories/)). | Account isolation |
| TC-P0-S13-006 | S13 #45 | Cross-origin login/logout or protected write | 403 `ORIGIN_NOT_ALLOWED`; no session revocation/private mutation ([origin policy](../backend/app/security/origin.py), [route](../backend/app/main.py)). | CSRF refusal |

The numeric boundaries above are a floor. Add named cases if the final
contract gains a numeric/date/session rule; use a frozen clock for expiry and
UTC `addedAt` assertions. Current page range is 1–10000 and `genreId`
range is 1–2147483647: test below/on/above values where exposed, including
unknown in-range ID versus invalid out-of-range ID. A final C04 #218 audit
must map every row to its actual executed test node and assertion.

Sprint 4 feature owners also need these named contract oracles, separate from
the six-P0 floor:

| ID | Owner | Input and production assertion |
|---|---|---|
| TC-S4-RANK-001 | #197/#198 | Two Action/Comedy candidates each raw 80: +1 related rating yields 81/80, -1 yields 79/80; raw values stay 80; title/ID tie is deterministic; a rated film with two shared genres contributes once. |
| TC-S4-RANK-002 | #197/#198 | Neutral/no signals preserve Sprint 3 order; null popularity remains null; rating-only failure exposes truthful `rating_unavailable`; 401/core 503 are never disguised as fallback. |
| TC-S4-RANK-003 | #198 | Rank 25 eligible movies before genre view filter/page; public Popular and cold-start/no-match have no personal boosts or fields. |
| TC-S4-NLP-001 | T06 | Build once per `corpusDigest` + `configFingerprint`; changing normalized overview while keeping `catalogueRevision` fixed makes the index stale (503 until rebuild). A config-only change also stales it; a poster/backdrop-only change keeps text index ready without rebuild. Corrupt/missing artifact is 503; explicit empty vocabulary is ready and yields zero cosine. |
| TC-S4-SIM-001 | T07/T08 | Shared-genre only, source excluded, unique max five; usable zero-cosine text before missing text; source missing vector triggers all-popularity fallback; unknown ID is 404. |
| TC-S4-SEARCH-001 | T09/T10 | Static search route, trimmed length 1 rejected, literal `%`/`_` and `ZEBRA` title search, title priority, max ten; `Moon Rescue` precedes `City Robot` in positive overview fixture; separate all-zero fixture returns none. |
| TC-S4-RESET-001 | #206/#207 | Real migrated DB rollback after first delete and at commit; A/B isolation, both ordered save/reset commit sequences, separate-process writer contention in DELETE and WAL modes, timeout reread, watchlist preserved and later-login persistence. |
| TC-S4-WATCH-001 | #207 | Unique membership, immutable `addedAt`, GET/PUT `inWatchlist`, and repeated DELETE `200 {data:{movieId,inWatchlist:false}}`; list order/paging/revision/CSRF/401/404 and reset preservation. |
| TC-S4-UI-001 | #195/#208 | Five integer draft/hover/keyboard/explicit-save semantics, null poster fallback, both themes, 320px layout and account/movie stale-response protection. |
| TC-S4-AUTH-001 | T01 / Story #45 | Browser check: normal Home/direct login -> Home with authenticated header and no automatic preference/recommendation read or save; guest Start -> login/register -> Preferences; single navbar My recommendations -> cold-start without genres; unsafe return destination -> Home. |

These rows define expected checks. Author-local T16 execution is recorded
separately below and in its evidence; other rows are not accepted by implication.

## 3. Automated tests

The intended **single repository-root default** is `pytest` (verbose:
`python -m pytest -v`). C05 #219 owns the root `tests/` discovery,
shared fixtures and direct command setup after this contract. The root suite
must execute every Section 2 ID, not simply collect a matrix; existing
`backend/tests/` and frontend Vitest/browser suites remain intact and
useful. Do not delete or skip them to manufacture green results.

Root fixtures create a fresh temporary SQLite file, run Alembic migrations,
enable foreign keys, override `get_db` for in-process `TestClient`,
seed deterministic synthetic provider/movie/account data and freeze clocks.
Set a blank TMDb token and block live network/provider calls. No running
FastAPI/Vite server, existing `data/app.db`, developer `.env`, provider
account or token is required. Clean up fixtures after every case; avoid
test-order dependence. Unit fake repositories may isolate service decisions,
but status/DB assertions run the real production route/repository. Store
deterministic expected order and exact HTTP errors, not snapshots of fake
responses. Real live TMDb provenance smoke is separate and manual.

Expected commands after C05 infrastructure exists:

```text
pytest
python -m pytest -v
python backend/scripts/run_isolated_tests.py -v
npm --prefix frontend test
```

The first two commands are the future root acceptance gate; the third is
the existing backend isolation runner; the fourth covers React. Record the
actual root runtime in seconds and a screenshot of the **full** verbose
output, with command, environment, candidate SHA, passed/failed/skipped count
and date. A `TestClient` pass does not establish React rendering, keyboard
behaviour, both themes or navigation. Browser/API/database evidence for those
states is collected by the relevant feature owner and reconciled by #218.

### S03 / S4-T16 scoped execution

[tests/test_s03_details.py](../tests/test_s03_details.py) implements
`TC-P0-S03-001` (normal plus three missing-year/summary variants), `002`
(404), `003` (distinct 503 errors), `004` (public query/redirect boundary),
`005` (real A/B sessions and preference preservation), and `006` (one ASGI
loop with a real SQLite reader/writer): nine pytest
items in total. After the documented editable backend installation, run
from the repository root:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_s03_details.py -v
npm.cmd --prefix frontend run test:s4:t16:ui
```

The module configures its own migrated temporary SQLite, foreign keys,
default engine and `get_db` before using production routes. It ignores
dotenv loading, blanks the provider token and rejects real HTTP transports.
It needs no service/browser/token for pytest. This scoped command does not
claim the entire six-P0 default suite has been delivered; C05 retains shared
discovery, fixtures, CI/default-command and independent clean-clone ownership.
Existing backend and frontend CI tiers remain intact; T16 adds an explicit
[S03/interface job](../.github/workflows/s4-t16-detail-boundaries.yml).

If Windows denies an old pytest temp/cache directory, use a **new** path,
without deleting or changing permissions on an existing directory:

```powershell
$caseTemp = Join-Path $env:TEMP ('s03-' + [guid]::NewGuid().ToString('N'))
.\.venv\Scripts\python.exe -m pytest tests/test_s03_details.py -v -p no:cacheprovider --basetemp "$caseTemp"
```

The browser command owns temporary servers on 8014/5174 and a separate
migrated database/index. Release those ports before running; its parent
runner removes its database on exit. `S04_BROWSER_CHANNEL=chrome` selects
an installed Chrome; otherwise install Playwright Chromium as documented.
This is separate from the old S3 `test:t16:integration` filter suite.

Interface traceability for the current post-M3 S03 return AC:

| Case ID | Executable assertion |
|---|---|
| TC-S4-T16-RET-001 | [Browser](../frontend/e2e/s4-t16.detail-boundaries.ts): Home Z-A and Popular page 2, app return and browser Back, dark desktop/light mobile; no guest private reads. |
| TC-S4-T16-RET-002 | [Component](../frontend/src/tests/list-context-invalidation.test.tsx) and browser: old revision gets a real 409, returns to page 1 and drops the stale genre filter. |
| TC-S4-T16-RET-003 | Browser: filtered recommendation page 2 survives confirmed rating save/refetch; preferences unchanged. Existing [rating refresh tests](../frontend/src/tests/rating-recommendation-refresh.test.tsx) also cover failure/draft semantics. |
| TC-S4-T16-RET-004 | Browser: search query -> exact detail -> exact Similar -> original search query/fragment. |
| TC-S4-T16-RET-005 | Browser and existing context tests: changed preferences invalidate a historical detail return without reverting saved genres. |
| TC-S4-T16-WATCH-001 | [Component](../frontend/src/tests/detail-boundaries.test.tsx) and browser: B cannot inherit A's watchlist page/context, even when both have two valid pages. |
| TC-S4-T16-WATCH-002 / WATCH-003 | Component: ignored-abort late membership success after movie/account/logout changes, and late 401 after movie/account changes. |
| TC-S4-T16-WATCH-004 | Browser: exact Watchlist page 2 return; removal of its last row produces total 10/page 1 with ten actual cards. |
| TC-S4-T16-WRITE-001 / WRITE-002 | Component: old membership 200/401/503 and old rating-save success cannot notify/invalidate the new movie/account. Existing rating cases retain stale 401/503 coverage. |
| TC-S4-T16-ASYNC-001 / ASYNC-002 | Browser: hold real detail/rating/membership/similar responses, switch movie/account through the SPA and release; also release an old committed membership PUT after account switch. |
| TC-S4-T16-FAIL-001 | Component/browser: a controlled membership 503 has Retry and does not hide source details, rating, Similar or the recommendation return. |
| TC-S4-T16-PUBLIC-001 | Browser: actual `Information unavailable` and `Movie not found` labels; unsafe external return state falls back to the catalogue. |

Contract publication has separate read-only structure and line-ending
checks: `python scripts/verify_s4_c03_contract.py` and
`python scripts/test_s4_c03_contract_line_endings.py`. Both use UTF-8
text hashed after CRLF/CR -> LF normalization. They check this document
and its traceability on independent LF/CRLF exports; neither is a substitute
for future production P0 pytest or browser acceptance.

Genuine feature TDD for #197/#198 means a rule test failed **before**
production implementation, then passed after the implementation; keep dated
RED/GREEN output and tested SHA. Test-effectiveness mutation is separate:
temporarily change a relevant production business rule after a test exists,
observe that its production assertion fails, restore the rule and rerun green.
Syntax/import/setup failure is invalid mutation evidence. Every case must
trace from TC-ID to a production function/route and its asserted outcome;
test-only duplicate logic or a fake's hard-coded result does not satisfy
that trace. #200 audits the P0/rating/ranking evidence later; #218 checks
that the final documented cases actually execute and pass.

## 4. What the tests found

S4-T16 reproduced two return-context regressions against `486adab`:
recommendation revision recovery retained a stale genre, and a historical
Watchlist return could restore A's page for B. New assertions failed before
the fixes (`2 failed, 18 passed`) and passed after the fixes. The
[T16 evidence](evidence/s4-t16-detail-boundaries.md) records final runs,
source identity, screenshots and the independent review/Story-checkbox
handoff still required. A later Linux CI run reproduced membership 503 while
seeding. A deterministic same-loop SQLite regression then proved the third
bug: the async membership handler blocked the loop at COMMIT, preventing a
concurrent read snapshot from being released. The DB handler now runs in the
worker pool; async raw-body validation and all auth/transaction/DTO contracts
remain unchanged. TC-P0-S03-006 failed with HTTP 503 before the fix and passed
with HTTP 200 afterward. These are actual bug regressions, not setup failures
or a claim of deliberate business-rule mutation. The following C03 paragraph
is the historical baseline before feature implementation.

At C03 publication, no new root suite runtime, screenshot, mutation result,
TDD RED/GREEN event, reviewer acceptance or bug-fix PR was claimed. The S03
amendment above supersedes that pending execution status only for its own
cases, not the entire M4 suite. Record further evidence here only from an actual
run: candidate SHA, command, date/time, environment, measured seconds,
expected/observed statuses and DB values, TC-ID-to-test-node mapping,
full-output screenshot and independent non-coauthor reviewer.

The [local C03 check](evidence/s4-c03-local-contract-check.md) observed
`447 passed, 1 skipped` in the existing isolated backend suite on a
temporary migrated SQLite database. That validates the inherited baseline
only; it does not execute or pass the new Section 2 IDs.
The [C03 acceptance matrix](evidence/s4-c03-acceptance-matrix.md) maps
the supplied requirements to exact contract sections and records the
reproducible local document checks.

The final dossier needs at least one actual bug with fix/PR/guarding test,
or a clearly labelled intentional **business-rule mutation** with the failing
assertion output and restored green rerun. C04 #218 owns final compilation
and consistency against the selected executable; C03 defines the expected
evidence and does not certify it in advance.
