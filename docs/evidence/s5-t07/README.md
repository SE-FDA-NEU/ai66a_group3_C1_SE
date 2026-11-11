# S5-T07 public acceptance and M5 demo

[T07 #254](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/254), PR [#265](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/265). Updated **11 November 2026**, Asia/Saigon. The PO amended T07 to deliver acceptance tooling, actual technical evidence and the final execution checklist; **C02 #256 now owns all unexecuted public/device/demo/PO acceptance**. PR #265 may close #254 only after green checks, substantive independent formal approval and merge. Neither that closure nor the checks below certify final M5 acceptance. The application source remains main `50aa9ad4fccc63f5d7ef8186bb296ed12f0d18ee`; this PR changes acceptance tooling/evidence, not application behaviour. The JSON source-commit field identifies the checkout used for a run; [script hashes](current-local-environment.json) identify the tested verifier bytes before their commit.

## Current result and release blocker

| Target/check | Actual result | Evidence |
| --- | --- | --- |
| Isolated local PostgreSQL 18.1, production frontend bundle | Restored **989 actual TMDb movies** from the private T06 Neon archive, not a two-movie demo. Head `d9a6f2c1e508`; original Neon/public data not used for local writes | [Environment/archive digest](current-local-environment.json), [local probe](local-current-probe.json) |
| Read-only local browser/API checks | **14/14 pass**: Home, two themes, Z–A/page/return, submit-only Search/all-result pagination, real poster, trailer dialog, Similar, US/GB/SG DTO/UI/link/groups, default/storage/reload and mobile emulation | [Desktop](local-current-detail-desktop.png), [390px emulation](local-current-detail-mobile-emulated.png) |
| Public read-only probe | **7 pass / 7 fail**. `/health` is 200 for the old runtime, with head `a3d1f8b72c44`. The required current schema/API/selector are absent; unsupported `VN` is still ignored instead of refused | [Public JSON](public-current-probe.json), [public Details](public-current-detail-desktop.png) |
| Existing public features | Home sort/page/return, Search, Similar and trailer embed opening pass. Search `the`: **329 matches**, 10 on pages 1/2, no duplicate IDs; no total-results cap of 10 | Same public JSON. Video playback itself was not asserted; YouTube/video/network restrictions are external |
| Account UI journeys, local **and public** | **8/8 pass** using two reusable synthetic accounts per target: create/login, real duplicate HTTP **409** + actionable UI, preferences, 4.5 rating, reload/later login, ranking metadata, filtering/paging/return, A/B isolation, cancel/reset-keeps-Watchlist and removal | [Local](current-local-accounts.json), [public](current-public-accounts.json) |
| Recommendation filtering on both targets | 353 eligible results; Comedy filter 47 results/5 pages, correct genre membership, preferences unchanged; Details returns to retained page/filter | Account JSON above |
| Render identity/access at the original probe | Connector originally exposed workspace `abc` with a group-04 service; browser-control initialization failed (`kernel assets`, OS error 3). After reconnection, T08 verified correct **My Workspace**, CineAI service `srv-dbp96kp42hec73bv94j0`, live SHA `f24ef54699efb2fa26f363107bd31401f9b12e58`. The regional candidate is still not deployed | [Authenticated T08 follow-up, PR #264](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/264). No deploy, migration or service configuration change is claimed |
| Physical phone, team rehearsal, PO acceptance | **Pending.** User confirmed no rehearsal or PO acceptance yet; no physical phone is connected to the agent | [Completion checklist](completion-checklist.md) |

A 200 health response validates the old running code/database pair; it does not prove that the new regional release is deployed. Do not downgrade or change the expected head just to make this gate green.

The public account probe now uses a **fresh browser context** for duplicate registration, waits for the actual POST response, checks 409/error code/UI and retains reusable credentials only in a git-ignored file. This resolves the previous probe's inconclusive `Email is required` result; no server duplicate-email defect was established. The successful repeat reused the same accounts (409 registration), saved rating via HTTP 200, then removed its own Watchlist item after verifying reset preservation. Other users' accounts/data were untouched.

## Focused test evidence

| Check | Result |
| --- | --- |
| `python -m pytest -q` | **40 passed**, compact P0 suite; one dependency deprecation warning |
| T01 PostgreSQL 18 + T06 native recovery | **17 passed, zero skipped**, authenticated isolated loopback databases; server 18.1 |
| Nine affected frontend suites listed below | **128 passed** |
| T07 verifier contract | **18 passed**; rejects old/failed health, wrong movie/country/link/groups, missing selector, unsafe new-tab action and missing stale warning; accepts legitimate no-data/null link and numeric-ID-plus-slug URLs |
| ESLint, TypeScript and production build | Pass |
| Local S01 rule mutation | **Red exit 1 → restored-green exit 0**, exact bytes restored; [red](mutation-red.txt), [green](mutation-restored-green.txt), [digest/result](mutation.json) |
| Earlier two Windows symlink setup failures | Not relabelled as local passes. Linux CI [42997436169](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/42997436169), step `Verify production serving, health and sessions offline`, passed its production-serving selection containing both cases. This PR's CI reruns that selection |

The P0 [case map](../../testing.md#2-test-cases-for-every-p0-story) is reused; `testing.md` is not expanded with unrelated suites. The mutation is `PreferenceRequest` maximum 5 → 6 and `TC-P0-S01-007`: six genres incorrectly return 200, the test fails expecting 400, and the restored source passes. The runner always restores in `finally`. Never run a mutation on a deployed service.

The read-only probe collects named pass/fail checks and exits nonzero on **any** failed check. API/UI observations must agree on the same movie and country; a nullable link is allowed, but a displayed link requires a trusted numeric TMDb source ID, correct locale, safe origin/path and new-tab rel. An observed popup preserves the original route. Source-map samples come from the isolated archive's `catalog_movies.source_id`, not from the URL being tested. Refresh [movie-sources.json](movie-sources.json) for another catalogue rather than trusting these database-specific opaque IDs.

## Run from repository root

Install dependencies using [SETUP](../../SETUP.md). The browser probes use installed Microsoft Edge and `frontend/node_modules/@playwright/test`. PostgreSQL tests follow the authenticated disposable-target instructions in SETUP/T06; local restore databases on Windows must be **UTF8** (e.g. template0, encoding UTF8, C collation/ctype), not default WIN1252. The initial local restore failed on a multilingual TMDb title under WIN1252; the UTF8 restore succeeded. No dump, password or database URL is committed.

```powershell
.\.venv\Scripts\python.exe -m pytest -q
node --test frontend/scripts/s5-t07-contract.node-test.mjs
.\.venv\Scripts\python.exe scripts/verify_s5_t07_mutation.py
npm.cmd --prefix frontend test -- src/tests/movie-watch-providers.test.tsx src/tests/movie-detail-acceptance.test.tsx src/tests/movie-detail-rating.test.tsx src/tests/movie-detail-return.test.tsx src/tests/movie-backdrop.test.tsx src/tests/auth-catalogue-handoff.test.tsx src/tests/movie-trailer.test.tsx src/tests/watchlist.test.tsx src/tests/list-context-invalidation.test.tsx
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run build
```

Read-only public probe (currently expected to exit **1** because the candidate is not deployed):

```powershell
$env:S5_T07_PUBLIC_URL = 'https://cineai-o9tf.onrender.com'
$env:S5_T07_PROBE_LABEL = 'public-current'
node frontend/scripts/s5-t07-public-probe.mjs
```

Output defaults to ignored `.venv/t07ops/results`, so a repeat does not overwrite committed historical evidence. `S5_T07_OUTPUT_DIR` overrides it. The expected head is derived from the source Alembic chain; an intentional override uses `S5_T07_EXPECTED_HEAD` and must match the reviewed candidate. `S5_T07_MOVIES_FILE` can supply another trusted `{ "movies": [{ "id": "opaque DB id", "sourceId": "numeric TMDb id" }] }` map. If selecting `S5_T07_MOVIE_ID`, select a movie reachable on Home's first page; otherwise discovery uses its first visible movie.

Opt-in account probe **writes only its two synthetic app accounts**, including reset/removal. Use an ignored private file; never use a member's or instructor's account. On first use, enable account creation once; later runs reuse the same file and do not create more users:

```powershell
$env:S5_T07_ALLOW_PUBLIC_WRITES = '1'
$env:S5_T07_ACCOUNTS_FILE = '.venv/t07ops/public-accounts.private.json'
$env:S5_T07_CREATE_ACCOUNTS = '1' # first use only
node frontend/scripts/s5-t07-public-accounts.mjs
Remove-Item Env:S5_T07_CREATE_ACCOUNTS
```

For an already running isolated local app, set `S5_T07_PUBLIC_URL=http://127.0.0.1:8507`, `S5_T07_PROBE_LABEL=local-current` and a **different** ignored accounts file. Local server preparation/private archives are not deliverables in Git. These probes are diagnostics, not final public/M5 acceptance. The historical output field `fullIssueAcceptance` stays false; the scope amendment does not rewrite any recorded result. C02 executes the separate checklist and records deployed identity and human decisions.

## Final acceptance handed to C02 #256

On 11 November the PO requested closure of T07/T08 at their reviewed delivery
merges and completion of the Sprint under C02. The following requirements are
preserved, assigned to C02 and remain **Pending**, rather than being waived or
reported as passed. T07 owner Nguyễn Tuấn Anh assists SM5 with execution.

- Deploy the reviewed **green main** candidate with the regional migration/import through the actual CineAI operators. Record Render deployed SHA and matching CI/head; do not infer SHA from schema alone. Back up first and coordinate migration/deployment because old code requires its own exact head. Re-run the public probe and affected journeys against the new candidate.
- Reuse [T03](../../s5-t03-deployment.md), [T05](../s5-t05-regional-ui.md) and [T06](../s5-t06-recovery/README.md). The isolated 17-case recovery/integration pass does not replace T06's pending durable backup/operator access/independent reproduction. Confirm the operational handoff, then reproduce affected checks without destructive production rehearsal.
- [Physical-phone, candidate acceptance and timed-demo checklist](completion-checklist.md): record real devices/browsers/dates, all six public P0 journeys, regional/media/context checks and remaining human decisions. Emulation is clearly labelled.
- Link null, invalid, stale, missing-provider, invalid storage/logo and race cases reuse [T05's 42-case suite](../s5-t05-regional-ui.md#automated-verification) and labelled fixtures. Current real US/GB/SG API/UI/popup checks pass locally; they remain blocked on public. Do not require all real movies to have providers or trailers.
- PO has **not** accepted this candidate. PR #265 exists; an earlier `oke` approval is not substantive acceptance. Kiệt is contributing this completion, so a fresh substantive pre-merge review must come from a non-contributor (coordinator Huy or another eligible member).
- PR #265 uses `Closes #254` for the amended technical/readiness scope. Green checks and a substantive independent pre-merge approval remain mandatory. C02 keeps `Refs #256` until its final public/device/demo/PO, operations, release and submission criteria are fulfilled; no PDF/export tooling enters Git.

## Two authentic M3/current comparisons and demo material

1. [M3 Home](../s3-m3-p0-handoff/latest/live/live-first-screen.png) → [current public Home](public-current-home-desktop.png): button-heavy plain catalogue versus shared navbar, Start/Explore, poster cards and catalogue sorting.
2. [M3 Details](../s3-t28-backdrop-acceptance/live/live-1280.png) → [current local Details with an actual imported TMDb movie](local-current-detail-desktop.png): basic metadata/backdrop versus embedded-trailer control, rating/Watchlist and regional availability. The current screenshot is local, not a claim that regional providers are publicly deployed.

Design choice: the market selector sits next to the groups/action; movie+country identify requests so another region's late response cannot appear under the final label. Lesson: source CI was green while the public DTO/schema was old, so always check both. Risk: a migration ahead of compatible running code makes exact-head health fail; plan a coordinated backed-up rollout and rehearse compatibility. The five-person 1/5/2/2/2-minute allocation is in the checklist and is **not yet rehearsed**.

Historical initial records (`public-probe.json`, `local-probe.json`, `public-accounts.json`, `local-accounts.json` and unprefixed screenshots) remain unchanged. Their local `movie-a`/`movie-b` scenes were explicitly synthetic; current prefixed evidence supersedes those observations using the real restored catalogue.
