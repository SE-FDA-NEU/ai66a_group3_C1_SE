# S3-T23 — S13 authentication and account-isolation acceptance

Existing task [#125](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/125),
unchanged Story [#45](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/45),
and M3 handoff [#127](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/127).
This brings the deferred S4-T21 verification into #125; no second task is needed.

Dependencies: preference verification [#105](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/105),
recommendations [#114](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/114),
cold start [#116](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/116),
[T32 #140](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/140),
[T34 #141](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/141),
[T35 #142](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/142).
See [rating UI evidence](../s3-t34-rating-acceptance/README.md) and
[reset confirmation/origin/rollback evidence](../s3-t35-profile-reset.md).

## Result and closure gate

Local functional verification of all five AC passed on 2026-10-16, Asia/Ho_Chi_Minh.
Story status for #127: **partly works**. Keep #45 and #125 open until the final
committed candidate, independent approval, merge and remaining Story DoD are verified.

Base commit: `2bf6d36b566a1b97a1eec7353be72790d218c9e5`, with uncommitted acceptance
changes. [evidence.json](evidence.json) records commands, actual outcomes, test
names, browser/API/committed database observations, runtime versions, working-tree
state and per-file source hashes. This base SHA does not contain the new tests.
Final clean tested SHA, hosted CI URL, independent approval and merged PR: **pending**.
The assigned #125 reviewer is `@anotify-vie`; approval must come from someone who
did not author the acceptance changes. Do not treat this local report as approval.

## Five-AC acceptance matrix

Browser tests: [s13.acceptance.ts](../../../frontend/e2e/s13.acceptance.ts).
HTTP/database tests: [test_auth_acceptance.py](../../../backend/tests/test_auth_acceptance.py).
All requests use the real FastAPI routes, session resolver and repositories.

| Unchanged #45 AC | Expected behaviour | Actual browser/API/database evidence |
|---|---|---|
| AC1 | Correct registered credentials create a session and open `/recommendations`. | Browser starts at `/`, clicks Sign in, submits credentials; login, `/api/auth/me` and recommendations are 200. Real cards render. The API suite registers and logs in separate clients against a migrated database. **PASS**. |
| AC2 | Unknown email and incorrect password show exactly `Email or password is incorrect`. | Both real login calls return 401; browser asserts the exact alert, stays on `/login`, and receives no session cookie. [Actual alert](invalid-credentials.png). Existing auth API tests also assert the identical message/code. **PASS**. |
| AC3 | Signed-out preferences/rating actions open `/login` without private reads/writes. | Direct guarded-route checks include preferences, recommendations and profile. Public details → Sign in to rate opens login. Browser records zero `/api/me/*` requests and unchanged committed rows. Missing/expired/revoked HTTP clients receive 401 for every private read/write, with unchanged DB snapshots. **PASS**. |
| AC4 | Sign out revokes the current session, opens `/`, and later preferences open `/login`. | Browser clicks Sign out (204), observes home and cookie removal; an independent client replaying the old cookie gets 401. Home → Start opens login without private API calls. DB rows survive. A new backend process also rejects the revoked cookie. **PASS**. |
| AC5 | B cannot view, update, reset or receive recommendations from A's personalisation. | Same-browser B has no checked A genre or saved A rating; B's Comedy cards exclude A's Action-only movies. Releasing A's held real recommendation response leaves B's cards/identity unchanged. Separate HTTP sessions ignore forged query/header identities; B cannot target A's reset. Confirmed A reset removes only A's preferences/ratings and preserves B. A relogin restores A's saved 5/5 before reset. [Restored A UI](account-relogin.png). **PASS**. |

## Security, persistence and scope

The six new HTTP integration cases use a migrated temporary file-backed SQLite
DB and a real uvicorn subprocess, with fresh SQLite reads of committed rows.
They verify independent sessions, forged `userId`/`user_id`/`accountId` and
`X-User-Id`, missing/expired/revoked sessions, cookie replay, reset ownership,
invalid confirmation, forbidden origins and persistence across logout/relogin.

For reset rollback, a SQLite `BEFORE DELETE` trigger aborts deletion of ratings
after preferences have been deleted inside the transaction. The real HTTP call
returns 503, exposes no injected DB detail, and both accounts' full preference
and rating snapshots remain unchanged. The existing T35 suite additionally
covers malformed confirmation, forbidden fetch metadata and commit failure.

The restart case terminates uvicorn, waits for it to exit, starts a new process
against the **same** SQLite file without reseeding, then reads saved genres,
ratings and recommendations using the existing session and after relogin.
Revoked cookies remain rejected after restart. No production defect was observed;
any later failure belongs to the implementation owner rather than an auth rewrite.

Sprint 3 recommendations use the accepted genre/popularity baseline. A saves
ratings and still gets the same recommendation order. Rating storage/protection
is covered here; rating-adjusted ranking remains [Sprint 4 #22](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/22).
The reset endpoint is tested through API; this does not claim a profile/reset UI.

## Reproduce and distinguish the evidence

From the repository root, install the locked dependencies and Playwright Chromium
as described in `docs/SETUP.md`. Ports 8014/5174 must be free for browser tests;
HTTP tests choose a free loopback port. All databases are disposable and removed.
Neither runner uses the configured developer database.

```sh
# Synthetic catalogue, real UI/HTTP/session/database; no provider token required.
npm --prefix frontend run test:s04:e2e
PYTHONPATH=backend .venv/bin/python -m pytest \
  backend/tests/test_auth_acceptance.py backend/tests/test_auth_sessions.py \
  backend/tests/test_preferences_api.py backend/tests/test_ratings_api_verification.py \
  backend/tests/test_profile_reset_api.py backend/tests/test_personalised_recommendations_api.py -q

# Separate live environment smoke: fresh one-page TMDb import into a temporary DB.
# Set the server-only token in root .env or the server environment.
S13_TMDB_SMOKE=1 npm --prefix frontend run test:s04:e2e -- s13.acceptance.ts --grep 'live TMDb'
```

On Windows use `.venv\Scripts\python.exe`, `npm.cmd`, and set environment variables
with `$env:NAME='value'`. The existing S04 workflow discovers the new browser
journeys; ordinary backend CI discovers the new HTTP tests. Live smoke is opt-in
and is not silently replaced by synthetic data when import fails.

Recorded results: synthetic browser **10 passed**, with the live-only test
intentionally skipped; separate live smoke **1 passed**; focused API/database
**143 passed** (including the six new HTTP cases); full backend **379 passed,
1 inherited skip**; frontend **222 passed**. ESLint, Ruff, production build and
`git diff --check` passed. The backend warning is the existing Starlette TestClient
deprecation. Commands and individual test outcomes are in `evidence.json`. Synthetic browser assertions and security
fault injection are automated acceptance evidence; the existing Vitest mock tests
are supporting regression evidence only. Live smoke separately imports real TMDb
data, then follows `/` → Start → login → preferences → recommendations → details
→ save rating → logout → B → logout → A, checking restored preferences/ratings
and unchanged genre/popularity ranking. [Live browser capture](tmdb-browser.png).
The first live attempt failed with a provider connection error before browser
startup; the subsequent run succeeded. No token, password, session cookie,
session digest, `.env` contents or database file is included in the evidence.
