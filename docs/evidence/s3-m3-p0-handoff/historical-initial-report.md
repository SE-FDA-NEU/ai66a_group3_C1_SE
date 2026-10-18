# Historical initial M3 acceptance report — superseded

This is the initial macOS report for application `86a758e`, retained as history.
Its candidate, counts, open-C04 statements and proposed-PR wording are **not**
the current state. Use [the current report](README.md) and its latest evidence.

Verification date: **2026-10-18, Asia/Ho_Chi_Minh**. Tester: Codex, executing
the requested local verification; this is not independent teammate approval.

**Functional checks passed; the final acceptance/release gate remains open.**
All six P0 Stories are **partly works** under the required AC + DoD status rule.
No production implementation was changed and no production defect was found.
Do not close Stories or claim a reviewed/merged handoff on the strength of this
local report. [Proposed handoff PR and review checklist](handoff-pr.md).

## Candidate and evidence boundaries

The single application candidate is
[`86a758eb2468f3e23357b69adf3c3183e5110a40`](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/commit/86a758eb2468f3e23357b69adf3c3183e5110a40).
Initial `git rev-parse HEAD` returned that SHA; initial `git status` reported
`On branch main`, up to date with `origin/main`, and a clean working tree.
Acceptance changes in this handoff are uncommitted additions on that base.
The live runner byte-compares every tracked `backend/app`, `backend/alembic`
and `frontend/src` file with `git show HEAD:<file>` before running. Application
source remains exactly the candidate; this report does **not** invent a commit
SHA containing the new acceptance tooling. The runner hash and working tree are
recorded in each live result; Playwright records per-file source hashes.

| Layer | Current-candidate evidence | What it proves |
|---|---|---|
| Live accepted snapshot | [Live result/provenance](live/results.json), [T22 rerun](checks/t22-live.txt), [S13 rerun](checks/s13-live.txt) | React → real HTTP → FastAPI → session cookie → migrated SQLite, using the existing TMDb snapshot; no mocked feature responses, no reimport |
| Fresh setup, separate live snapshot | [Clean-clone result](clean-clone-live/results.json), [migration/import output](checks/clean-migration-import.json), [clean backend](checks/clean-backend-tests.txt), [clean frontend](checks/clean-frontend-tests.txt) | Fresh local clone, new venv, locked installs, all migrations, real one-page TMDb import, first-screen browser journey |
| Synthetic real-stack browser | [Playwright result/manifest](synthetic/playwright-results.json), [console output](checks/s04-s13-synthetic.txt), [T12](checks/t12.txt), [T21](checks/t21.txt) | Deterministic ranking, missing fields, empty/no-match/failure/retry, races, account isolation; synthetic fixture data, no real token |
| API + database | [417 passing backend tests](checks/backend-tests.txt) | Real HTTP subprocess/restart cases plus repository/integration tests; attack cases and committed SQLite assertions |
| Supporting React checks | [236 passing frontend tests](checks/frontend-tests.txt), [T16 cross-runtime](checks/t16.txt) | Rendering and control regressions; Vitest/jsdom alone is not counted as browser E2E |

Historical evidence below keeps its original SHA and limitations. It supplies
test design, ownership and review history, not a substitute result for this SHA.
All newly recorded runs above use the same application candidate.

## Environment and safe provenance

| Field | Observed value |
|---|---|
| OS | macOS 26.2, Darwin 25.2.0, arm64 |
| Python / Node / npm | 3.12.4 / v24.21.0 / 11.19.0 |
| Browser | Playwright Chromium 156.0.8078.4; T12/T21/T22 use Google Chrome 155.0.8059.84 via their existing `--browser` option |
| DB | File-backed SQLite; source opened read-only and backed up with SQLite's backup API; all acceptance account writes occur in disposable copies |
| Migration head | `c6f8a2d4e901`; existing source was at `b7e4c2d91f30`; copies upgraded **before** API/browser startup |
| Existing accepted active revision | `e57f73b5-98d8-49e3-b538-9a3cb76290eb`, provider `tmdb`, inserted/updated/rejected `20/0/0` |
| Existing snapshot counts | 20 movies, 20 distinct source IDs, 0 non-TMDb rows, 20 finite-popularity movies, 20 fetch timestamps, 12 associated genre IDs |
| Existing fetch / import | `2026-10-08 17:28:41.056306` / `2026-10-08 17:28:42.177221` (stored UTC values) |
| Safe source samples | `1032863`, `1084244`, `1101383`; full safe sample/provenance rows in `live/results.json` |
| Missing optional fields in existing snapshot | 0 missing years and 0 missing overviews; missing-field acceptance is separately synthetic |
| Fresh clean-clone revision | `709fe328-26fd-4bed-b1b2-e0e87cbaa00c`, `tmdb`, inserted/updated/rejected `20/0/0`; 20 movies, 20 finite popularity, 12 associated genres |
| Fresh fetch / import | `2026-10-17T18:15:38.576552Z` / `2026-10-17T18:15:40.176944Z` |

