# Milestone 4 — Testing

This report covers the six P0 Stories: S01, S02, S03, S04, S12 and S13.
The [C05 verification record](evidence/s4-c05/compact-m4.md) identifies the
tested candidate and actual results. C04 #218 owns final independent review,
submission screenshots and manual export of the merged report.

## 1. What we test, and why

| Layer | Test | Purpose |
|---|---|---|
| Services | Controlled inputs through production recommendation/auth/preference rules | Check ranking decisions, valid selections and business-rule refusals. |
| Repository | Migrated temporary SQLite with foreign keys | Check committed rows, uniqueness, rollback and account isolation. |
| Routes | In-process FastAPI TestClient | Check statuses, safe response bodies, cookies and persistence without a running server. |
| Interface | Existing Vitest/browser checks, run separately when needed | Check rendered controls and navigation; these are outside the default M4 pytest suite. Python TestClient does not render React. |

Account isolation and rejected writes receive the most attention because a
mistake can expose or change another user's data. Pagination, missing catalogue
data and numeric limits are also covered because a successful first page can
otherwise conceal broken results.

## 2. Test cases for every P0 story

Each ID maps to a passing pytest name or parameter in
[the default P0 tests](../tests/test_p0_acceptance.py) or
[the S03 tests](../tests/test_s03_details.py).
The [case map](evidence/s4-t05-acceptance.md#p0-section-2-case-map) gives the
exact nodes. Numeric boundaries include genre counts 0/1/2 and 4/5/6,
password lengths 7/8/9 and page-size limits 9/10/11.
The current table has 37 logical IDs and 40 collected pytest items because
one S03 case also checks three combinations of missing optional fields.

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
| TC-P0-S04-004 | S04 #20 | Limit 11 or 0, or page 0/non-integer/10001; page 10000 is valid | Invalid values return 400 `VALIDATION_ERROR`; page 10000 is a valid empty page, without silent total-catalogue cap or coercion ([route](../backend/app/main.py)). | Boundary 11/refusal |
| TC-P0-S04-005 | S04 #20 | Active empty catalogue versus no active revision | Empty active revision is 200 empty with total 0; missing revision is 503 `CATALOGUE_UNAVAILABLE` ([movie repo](../backend/app/repositories/movies.py), [route](../backend/app/main.py)). | Data boundary |
| TC-P0-S04-006 | S04 #20 | Page 2 with stale `catalogueRevision` after import | 409 `CATALOGUE_CHANGED`; client clears old results/restarts page 1 in separate React check ([route](../backend/app/main.py)). | Revision refusal |
| TC-P0-S12-001 | S12 #44 | Register mixed-case email with 8-character password | 201 safe user DTO; normalized email and Argon2id hash persisted, no session created ([route](../backend/app/main.py), [users repo](../backend/app/repositories/users.py)). | Normal/boundary 8 |
| TC-P0-S12-002 | S12 #44 | Password length 7 | 400 `VALIDATION_ERROR`; no user row ([registration schema](../backend/app/schemas/auth.py), [route](../backend/app/main.py)). | Boundary below 8 |
| TC-P0-S12-003 | S12 #44 | Password length 9 | 201, no password/hash in response ([route](../backend/app/main.py), [passwords](../backend/app/security/passwords.py)). | Boundary above 8 |
| TC-P0-S12-004 | S12 #44 | Existing email with case/whitespace variation | 409 `EMAIL_ALREADY_REGISTERED`, exact `This email is already registered`; one user row ([users repo](../backend/app/repositories/users.py), [route](../backend/app/main.py)). | Business refusal |
| TC-P0-S12-005 | S12 #44 | Invalid email or injected commit fault | Invalid input 400; persistence failure 503; neither exposes secret or creates partial account ([route](../backend/app/main.py)). | Validation/infrastructure |
| TC-P0-S13-001 | S13 #45 | Login valid A then GET `/api/auth/me` | 200 safe A DTO; opaque HttpOnly same-origin cookie, no token in body ([route](../backend/app/main.py), [sessions](../backend/app/security/sessions.py)). | Normal |
| TC-P0-S13-002 | S13 #45 | Wrong password and unknown email | Both 401 `INVALID_CREDENTIALS`, exact `Email or password is incorrect` ([route](../backend/app/main.py)). | Auth refusal |
| TC-P0-S13-003 | S13 #45 | Logout A, replay old cookie, login A again | Logout 204; replay gets 401; new session accesses persisted A preferences/ratings ([route](../backend/app/main.py), [sessions](../backend/app/security/sessions.py)). | Session lifecycle |
| TC-P0-S13-004 | S13 #45 | Missing/expired/revoked cookie on protected reads/writes | Each 401; no personal rows leak or change ([route](../backend/app/main.py), [sessions](../backend/app/security/sessions.py)). | Session boundary |
| TC-P0-S13-005 | S13 #45 | A and B have different genres/ratings; B forges A identity field | B sees and changes only B rows; malformed identity body is rejected where schema forbids it ([route](../backend/app/main.py), [repositories](../backend/app/repositories/)). | Account isolation |
| TC-P0-S13-006 | S13 #45 | Cross-origin login/logout or protected write | 403 `ORIGIN_NOT_ALLOWED`; no session revocation/private mutation ([origin policy](../backend/app/security/origin.py), [route](../backend/app/main.py)). | CSRF refusal |

## 3. Automated tests

After the locked Python installation in [SETUP.md](SETUP.md), run from the
repository root with the virtual environment active:

```text
pytest
python -m pytest -v
```

On Windows without activating PowerShell scripts:

```powershell
.\.venv\Scripts\pytest.exe
.\.venv\Scripts\python.exe -m pytest -v
```

Both commands select only `tests/test_p0_acceptance.py` and
`tests/test_s03_details.py` through committed `pytest.ini`.
The default suite and the Section 2 trace check run automatically in CI.
`python scripts/verify_s4_t05_trace.py` verifies the actual default
collection rather than a broader separately selected directory.

Root fixtures override inherited database/token/index settings before app
imports, migrate temporary SQLite, block provider HTTP and remove owned
temporary files afterward. No .env, real database, running service, browser,
Node installation or live TMDb token/network is needed for these tests.
Per-case fixtures exercise the real routes and persisted rows with synthetic
accounts/movies; they do not merely compare hard-coded fake return values.

Actual count, runtime, full verbose output and screenshot are linked from
[the current C05 record](evidence/s4-c05/compact-m4.md).
Existing backend/frontend/browser/script regressions remain available as
[explicit optional checks](SETUP.md#optional-regressions); they are not part
of the default command or an additional M4 report requirement.

## 4. What the tests found

T16 #211 found that the async watchlist membership handler blocked the event
loop during SQLite COMMIT, preventing a concurrent reader from being released.
`TC-P0-S03-006` reproduced HTTP 503 before the fix; running the DB work in the
worker pool restored HTTP 200 and correct saved state. The guarding pytest
remains in [test_s03_details.py](../tests/test_s03_details.py), and
[PR #235](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/235)
contains the T16 work.

The [original T16 evidence](evidence/s4-t16-detail-boundaries.md) records the
failure, correction and green result. This is a genuine regression finding,
not a setup failure or a claim of test-before-feature TDD.
