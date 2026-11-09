# S5-T03 deployment and acceptance

Issue [#250](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/250).
Repository preparation is available; public runtime and admin acceptance remain **Manual/operator verification required**. No deployment, branch-rule change or runtime evidence is implied by this document.

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
| Service | Web Service, native Python runtime |
| Repository | `SE-FDA-NEU/ai66a_group3_C1_SE` |
| Branch | `main` |
| Root Directory | Empty (repository root) |
| Auto-Deploy | **After CI Checks Pass** |
| Pull request previews | Disabled for the production service; any separate previews use disposable data |
| Health Check Path | `/health` |
| Build filters | Empty, so required changes always participate |
| Python | Root `.python-version` selects Python 3.12, matching the backend's supported minor; remove conflicting dashboard `PYTHON_VERSION` overrides |
| Node | `NODE_VERSION=24`, matching CI |

Build command:

```sh
python -m pip install -r backend/requirements.lock.txt && python -m pip install -e ./backend --no-deps && npm --prefix frontend ci --include=dev && npm --prefix frontend run build
```

Start command:

```sh
python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port "$PORT" --workers 1 --proxy-headers --forwarded-allow-ips "$FORWARDED_ALLOW_IPS" --no-access-log
```

Render provides `PORT`. Use one worker initially, keeping the existing per-process DB pool and startup-index behavior. Do not use `--reload`. Both Node/npm and Python are available in Render's [native runtimes](https://render.com/docs/native-runtimes). Render accepts a minor in [`.python-version`](https://render.com/docs/python-version), while a dashboard `PYTHON_VERSION` requires a full released version.

Configure these runtime values privately:

| Variable | Value / handling |
| --- | --- |
| `APP_ENV` | `production` |
| `SESSION_COOKIE_SECURE` | `true`; production code enforces Secure even if this is accidentally false |
| `DATABASE_URL` | T02 restricted runtime-role `postgresql+psycopg://<user>:<password>@<confirmed-host>/<confirmed-runtime-db>?sslmode=verify-full&connect_timeout=5`; preserve any approved channel-binding parameters |
| `PGSSLROOTCERT` | `system`, using the native Linux trusted CA store; verify certificate validation on the actual target |
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
| SHA identity | Compare the main CI run's `head_sha` with the Render deploy's commit SHA. In Render Shell, `printenv RENDER_GIT_COMMIT` must report the same full SHA; capture it with the public URL and timestamp. Do not print other environment values. |

Render documents [`RENDER_GIT_COMMIT`](https://render.com/docs/environment-variables) as the service's commit SHA. If a newer main commit supersedes the candidate, record the newer matching CI/deploy pair rather than claiming the older candidate was deployed.

## Runtime acceptance — Manual/operator verification required

Record the operator, local time/timezone, device/browser, target, full source/deployed SHAs, public Render URL, CI URL/duration and redacted results for every row. Never place credentials, cookie values, environment dumps or database dumps in evidence.

| Check | Procedure / evidence |
| --- | --- |
| Public HTTPS and devices | From a phone on mobile data and a private laptop outside the developer machine, open the public URL; capture successful HTTPS, page rendering and browser/device/time. Confirm plain HTTP is redirected by Render. |
| Assets and refresh | Inspect JS/CSS requests for 200. Refresh `/popular`, `/search?q=space`, `/movies/<real-id>` and a signed-in `/watchlist`; verify real UI rather than server 404. Request `/api/unknown` and `/assets/missing.js`; expect JSON 404, never HTML. |
| Sessions and writes | Use only approved app accounts A/B. Login, refresh/new tab for session restore, change preferences, save a half-star rating and a Watchlist item. Verify each value after logout/later login and confirm account isolation. Check cookie attributes without recording its value. Cross-origin writes must get 403. |
| Restart/redeploy | Record the exact account values and movie IDs; use a controlled Render restart/redeploy of a green SHA. Verify startup index ready, unchanged saved values and existing session restore. The index may rebuild in `/tmp`; account data must remain in Neon. |
| Health failure and recovery | First run the local fake/temp health tests below. For live evidence use a **separate staging instance and dedicated DB**, with operator-approved isolation: observe 200, temporarily deny only that instance's DB access (e.g. terminate its existing DB sessions and revoke its dedicated role's CONNECT), observe safe 503, restore that access and observe 200. Startup may refuse an already-broken DB; induce the fault only after readiness. Do not stop or revoke access on the shared Neon compute/runtime role. If no safe staging method exists, leave live outage verification pending. |
| PostgreSQL major | On the confirmed runtime connection run `SHOW server_version; SHOW server_version_num;` and record major 18, database/role and verified TLS without connection strings. Use T02's read-only readiness script and compare current migration head, active catalogue/count and index readiness. |
| Safe logs | Trigger a known route, unknown route and staging failure; match `X-Request-ID` to ID/method/template/status/latency in Render logs. Confirm queries, credentials, session cookies, auth headers and exception text are absent. |
| Release evidence | Capture protected-main settings, eligible approval, gate cases above, green main CI URL/duration, public URL and matching full source/deployed SHA. |

## Local verification record

On 9 November 2026 (Asia/Ho_Chi_Minh), the working tree based on `e61989e7e1ba0929a21e3ffb00cdf8c8300be515` was tested with Python 3.12.4 and Node 24.21.0. Changes remain uncommitted, so that base SHA alone does not identify the tested edits.

- `python -m pytest -c pytest.ini backend/tests/test_health.py backend/tests/test_production_serving.py backend/tests/test_auth_sessions.py tests -v`: **130 passed** (43 focused + 87 root). After adding an additional index-symlink regression, the three focused suites were rerun separately: **44 passed**. Includes health failure/recovery/schema probes, SPA/assets/404s, log redaction/correlation, Secure cookies, trusted/untrusted forwarded HTTPS, session restore/logout and account writes. An inherited Starlette TestClient/httpx deprecation warning remains.
- `python -m ruff check backend`: passed.
- `python scripts/verify_s4_t05_trace.py`: passed, 37 Section 2 IDs mapped to the 40 default P0 tests.
- `npm --prefix frontend test`: **41 files, 467 tests passed**.
- `npm --prefix frontend run lint` and `npm --prefix frontend run build`: passed.
- Required PostgreSQL negative probes: missing URL and refused loopback connection both produced nonzero test exits with no skips, as expected.
- `python backend/scripts/verify_s4_c05_startup.py`: passed on temporary SQLite data through a real local HTTP server; backup/restore, startup, health, Search/Similar and restart preserved the seeded account/catalogue rows (3.39 s). This synthetic check does not establish Neon or Render persistence.
- Existing CI credential-pattern and forbidden-file checks: passed; credential-pattern scanning also covered untracked additions. `git diff --check` and CI YAML parsing passed.

A PostgreSQL server/Docker was unavailable locally. A successful PostgreSQL 18 integration run, CI service-container execution, production/admin settings and public/device/Neon runtime acceptance remain pending. The checked-in T02 evidence supplies the upstream handoff; it does not substitute for these T03 checks.