The existing accepted catalogue was not refreshed, seeded, overwritten or
migrated in place. Its provenance was unchanged after the live run. The fresh
clone's import is **separate setup evidence**, not a replacement for the accepted
snapshot. Runtime acceptance uses a blank provider token; the browser reads the
local API. No DB, dump, auth cookie, generated password or token is included.

## P0 AC-to-evidence matrix

AC numbering follows the linked Story issues, cross-checked against
[requirements](../../requirements.md). **PASS** below describes functional
acceptance, not completion of the remaining DoD/review gates.

| Story / AC | Screen and route | Actual result and executable evidence |
|---|---|---|
| [S01 #17](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/17) AC1 | Home `/` → picker `/preferences` | PASS: signed-in visible Start opens available genres. `verify_s01_preferences_ui.py`, [T22 AC1](checks/t22-live.txt), live runner Start/restored-picker check. |
| S01 AC2 | Picker → `/recommendations` | PASS: real one- and five-genre saves commit rows and navigate; live runner checks successful PUT then a **fresh** current-account recommendation GET. [T22 AC2](checks/t22-live.txt), [live](live/results.json). |
| S01 AC3 | Picker `/preferences` | PASS: zero selection stays on picker, exact corrective message; committed prior selection preserved in T22. [T22 AC3](checks/t22-live.txt), [live mobile error](live/live-mobile-corrective-message.png). |
| S01 AC4 | Picker `/preferences` | PASS: sixth checkbox rejected; first five kept; six-ID API replacement rejected without overwrite. [T22 AC4](checks/t22-live.txt). |
| S01 AC5 | Picker; account switch | PASS: revisits restore one/five choices; B starts empty and cannot see A. [T22 AC5](checks/t22-live.txt), `s13.acceptance.ts` account-switch case. |
| [S02 #18](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/18) AC1 | Recommendations `/recommendations` | PASS: ≤10 distinct movies, each matches a current-account selected genre. Live API/card checks; T12 exact fixture oracle. [Live](live/results.json), [T12](checks/t12.txt). |
| S02 AC2 | Recommendation cards | PASS: title/genres and reasons naming a matching selected genre. T12 `assert_cards`; live runner compares card titles and real `reason.matchedGenres`. |
| S02 AC3 | No-match recommendations | PASS: real 200/noMatch, exact no-match heading, ≤10 popular alternatives, Edit preferences and Retry; zero-alternative case also passes. [T12](checks/t12.txt), `s04.acceptance.ts` no-match cases. |
| S02 AC4 | Recommendation error | PASS: real catalogue-pointer 503 (T12) and real SQL failure 503 (S04); error/Retry, no fake no-match/empty claim, preferences unchanged. [T12](checks/t12.txt), [synthetic results](synthetic/playwright-results.json). |
| S02 AC5 | Error → Retry → data | PASS: restore source and click actual Retry; same account gets personalised cards. T12/S04 retry assertions. |
| [S03 #19](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/19) AC1 | Public details `/movies/:movieId` | PASS: visible card → correct movie route, API title/year/overview and rendered data; guest and signed-in flows. [Live](live/results.json), [S13 live](checks/s13-live.txt), T18 unit suite. |
| S03 AC2 | Invalid detail URL | PASS: separate negative route check shows exactly `Movie not found` and visible Return to catalogue. `s13.acceptance.ts` guest/guard case; backend `test_movies_api.py` verifies 404 envelope. This direct invalid URL is not claimed as normal discovery. |
| S03 AC3 | Details with null year/overview | PASS, **synthetic**: existing migrated S04 fixture has null fields; actual API values are null and browser displays `Information unavailable` twice while title/genres remain. [Browser capture](synthetic/missing-detail-fields.png). T18 `movie-detail-acceptance.test.tsx` additionally checks each missing field independently. No claim that live TMDb currently contains such a movie. |
| S03 AC4 | Details → recommendation return | PASS: visible Back to recommendations returns; saved preferences remain, picker restores choices. Live runner, T22/T23 and T18 return-context tests. |
| [S04 #20](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/20) AC1 | Newly signed-in `/recommendations` | PASS: live non-personalised top-ten result matches DB oracle; synthetic A90/B80/C80 order, title ties, distinct/≤10 and label pass. `s04.acceptance.ts` AC1/2/4 case and [live](live/results.json). |
| S04 AC2 | Cold-start → `/preferences` | PASS: actual Enter preferences link opens picker. Live and synthetic browser cases. |
| S04 AC3 | Empty recommendations | PASS, **synthetic**: real 200 empty and no-finite-popularity datasets show no-data guidance, Enter preferences and zero fake cards; separate from real 503 error. `s04.acceptance.ts` two AC3 cases. |
| S04 AC4 | Save → refreshed recommendations | PASS: real save → fresh personalised result; true no-match alternative path also passes. A held real pre-save response cannot restore old state. `s04.acceptance.ts` delayed cold-start case, [live](live/results.json). |
| [S12 #44](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/44) AC1 | `/` → Sign in → Create an account → `/register` | PASS: visible registration creates exactly one user (201), redirects to `/login`. Live runner and `test_registration*.py`. |
| S12 AC2 | Duplicate registration | PASS: same email uppercased → 409, exactly `This email is already registered`; user count unchanged. [Live messages](live/results.json). |
| S12 AC3 | Invalid registration fields | PASS: invalid email/short password identify both fields; user count unchanged. [Live validation](live/live-registration-validation.png); API validation/concurrency cases rerun in full backend suite. |
| S12 AC4 | Registration API/database | PASS: committed value has Argon2id prefix; public user DTO contains only `id`/`email`. No hash/password is retained in evidence. [Live boolean](live/results.json), password and registration verification suites. |
| [S13 #45](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/45) AC1 | `/` → Sign in → `/recommendations` | PASS: real login/session and current-account recommendation response; cookie flags/session resolver tested. [S13 live](checks/s13-live.txt), `s13.acceptance.ts`, `test_auth_sessions.py`. |
| S13 AC2 | Login `/login` | PASS: unknown email and incorrect password both return 401 and show exactly `Email or password is incorrect`; no cookie issued. Existing S13 AC2 browser case rerun, plus auth API test. |
| S13 AC3 | Guest Start, protected routes, detail rating CTA | PASS: live guest detail/rating login with zero private requests; synthetic guest routes and CTA compare committed DB before/after. Missing/expired/revoked sessions rejected for every private read/write. |
| S13 AC4 | Recommendations Sign out → `/` → Start | PASS: 204, cookie cleared, old-cookie replay 401, home shown, later Start/protected preferences → login without private calls. Existing S13 browser and actual-restart HTTP cases. |
| S13 AC5 | A/B picker, rating, recommendations; reset API | PASS: B sees no A state, B recommendations use B genres, delayed A response cannot overwrite B, relogin restores A. Live S13 restores A rating/preferences; synthetic browser checks delayed A; forged identifiers/reset/restart use committed DB evidence below. |

## Security, persistence and ownership

These existing tests all passed again in the 417-test backend run; no duplicate
security suite was created. Reset is an **API feature**; no reset UI is claimed.

| Case | Reused executable evidence |
|---|---|
| Missing/expired/revoked session, no private access | `test_auth_acceptance.py::test_invalid_sessions_reject_every_private_read_and_write` (3 variants); preference/rating/reset suites |
| Logout replay, relogin, actual process restart on same DB | `test_logout_cookie_replay_relogin_and_actual_backend_restart` terminates and starts uvicorn without reseeding; saved preferences/ratings and session revocation persist |
| A/B preferences, ratings and recommendation ownership | `test_independent_sessions_ignore_forged_identity_and_reset_only_owner`; T32 `test_two_independent_sessions_do_not_share_ratings`; S13 browser account-switch case |
| Forged `userId`, `user_id`, `accountId`, query/header/body identities | Same HTTP case; `test_ratings_api_verification.py::test_forged_identifiers_cannot_read_or_update_other_account`; preference/recommendation/reset strict-body and ownership tests |
| Reset A preserves B, invalid confirmation, forbidden origin | `test_reset_confirmation_origin_and_real_delete_failure_preserve_both_accounts`; `test_profile_reset_api.py` strict confirmation/origin cases |
| Reset failure between deletes and at commit | HTTP SQLite trigger forces rating delete failure after preference delete; full pre/post snapshots equal. T35 additionally checks commit rollback and safe 503. |
| Delayed A rating/movie and revoked/expired widget recovery | Reuse [T34](../s3-t34-rating-acceptance/README.md); current-SHA hosted `browser-rating-acceptance` passed. Current frontend suite also passes relevant stale-response tests. |

Sprint 3 recommendations use **genre + popularity only**. Saved ratings survive
relogin/restart and are protected, but do not change ranking. Rating-adjusted
ranking remains [Sprint 4 #22](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/22).

## Routes, visible navigation and Story status

| Route / screen | First-screen visible entry / return | Story |
|---|---|---|
| `/` discovery | Initial screen; Browse the catalogue / Return to catalogue | S01, S04; guest S03/S09 entry |
| `/register` registration | `/` → Sign in → Create an account | S12 |
| `/login` authentication | `/` → Sign in or Start; guest rating CTA | S13; S12 completion |
| `/preferences` genre picker | Signed-in `/` → Start; recommendations → Enter preferences / Change my genres | S01, S02/S04 transition; S13 protection |
| `/recommendations` list | Successful sign-in; Save preferences; `/` → My recommendations | S02, S04; S06 filter; S13 sign-out |
| `/movies/:movieId` detail | Catalogue/popular/recommendation card → View details; context-aware return link | S03; S13 rating protection |
| `/popular` popular list | `/` → Popular movies; detail → Back to popular movies | S09 (P1) |
| `/profile` protected placeholder | Guard checked directly as a separate route-protection test | S13 guard support only; no profile/reset UI acceptance |

| P0 Story | Screen(s) | Route(s) | Status | Issue |
|---|---|---|---|---|
| S01 | Home, picker, recommendations | `/`, `/preferences`, `/recommendations` | partly works | [#17](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/17) |
| S02 | Recommendations, picker, details | `/recommendations`, `/preferences`, `/movies/:movieId` | partly works | [#18](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/18) |
| S03 | Catalogue/list, details | `/`, `/popular`, `/recommendations`, `/movies/:movieId` | partly works | [#19](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/19) |
| S04 | Cold-start list, picker | `/`, `/recommendations`, `/preferences` | partly works | [#20](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/20) |
| S12 | Registration, login | `/register`, `/login` | partly works | [#44](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/44) |
| S13 | Login, signed-in lists, private controls | `/login`, `/recommendations`, `/preferences`, `/movies/:movieId` | partly works | [#45](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/45) |

**P1 results remain outside the six-P0 gate:**

| Story | Actual verification | Status / remaining gate |
|---|---|---|
| [S06 #23](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/23) | Existing T16 2 Action/3 Comedy, empty filter/reset, unchanged-account-preference assertions pass in full React/backend suites; cross-runtime real API/DB test 1 passed. Reuse [T16 evidence](../s3-t16-filter-verification.md). | partly works — independent final handoff/DoD pending; no claim the Vitest bridge is a real browser |
| [S09 #31](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/31) | Live first-screen popular list equals DB top-ten oracle. T21 synthetic Chrome verifier: 10 highest-ranked, 95 before 80, no-data exact message, zero cards. [T21 rerun](checks/t21.txt). | partly works — independent final handoff/DoD pending |

GitHub read-only snapshot on verification date: #17–#20, #23, #31 are open;
#44 and #45 were **already closed** before this work. Their existing closure is
not new acceptance approval. Record this discrepancy for the PO/reviewer; this
work did not close or reopen issues. The final handoff does not authorize closing
any further Story while its gates remain incomplete.

## Exact messages, errors and states for #136

| API code / rule | Exact observed text / action | Evidence mode |
|---|---|---|
| `EMAIL_ALREADY_REGISTERED` / BR16 | `This email is already registered` | Live UI; case-duplicate 409 |
| `INVALID_CREDENTIALS` / BR19 | `Email or password is incorrect` for both unknown email and wrong password | Synthetic real-browser/real API; S13 AC2 |
| `MOVIE_NOT_FOUND` / detail rule BR6 | `Movie not found`; Return to catalogue | Synthetic browser negative route + backend API |
| `SERVICE_UNAVAILABLE` / BR8 persistence | `Recommendations are unavailable`; `Service is temporarily unavailable Choose Retry to load your recommendations again.`; Retry | Synthetic actual SQL 503 and recovery; captured alert/assertion |
| No API error / S03 missing field | `Information unavailable` for each null field | Synthetic browser; live snapshot has no null year/overview |
| No API error / S09 empty | `Popular movies are not available yet` | T21 real browser, synthetic no-popularity DB |
| Client validation / BR1 | `Select at least one genre (up to 5), then choose Save preferences.` | Live 375px screenshot; no save; committed values preserved in T22 |
| Client validation / BR1 | `You can select up to 5 genres. Your previous 5 selections are still selected. Clear one genre to choose a different one.` | Live T22 sixth-choice rejection; first five preserved |
| Client validation / BR17 | `Enter a valid email address`; `Password must be at least 8 characters` | Live UI; no account created |
| Successful no-match / BR4 | `No movies matched your favourite genres.`; Edit preferences / Retry | Synthetic real API/browser; a successful empty is not an API error |

Recommendation **data** and cold-start are observed live. **Loading**, successful
**empty**, real SQL **error**, recovered **data**, and delayed stale-response
states are separately covered by the existing S04 browser harness. A 503 never
appears as successful empty/no-match. The test harness delays genuine server
responses and alters only its temporary DB; feature responses are not mocked.

Current-candidate captures: [loading](synthetic/recommendation-loading.png),
[successful empty](synthetic/recommendation-empty.png),
[SQL error](synthetic/recommendation-error.png),
[live personalised data](live/live-personalised-mobile.png). The
[captured actual SQL-error alert](synthetic/actual-error-message.txt) includes
the user-facing message and Retry action.

T24 reuse: [merged PR #173](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/173)
documents keyboard/mobile/recovery steps and the usability fixes; its 11 focused
tests pass in the current frontend suite. Its historical manual setup example
uses M2 seed and is **not** live M3 provenance. New live evidence supplies actual
Tab traversal, Space checkbox toggle, Tab to Save, Enter save, nonzero focus
outline (observed `1px`) and no horizontal overflow at 375px. T22 supplies a real
blocked-request failure with retained draft, unchanged committed values and a
successful visible Save retry. No production router was edited.

## Reproduce from the first screen

Use [README](../../../README.md), [setup](../../SETUP.md), and
[TMDb runbook](../../tmdb-sprint3-runbook.md). Keep ports 8000/5173 free for the
live runner/T12/T21/T22 and 8014/5174 free for Playwright. Install Chromium once
with `npx --prefix frontend playwright install chromium`.

```sh
git rev-parse HEAD
git status
# Existing accepted DB: verify safe provenance first; do not seed or reimport it.
node frontend/scripts/verify-m3-handoff.mjs data/app.db frontend/test-results/m3-live

# Verifier regression tests (newline checks, process trees, cleanup/report failures).
npm --prefix frontend run test:m3:verifier

# Reuse S13 on a disposable backup of that accepted DB. Absolute path required.
S13_TMDB_SMOKE=1 S13_TMDB_DATABASE="$PWD/data/app.db" TMDB_READ_ACCESS_TOKEN='' \
  npm --prefix frontend run test:s04:e2e -- s13.acceptance.ts --grep 'live TMDb'

# Separate synthetic real-stack browser/security/regression evidence.
TMDB_READ_ACCESS_TOKEN='' npm --prefix frontend run test:s04:e2e
TMDB_READ_ACCESS_TOKEN='' .venv/bin/python -m pytest backend/tests -v
.venv/bin/python -m ruff check backend
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix frontend run test:s04:runner
TMDB_READ_ACCESS_TOKEN='' npm --prefix frontend run test:t16:integration
```

The verifier normalizes CRLF to LF when comparing application files with Git;
other byte changes still fail verification. It stops server process trees before
removing the temporary database and retries transient removal errors up to ten
times. `results.json` includes a separate `cleanup` result and errors even if
cleanup fails; journey failures and completed checks are preserved. Either a
journey or cleanup failure produces exit code 1. The regression suite includes
a real Windows deletion-lock test, which is skipped on other platforms.

Manual live replay (use disposable accounts in a copy of the accepted DB):

1. Open only `/`. Select Popular movies, open a visible movie, verify title/year/
   genres/overview and return to popular. Open details again and select Sign in
   to rate: login opens, no `/api/me/*` request occurs while signed out.
2. Select Create an account. Submit invalid email/short password: two corrective
   field messages, no user row. Register valid values: 201, login opens. Revisit
   registration and try the same email uppercased: exact duplicate message, no
   additional row. Use a local DB query to verify the stored hash **without
   displaying its value** and check the response contains only public user data.
3. From login submit unknown email and then incorrect password. Both show the
   same exact required message. Sign in correctly: session and recommendations.
4. New account: check ≤10 distinct non-personalised popular movies and guidance.
   Select Enter preferences. Press Save with zero checked: corrective BR1 text,
   remain on picker. Check one, save, observe PUT 200 followed by fresh GET and
   matching cards/reasons (or genuine no-match). Open details, return through its
   link, revisit picker: choice preserved. Repeat with five; sixth is rejected.
5. At 375px, Tab through picker, use Space to select and Enter to save. Verify
   visible focus, readable corrective text and no horizontal overflow. For save
   recovery use T22's controlled blocked request, not destructive catalogue
   changes in a shared database.
6. Sign out via the visible button. Home opens; later Start opens login. Sign in
   as B: no A preferences/rating/recommendations. Sign out and relogin A: A's saved
   data restored. Use the existing S13 HTTP tests for cookie replay, process
   restart, forged identifiers/reset; never put cookies/passwords into evidence.
7. Run synthetic browser cases for missing fields, invalid detail URL, exact
   rank/tie fixtures, empty/error/recovery, delayed A and delayed pre-save results.
   Do not manufacture these states in the accepted database.

The existing T22 command was run against a separately backed-up/migrated
`/tmp/m3-handoff-86a758e/t22-copy.db`, with `--database`, `--evidence-dir` and
`--browser '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'`.
T12/T21 used their existing `--evidence-dir`/`--browser` options and synthetic
temporary databases. Exact commands/outcomes are indexed in
[verification.json](verification.json).

## Commands and actual outcomes

| Verification actually run | Outcome |
|---|---|
| `python -m alembic -c backend/alembic.ini upgrade head` | Exit 0 on accepted-snapshot copies and fresh clone; head `c6f8a2d4e901` |
| `python -m app.cli.import_tmdb_catalogue` in fresh clone | Exit 0; safe provenance above; never ran importer on accepted source |
| `.venv/bin/python -m pytest backend/tests -v` | 417 passed, 1 inherited skip, existing Starlette warning; same after clean-clone migration |
| `.venv/bin/python -m ruff check backend` | Passed, including changed harness |
| `npm --prefix frontend test` | 236 passed / 20 files, including T18/T24; same in fresh clone |
| `npm --prefix frontend run lint` / `run build` | Both passed locally and in fresh clone |
| `npm --prefix frontend run test:s04:e2e` | 10 passed, 1 intentionally opt-in live skip; includes new fallback/not-found/actual-error assertions |
| S13 accepted-snapshot live command above | 1 passed; separate live mode; no token/import needed |
| `node frontend/scripts/verify-m3-handoff.mjs ...` | Five grouped seam checks passed on existing snapshot and fresh clone |
| Existing `verify_s01_preferences_ui.py`, `verify_s02_recommendations_ui.py`, `verify_s09_popular_ui.py` | All PASS; live T22, synthetic T12/T21 |
| `npm --prefix frontend run test:t16:integration` | 1 passed; real API/DB bridge, not browser |
| `npm --prefix frontend run test:s04:runner` | 3 passed; owned-temp cleanup including startup/failure scenarios |
| `git diff --check` and sensitive-artifact check | See verification record; no secret/DB artifacts intended for commit |

Failures are not hidden: initial sandbox run had 411 passes/1 skip/6 HTTP setup
errors and browser bind failure because loopback was forbidden; unrestricted
reruns passed. Chromium was initially absent and was installed. Fresh Python
installs initially failed under sandbox DNS; permitted network installs passed.
A premature clean-clone backend run before migration had 416 passes/1 skip/1
health failure; the documented migrate-first rerun passed 417/1. Early new-runner
attempts exposed verifier bugs (missing API base URL; filling fields before SPA
route completion); these were corrected, with no application change. No Story
PASS relies on those failed attempts. The inherited skipped backend test is the
old M2 `test_rating_write_requires_the_signed_in_account`; implemented rating
protection is exercised by current T32/T34/T23 tests and hosted checks.

## Reused merged evidence and actual review/CI

| Dependency | Reused evidence / merged PR |
|---|---|
| T12 #114 | [S02 evidence](../s3-t12-recommendations-acceptance/README.md), [PR #169](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/169) |
| T14 #116 | [S04 evidence](../s3-t14-cold-start-acceptance/README.md), [PR #176](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/176) |
| T16 #118 | [Filter evidence](../s3-t16-filter-verification.md), [PR #167](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/167) |
| T18 #120 | `movie-detail-acceptance.test.tsx`, `test_auth_catalogue_handoff.py`; [PR #172](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/172) |
| T21 #123 | [Popular evidence](../s3-t21-popular-acceptance/README.md), [PR #155](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/155) |
| T22 #124 | [Preference evidence](../s3-t22-preferences-acceptance/README.md), [PR #174](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/174) |
| T23 #125 | [Five-AC evidence](../s3-t23-authentication/README.md), [PR #178](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/178) |
| T24 #126 | [PR #173](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/173), `preference-usability.test.tsx`; current live mobile/keyboard and T22 recovery supplement historical evidence |
| T29 #128 | [Import/provenance evidence](../t29-tmdb-live-smoke.md), [PR #150](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/150); fresh-clone runbook smoke above |
| C04 #135 | [Setup](../../SETUP.md); task still open; local fresh-clone results above do not claim independent C04 acceptance |
| T32/T34/T35 | [Rating acceptance](../s3-t34-rating-acceptance/README.md), [reset evidence](../s3-t35-profile-reset.md), existing backend suites |
| Shipped backdrop foundation | [T28 evidence](../s3-t28-backdrop-acceptance/README.md), [PR #183](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/183); final head migration exercised |

Public GitHub API was read; no remote issue/comment/PR was changed. All **11**
check runs on the exact candidate returned `completed/success`, including
[Python/Node/secret CI](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/39051704039),
[S04 browser and Linux/Windows cleanup](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/39051704079),
[filter integration](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/39051704128),
[browser rating](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/39051704248),
[rating integration](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/39051703968)
and [backdrop acceptance](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/39051703997).
This is verified candidate CI, **not CI for these uncommitted handoff changes**.

Review history actually observed: T24 approved by
[NguyenTuanAnh0608](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/173#pullrequestreview-5516676208)
and [hoang3003](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/173#pullrequestreview-5516739333);
T23 approved by
[kietxuan](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/178#pullrequestreview-5552264684)
and [hoang3003](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/178#pullrequestreview-5553320786);
final-candidate PR #183 approved by
[hoang3003](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/183#pullrequestreview-5558919091).
These approvals are for those PRs, not this new handoff.

## Outstanding gates and owner handoff

- **#127 acceptance:** publish these acceptance changes, record the resulting
  commit, run hosted checks, obtain substantive independent teammate review and
  approval, resolve feedback, merge. Recheck changed executable evidence on that
  commit. No reviewed handoff PR exists for this local diff yet.
- **#135 C04:** independently confirm clean-clone results, instructor credential
  provisioning, disposable-account procedure and final Tested-by record in
  setup. README's old expected migration head is stale (`b7e4c2d91f30` versus
  actual `c6f8a2d4e901`); document/setup correction belongs to C04, not a silent
  feature change here.
- **#136 dossier:** consume the tables, screenshots and linked records here;
  place selected dossier images in its required `docs/images/ui/` directory;
  complete its wireframes/design update and independent review, merge, then
  export PDF. Headless screenshots here contain the page viewport, **not a
  browser address bar**; #136 explicitly needs address-bar captures for its
  submission page. PDF/export/LMS receipt are not claimed by this acceptance task.
- Preserve open incomplete Stories. Ask the PO to reconcile already-closed
  #44/#45 against this final DoD audit. No Story may newly be closed from this
  handoff until the missing gates pass.

Ready for #136: six-P0 and separate P1 status tables, complete AC matrix, route
map, exact error/validation text, reproducible steps, safe live provenance,
synthetic/live separation, current-candidate results and verified prerequisite
review links. Final independent handoff approval and merge remain pending.
