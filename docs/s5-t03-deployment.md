# S5-T03 deployment and acceptance

Issue [#250](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/250).
Historical T03 preparation/acceptance is retained below. The 11 November
[operations baseline](operations.md#1-deployment-and-release) now verifies the
public React app at [CineAI](https://cineai-o9tf.onrender.com/), live T03 commit
`f24ef54699efb2fa26f363107bd31401f9b12e58` and the correctly connected Render
service. Regional rollout is deferred by the PO; effective branch protection,
final public acceptance and exact-SHA release remain operator/admin work.

## T02 dependency

The [T02 handoff](s5-t02-neon-provisioning.md) and [recorded Neon acceptance](evidence/s5-t02-neon/README.md) are present in merge `e61989e7e1ba0929a21e3ffb00cdf8c8300be515` (PR #259). They record PostgreSQL 18, separate runtime/development/test databases, migration head `a3d1f8b72c44`, a 989-movie catalogue, account persistence and derived-index recovery. These are earlier operator results, not T03 Render results. Obtain the approved runtime-role connection privately from the T02 operator and confirm its current target/permissions before deployment. If that private handoff cannot be obtained, live verification is **blocked by T02 dependency**.

## Required CI

The existing `CI` workflow runs on pushes, PRs targeting main/develop, and manual dispatch. Its unconditional `PostgreSQL 18 integration` job uses an authenticated `postgres:18` service with a disposable CI-only database/password. It supplies `TEST_POSTGRES_URL`, `TEST_POSTGRES_MAJOR=18`, and `REQUIRE_POSTGRES_TESTS=1`. The existing integration fixture checks the real server major, migrates a unique schema per test and removes that schema afterwards. The root pytest bootstrap keeps the default application engine on a separate temporary SQLite database; integration requests override the DB dependency to use PostgreSQL.

The job runs `python -m pytest -c pytest.ini backend/tests/test_postgresql_t01.py -v --junitxml=postgresql.xml`. It covers empty-schema migrations, constraints, provisioning, rating migration/identity, storage/account isolation, catalogue pagination, transactions and concurrent account writes. Missing configuration fails required integration instead of skipping. A second step requires the four DB test cases in JUnit with no skips/errors/failures. There are no production DB credentials, TMDb credentials or live metadata requests. `sslmode=disable` applies only to this loopback CI service; production retains `verify-full` enforcement.

Existing compact M4 P0, traceability, affected storage/bootstrap checks, backend lint, frontend lint/build and secret checks remain. Offline health/serving/session tests also run automatically. Full frontend and backend regressions retain their existing explicit opt-in scope.

## Render dashboard configuration

There is no repository-managed Render service or deploy workflow. Configure the following in the dashboard; this change does not apply dashboard values. Use the connected GitHub repository integration, rather than a public Git URL, so Render can inspect CI.

| Setting | Value |
| --- | --- |
| Service | Web Service, native Python runtime, **Free** instance, Singapore |
| Repository | `SE-FDA-NEU/ai66a_group3_C1_SE` |
| Branch | `main` |
| Root Directory | Empty (repository root) |
| Auto-Deploy | **After CI Checks Pass** |
| Pull request previews | Disabled for the production service; any separate previews use disposable data |
| Health Check Path | `/health` |
| Build filters | Empty, so required changes always participate |
| Python | Root `.python-version` and dashboard `PYTHON_VERSION=3.12.6` select the tested supported interpreter. The dashboard override has precedence. |
| Node | `NODE_VERSION=24`, matching CI |

Build command:

```sh
python -m pip install -r backend/requirements.lock.txt && python -m pip install -e ./backend --no-deps && npm --prefix frontend ci --include=dev && npm --prefix frontend run build
```

Start command:

```sh
PGSSLROOTCERT="$(python -m certifi)" python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port "$PORT" --workers 1 --proxy-headers --forwarded-allow-ips "$FORWARDED_ALLOW_IPS" --no-access-log
```

Render provides `PORT`. Use one worker initially, keeping the existing per-process DB pool and startup-index behavior. Do not use `--reload`. Both Node/npm and Python are available in Render's [native runtimes](https://render.com/docs/native-runtimes). Render accepts a minor in [`.python-version`](https://render.com/docs/python-version), while a dashboard `PYTHON_VERSION` requires a full released version.

The locked dependencies include `certifi`. The start command resolves its installed CA bundle for this process, providing an explicit certificate file with `verify-full` TLS. Copy the private Render-ready runtime URL supplied by T02. Exclude Windows-only `sslrootcert=C:/...` query parameters, which override `PGSSLROOTCERT`. [certifi usage](https://pypi.org/project/certifi/), [PostgreSQL TLS parameters](https://www.postgresql.org/docs/current/libpq-connect.html)

Free services support dashboard deploys, logs and HTTP health checks. Use Deploy Details to inspect the commit and restart/redeploy from the dashboard. Free services have no Shell, SSH or pre-deploy command. Runtime files are disposable, and idle services can take about a minute to wake. Account data stays in Neon. [Render Free limits](https://render.com/docs/free)

Configure these runtime values privately:

| Variable | Value / handling |
| --- | --- |
| `APP_ENV` | `production` |
| `PYTHON_VERSION` | `3.12.6` |
| `NODE_VERSION` | `24` |
| `SESSION_COOKIE_SECURE` | `true`; production code enforces Secure even if this is accidentally false |
| `DATABASE_URL` | T02 restricted runtime-role `postgresql+psycopg://<user>:<password>@<confirmed-host>/<confirmed-runtime-db>?sslmode=verify-full&connect_timeout=5`; preserve any approved channel-binding parameters |
| `PGSSLROOTCERT` | Resolved by the start command with `python -m certifi`; retain `sslmode=verify-full` in the runtime URL |
| `NLP_INDEX_PATH` | `/tmp/ai66a-overview-tfidf-v1.json` (derived, disposable) |
| `TMDB_NETWORK_DISABLED` | `1` |
| `TMDB_READ_ACCESS_TOKEN` | Empty / unset; import/enrichment stays an explicit T02 operator action |
| `FORWARDED_ALLOW_IPS` | Confirmed Render ingress IPs/CIDRs, comma-separated. If only Render's managed ingress can reach the process and it overwrites forwarded headers, `*` may be used for that boundary after the operator confirms those guarantees. Do not carry that trust setting to a directly accessible server. |

No session signing secret is needed by the existing opaque, database-backed session mechanism. Do not invent one or move session storage to the ephemeral filesystem. Do not print environment values in build/start logs.

Apply migrations with the approved operator role using T02's runbook **before** switching the app to the target. The runtime role cannot perform DDL. Do not add migrations or catalogue imports to the web build/start command. For future schema changes, arrange compatible migration order explicitly with the DB operator.

## Serving, security, health and logs

The existing FastAPI app serves `frontend/dist` and React's current public/protected routes, including `/movies/<movieId>` on a fresh request. Existing frontend relative API calls remain same-origin. Static paths resolve within the build directory; traversal and symlinks outside it cannot expose other files. Missing assets and unknown `/api` routes return JSON errors. A missing build returns 503 for SPA pages. External movie/media links are unchanged.

Production sessions remain Secure, HttpOnly, SameSite=Lax, path `/`, and stored in PostgreSQL. Existing same-origin write checks remain active. Uvicorn accepts forwarded HTTPS only from its configured trusted peers; the app does not interpret arbitrary forwarding headers or enable CORS. Verify login, logout and a write with an `Origin` header and no Fetch Metadata header to exercise the older-browser fallback through the real ingress. [Uvicorn proxy configuration](https://uvicorn.dev/settings/)

`/health` verifies the database migration revisions equal the code's Alembic heads, then probes every mapped application's table/columns with zero-row reads. A matching schema returns the existing `status`, `database` and `migrationVersion` response with 200. Failed DB access, missing/stale revisions or missing table/columns return a safe JSON 503. The next request probes again, allowing recovery without a process restart. No account rows, URLs, SQL, connection details or exception messages are returned. Startup still prepares the existing NLP index before serving requests.

Every request gets a generated `X-Request-ID`; JSON errors use that same ID. The `uvicorn.error` logger records ID, method, route template (or `unmatched`), status and latency. Server failures use ERROR level. Queries, raw paths/IDs, headers, cookies, bodies and exception text/tracebacks are excluded. Unhandled handler failures become a generic 500 at the middleware boundary. Disable Uvicorn's default access log with the command above because it otherwise includes raw URLs. This is basic operational logging; T08 owns monitoring.

Startup preparation failures record only `error_type`, PostgreSQL `sqlstate` and operating-system `errno` before the generic failure. `PermissionError` with `errno=13` identifies a filesystem permission problem. SQLSTATE `42501` identifies insufficient database privileges, and `42P01` identifies a missing table. An `OperationalError` with no SQLSTATE can require checking TLS, DNS, connection settings or network access. Use the private operator connection for diagnosis and keep raw exception/connection text out of shared logs. A `Not Found` response at `/` with healthy API endpoints indicates that the deployed source needs the frontend-serving change. After this change, a missing `frontend/dist/index.html` instead produces a safe 503, so check the frontend build step.

## Main protection and deploy gate

Required flow: `PR → required checks + teammate review → merge main → green main → deploy`.

An administrator must configure an **active** ruleset targeting `refs/heads/main` (or the equivalent branch-protection rule for `main`):

1. Require a pull request before merging and at least **1 approving review from another member**. Dismiss stale approvals when new commits are pushed; require approval of the most recent reviewable push by someone other than its author. Resolve review conversations.
2. Require these exact status-check context names from **GitHub Actions**, as emitted by `.github/workflows/ci.yml`: `Detect stack`, `Python tests`, `PostgreSQL 18 integration`, `Node build and tests`, `No secrets committed`. GitHub's UI may group them under `CI / <name>`; select the actual job contexts from the first run. Preserve any additional existing requirements.
3. Require the branch to be up to date before merging. Block force pushes/deletions and direct pushes. Leave the ruleset bypass list empty, including administrators/apps. For classic protection, enable **Do not allow bypassing the above settings**.
4. Capture the active rule/settings, selected check names/source, a blocked merge with failed checks or no approval, and the teammate approval on the final candidate. Ruleset enforcement is not claimed until an admin captures this evidence. [GitHub protection settings](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)

Render must watch **main only** with **After CI Checks Pass**. PR-only events have no production deploy step in this repository. Do not configure a separate On Commit service, production PR preview, deploy hook or external workflow that bypasses this gate. Restrict production dashboard/manual-deploy access to intended operators. Initial service creation can itself deploy: create/enable it only when the chosen main SHA is already green and reviewed.

Render treats GitHub `neutral` and `skipped` conclusions as passing, so required jobs deliberately run unconditionally and PostgreSQL skips are rejected. Optional individual steps remain scoped. Render's [deploy documentation](https://render.com/docs/deploys) describes this behavior. Branch protection and the actual Render gate must both be checked; repository edits alone cannot prove them enabled.

Gate evidence, using a staging copy of the same service/settings for fault injection:

| Case | Exact operator exercise and evidence |
| --- | --- |
| Failed candidate | Open a disposable PR with an intentional failing required check; capture check failure and blocked merge. Separately, use an isolated staging service watching a disposable test branch with **After CI Checks Pass**: its owner pushes a candidate with an intentionally failing check to that test branch, waits for the red run to finish, and captures the failed source SHA plus unchanged deployed SHA/events. Do not put the failing candidate on main or bypass main's review rules. |
| PR-only | With production source set to main, open/update a passing PR without merging. Capture the PR CI URL, main SHA and unchanged production deploy/events/SHA over the completed CI window. |
| Passing main | An eligible teammate approves; owner merges. Capture merge SHA, green **push-to-main** CI run URL, start/end/duration, then Render's triggered deploy/event and successful health check. A PR merge-ref run is not the main run. |
| SHA identity | Compare the green push-to-main CI run's `head_sha` with the commit in Render Events / Deploy Details, opening its GitHub commit link to obtain the full SHA. Capture both links, full SHA, public URL and timestamp. An authorized Render API/MCP deploy record also supplies the commit ID. These methods work with Free. |

Render documents [`RENDER_GIT_COMMIT`](https://render.com/docs/environment-variables) as the service's commit SHA. If a newer main commit supersedes the candidate, record the newer matching CI/deploy pair rather than claiming the older candidate was deployed.

## Runtime acceptance — Manual/operator verification required

Record the operator, local time/timezone, device/browser, target, full source/deployed SHAs, public Render URL, CI URL/duration and redacted results for every row. Never place credentials, cookie values, environment dumps or database dumps in evidence.

| Check | Procedure / evidence |
| --- | --- |
| Public HTTPS and devices | From a phone on mobile data and a private laptop outside the developer machine, open the public URL; capture successful HTTPS, page rendering and browser/device/time. Confirm plain HTTP is redirected by Render. |
| Assets and refresh | Inspect JS/CSS requests for 200. Refresh `/popular`, `/search?q=space`, `/movies/<real-id>` and a signed-in `/watchlist`; verify real UI rather than server 404. Request `/api/unknown` and `/assets/missing.js`; expect JSON 404, never HTML. |
| Sessions and writes | Use only approved app accounts A/B. Login, refresh/new tab for session restore, change preferences, save a half-star rating and a Watchlist item. Verify each value after logout/later login and confirm account isolation. Check cookie attributes without recording its value. Cross-origin writes must get 403. |
| Restart/redeploy | Record the exact account values and movie IDs; use a controlled Render restart/redeploy of a green SHA. Verify startup index ready, unchanged saved values and existing session restore. The index may rebuild in `/tmp`; account data must remain in Neon. |
| Health failure and recovery | First run the local fake/temp health tests below. For live evidence use a **separate staging instance, dedicated DB and dedicated non-shared role**, with operator-approved isolation. After readiness, set only that role to `NOLOGIN`, then terminate its existing sessions filtered by both exact role and staging database. Verify safe 503, restore `LOGIN` and verify 200. `REVOKE CONNECT` alone can remain ineffective through PUBLIC/inherited grants and existing connections. Restore `LOGIN` in a finally/recovery step even if the probe fails. Preserve the shared runtime role and compute. If no safe staging method exists, leave live outage verification pending. |
| PostgreSQL major | On the confirmed runtime connection run `SHOW server_version; SHOW server_version_num;` and record major 18, database/role and verified TLS without connection strings. Use T02's read-only readiness script and compare current migration head, active catalogue/count and index readiness. |
| Safe logs | Trigger a known route, unknown route and staging failure; match `X-Request-ID` to ID/method/template/status/latency in Render logs. Confirm queries, credentials, session cookies, auth headers and exception text are absent. |
| Release evidence | Capture protected-main settings, eligible approval, gate cases above, green main CI URL/duration, public URL and matching full source/deployed SHA. |

## Local verification record

The original author recorded the following checks on 9 November 2026 (Asia/Ho_Chi_Minh), with Python 3.12.4 and Node 24.21.0. That preparation was subsequently committed as `1f4fd2b42ddea88d884f7b1ec8895fd4955d9181` on PR #260, based on `e61989e7e1ba0929a21e3ffb00cdf8c8300be515`. The new completion checks are recorded separately below.

- `python -m pytest -c pytest.ini backend/tests/test_health.py backend/tests/test_production_serving.py backend/tests/test_auth_sessions.py tests -v`: **130 passed** (43 focused + 87 root). After adding an additional index-symlink regression, the three focused suites were rerun separately: **44 passed**. Includes health failure/recovery/schema probes, SPA/assets/404s, log redaction/correlation, Secure cookies, trusted/untrusted forwarded HTTPS, session restore/logout and account writes. An inherited Starlette TestClient/httpx deprecation warning remains.
- `python -m ruff check backend`: passed.
- `python scripts/verify_s4_t05_trace.py`: passed, 37 Section 2 IDs mapped to the 40 default P0 tests.
- `npm --prefix frontend test`: **41 files, 467 tests passed**.
- `npm --prefix frontend run lint` and `npm --prefix frontend run build`: passed.
- Required PostgreSQL negative probes: missing URL and refused loopback connection both produced nonzero test exits with no skips, as expected.
- `python backend/scripts/verify_s4_c05_startup.py`: passed on temporary SQLite data through a real local HTTP server; backup/restore, startup, health, Search/Similar and restart preserved the seeded account/catalogue rows (3.39 s). This synthetic check does not establish Neon or Render persistence.
- Existing CI credential-pattern and forbidden-file checks: passed; credential-pattern scanning also covered untracked additions. `git diff --check` and CI YAML parsing passed.

The original author's local PostgreSQL server/Docker was unavailable. The subsequent [PR CI run 42645303366](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/42645303366) passed its PostgreSQL 18 service-container job on `1f4fd2b42ddea88d884f7b1ec8895fd4955d9181`. Final production/admin acceptance remains tracked below.

## Public baseline and remaining acceptance — 10 November 2026

Direct HTTPS requests to `https://cineai-o9tf.onrender.com` returned `/health` 200 with migration `a3d1f8b72c44` and `/api/movies?limit=1` 200 with real catalogue data. `/` returned the old FastAPI `{"detail":"Not Found"}` 404. At that observation, main was `e61989e7e1ba0929a21e3ffb00cdf8c8300be515`, lacked the frontend route and PR #260 was open. These observations establish a reachable backend baseline. The exact Render deployed SHA still needs its Deploy Details record.

The operator's Environment screenshot shows Python 3.12.6, Node 24, production mode, Secure cookies, `/tmp/ai66a-overview-tfidf-v1.json` and the runtime database role. The complete database URL, Render source/auto-deploy settings, ingress trust guarantees and service access require separate private/operator confirmation. The screenshot alone does not establish those settings.

**Historical T03 access limitation:** the then-connected Render account saw a
different team's workspace and returned 404 for CineAI
`srv-dbp96kp42hec73bv94j0`. On 11 November the PO reconnected the correct account;
authenticated read-only access now verifies CineAI in My Workspace. GitHub still
reports `admin=false`, so required-check configuration and its authentic settings
screenshot require a repository administrator. See [T08 evidence](evidence/s5-t08-operations/README.md).

The effective main rules queried through GitHub currently include deletion protection, non-fast-forward protection and one required approving PR review from organization ruleset `21296815`. Required status checks are absent from the effective branch rules. Stale-review dismissal, last-push approval and review-thread resolution are false. Classic branch protection returns 404. An admin must apply and re-query the missing settings before protection acceptance.

### Completion verification

Verified on 10 November 2026, Windows, Python 3.12.6 and Node 24.19.0, using the completion changes based on PR source `1f4fd2b42ddea88d884f7b1ec8895fd4955d9181`. The completion commit containing this record identifies the changed source. The original 64-second PR CI run above covers its original SHA; the new completion CI is recorded on PR #260 after pushing.

| Check | Command / observed result |
| --- | --- |
| Startup diagnostic RED→GREEN | Added three production-serving cases for filesystem permission, PostgreSQL privilege and index errors. All three failed before the diagnostic change, then passed within the combined run. Logs exclude private exception text and tracebacks. |
| Pytest environment RED→GREEN | The inherited production `.env` caused HTTP test clients to lose their Secure session cookies. Three fresh-process probes failed with inherited production/Secure settings, then passed after early bootstrap set test mode and local test cookies. Production-specific tests still explicitly set their own production configuration. |
| Focused backend + root suites | `python -m pytest -c pytest.ini backend/tests/test_health.py backend/tests/test_production_serving.py backend/tests/test_auth_sessions.py backend/tests/test_s5_t02_startup_index.py tests -q` → **136 passed**, one inherited Starlette/httpx deprecation warning. |
| PostgreSQL 18 | With private `TEST_POSTGRES_URL` targeting separate `cineai_test`, `TEST_POSTGRES_MAJOR=18` and `REQUIRE_POSTGRES_TESTS=1`, `python -m pytest -c pytest.ini backend/tests/test_postgresql_t01.py -q --junitxml=<private-report-path>` → **11 passed**, zero skips, 68.96 seconds. The fixture created and removed its unique schemas. Runtime data stayed outside this test target. |
| Backend lint / P0 traceability | `python -m ruff check backend tests/test_pytest_setup.py conftest.py` passed. `python scripts/verify_s4_t05_trace.py` mapped 37 Section 2 IDs to 40 default P0 cases. |
| Frontend production bundle | `npm --prefix frontend run lint` and `npm --prefix frontend run build` passed. Vite produced `index.html` and JS/CSS assets. Full Vitest was not rerun for this backend/deployment completion. |
| Offline startup/restart | `python backend/scripts/verify_s4_c05_startup.py` passed with temporary migrated SQLite data, index regeneration, backup/restore and account/catalogue preservation in 6.14 seconds. |
| Actual bundle + Neon runtime | A separate local production-mode Uvicorn process used the restricted Neon runtime role, explicit certifi bundle and 989-movie catalogue. Health, ten SPA route refreshes, both generated JS/CSS assets and correlated JSON 404s passed. This verifies the PR bundle locally; public UI acceptance awaits deployment. |
| Public HTTPS backend | Actual demo login passed with Secure/HttpOnly/SameSite=Lax cookie, subsequent `/api/auth/me` requests passed, cross-origin logout was rejected with 403 while the session remained valid, legitimate logout returned 204, then `/api/auth/me` returned 401. These were API-level checks from the operator machine. Phone/laptop browser UI journeys remain pending. |

**Historical pre-T03-deploy result:** the public backend then returned root 404.
The reviewed T03 commit was subsequently deployed; 11 November verification
shows the React app at the public URL. Keep the earlier result as history, not
the current status. The newer regional code/head still requires a coordinated
rollout and its own acceptance evidence.

| Remaining gate | Required result / responsible handoff |
| --- | --- |
| Effective main protection | Repository admin captures PR + independent approval + named required checks, strict/up-to-date mode and bypass settings after applying the protection above. |
| Final PR review | A non-contributing teammate gives a substantive formal review and approval on the final candidate, then the owner merges PR #260. |
| Frontend public deployment | Service owner confirms branch `main`, build/start commands above, `/health`, Free plan and After CI Checks Pass. Deploy the reviewed green main commit and capture HTML/assets/nested refreshes. |
| Deploy gate proof | Capture failing isolated staging candidate, PR-only unchanged deployment and successful green-main deployment, including CI URL/duration and matching Render SHA. |
| Public account/device checks | Confirm phone/mobile-data and private-laptop journeys, A/B sessions and writes, plus persistence after controlled Render restart/redeploy. |
| Isolated outage and safe logs | Use dedicated staging resources for 200→503→200 and capture request-ID/status/latency log correlation with secrets excluded. |
| Operator access and handoff | Confirm primary and backup access to the actual CineAI service, then share verified records with T06/T07/T08. |

Keep `Refs #250` while these gates remain open. The source PR can merge to enable the UI deployment. Close #250 after the post-merge checks and evidence are complete.
