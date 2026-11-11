# CineAI operations

Owner: @vu-huzy, [T08 #255](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/255).
Current read-only observation: **11 November 2026**, after the regional rollout.
[C02 evidence](evidence/s5-c02/README.md) identifies the running source and the
remaining release/device/PO/administrative gates. The earlier
[T08 observations](evidence/s5-t08-operations/README.md) remain historical.
The M5 brief says seven sections but lists six; these follow the six-row table.

## 1. Deployment and release

| Item | Verified state / operating procedure |
| --- | --- |
| URL/platform | <https://cineai-o9tf.onrender.com/>; Render **Free**, native Python, Singapore, one worker; Neon PostgreSQL **18.6**, Singapore. [SETUP](SETUP.md#postgresql-18-neon-and-render-public-runtime) |
| Render identity | `cineai`, `srv-dbp96kp42hec73bv94j0`, **My Workspace**. Connected account now sees the correct service. Branch `main`, repository `SE-FDA-NEU/ai66a_group3_C1_SE`, `/health`, Free and `autoDeployTrigger=checksPass` were read from Render; no settings changed |
| Actual live release | Deploy `dep-dbq71cvf3r2c73e7g890`, **live**, SHA `acc49243e4db404438b00521c2f7a6234377fb18`; 13:43:59 UTC, 11 November. Public health 200/head `d9a6f2c1e508`; 989 movies and all 2,967 US/GB/SG checks populated. [Read-only evidence](evidence/s5-c02/runtime.json) |
| Reviewed main baseline | Same `acc4924` source; [green CI 43025094939](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/43025094939). This C02 documentation PR is a later source, not automatically the running app or a completed release |
| Merge → CI → deploy | Reviewed PRs, required checks/approval, green main CI, configured **After CI Checks Pass**. The setting is verified; a complete failed-CI/no-deploy experiment is not claimed |
| One-batch release hold | **Superseded by PO:** deploy first, document observed results, permit further reviewed deploys. For docs-only merges that should retain the app, use `[skip render]` in the actual merge commit and verify the skip; keep CI enabled. [Current release rule](s5-c02-wrap-up.md#deploy-first-document-afterward--po-amendment) |
| Safe rollout | New backup was restored and matched 11 pre-change tables before the requested two migrations/grants; current schema/read permissions pass. For each future incompatible change, coordinate backup/migration/grants with matching deployment; temporary 503 is possible. Do not reimport the catalogue solely for providers |
| Rollback/recovery | [T06](s5-t06-postgresql-recovery.md) rehearsed old T03 code: 503 on regional schema, 200 on an isolated pre-provider restore. A fresh runtime backup was also restored/compared across 11 snapshot tables on 11 November. Neither is a Render rollback. A later regional backup restored/compared all 13 public tables; durable shared storage and teammate reproduction remain Pending under C02 R06. Restore into an isolated target and verify compatibility before switching; never overwrite later writes or silently discard regional data |
| Final identity | **Verified:** PO accepts acc4924; published [v1.0](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/releases/tag/v1.0) targets that exact running green-main source. Latest docs-main SHA/CI may differ. C02 admin/private-storage/review/submission remain Pending |

## 2. Continuous integration and protected main

`CI` ([ci.yml](../.github/workflows/ci.yml)) runs on pushes, main/develop PRs and manual dispatch.

| Job / context to require | Checks |
| --- | --- |
| Detect stack | Select storage/bootstrap scope from the diff |
| Python tests | Locked install, Ruff, **40 P0** cases, traceability, focused provider/CLI and affected storage/bootstrap checks, health/serving/session boundaries |
| PostgreSQL 18 integration | `postgres:18`, authenticated integration and native dump/restore with major-18 clients, zero DB skips |
| Node build and tests | `npm ci`, ESLint, 42 regional-provider UI cases, TypeScript/production build and T07's 18 focused acceptance-verifier cases, now merged via #265 |
| No secrets committed | Credential patterns and forbidden artifacts |

| Evidence | Actual result |
| --- | --- |
| Main CI | Run [43025094939](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/43025094939), `acc4924`, success, 81 seconds (12:59:31–13:00:52 UTC). Recheck latest main after this PR merges |
| Effective rules API | [C02 GitHub snapshot](evidence/s5-c02/github.json): PR with one approval, deletion/non-fast-forward protection; no required-status-check entry returned. Admin must confirm/configure enforcement; complete protection is not certified |
| Admin action/screenshot | **Pending C02:** admin confirms/enforces the five contexts plus PR/approval and captures the authentic settings screen for this document. Under the deploy-first amendment it can be supplied after this baseline; it remains mandatory before C02 closes. API JSON is not the screenshot |
| Review | Scrum hygiene checks issue/approval metadata; substantive non-contributor review must still precede merge |

## 3. Monitoring, logs and incident response

Read **CineAI → Logs/Events** and `/health`; filter application request-completion
lines, deduplicate `request_id`, and use `status`/`latency_ms`. Error rate is
`5xx / completed requests × 100`; expected 4xx, startup lines and tracebacks are
not server errors. Samples include health probes. App time excludes wake-up/network time.

| Signal | Initial response threshold and frequency | Owner / backup |
| --- | --- | --- |
| Health | Daily/before demos; non-200 or repeated warm health >1,000 ms: repeat after 5 minutes, then investigate. Allow up to 90 s for a first Free-instance wake-up; no sleep-prevention pinger | @vu-huzy / @kietxuan |
| Error rate | 5-minute windows when checking logs or investigating; >2% or repeated same-route 5xx triggers investigation; record numerator/denominator | @vu-huzy / @kietxuan |
| Response time | Watch `latency_ms` p50/p95/max by route; repeated warm-health threshold above triggers investigation. Baseline route mix is not a promised SLO | @vu-huzy / @kietxuan |
| Quotas | Daily Render/Neon console warnings and before heavy operator jobs | Render @anotify-vie; Neon @NguyenTuanAnh0608 |

| 11 November baseline interval, UTC+7 | Completed / health / 4xx / 5xx | Error rate | App p50 / p95 / max, ms |
| --- | --- | --- | --- |
| 17:05–17:10 | 220 / 72 / 10 / 0 | 0% | 26.81 / 825.67 / 1619.05 |
| 17:15–17:20 | 106 / 71 / 3 / 0 | 0% | 26.72 / 693 / 1263.14 |

Both paginated log windows were fully fetched. [Redacted samples and calculation](evidence/s5-t08-operations/README.md)
are reproducible. A 17:50 client health took 49,724.59 ms, with the same response
request ID logged by Render at 22.36 ms: consistent with platform/wake-up overhead,
not evidence of steady-state app latency. No zero-error/uptime guarantee follows.

For an incident: record time/SHA/status/request ID, repeat health, inspect Events
and safe Logs (`error_type`, `sqlstate`, `errno`), and open an issue with the
redacted timeline. Do not log passwords, cookies, tokens, account data or literal
user query strings. Deploy: @anotify-vie → @kietxuan; DB: @NguyenTuanAnh0608 →
@hoang3003; recovery: @hoang3003 → @NguyenTuanAnh0608. Never bypass stale-head health.

Post-deploy observations: 13:45–13:50 UTC had 101 completions (71 health),
0 five-hundreds, p95 408.67 ms; 13:50–13:55 had 70/70 health, 0 five-hundreds,
p95 99.85 ms. [All-page, deduplicated samples](evidence/s5-c02/monitoring.json)
measure app processing, not user-load performance or uptime. Repeat after a new
candidate; preserve the old f24 series as history.

A fresh health response request ID matched Render's GET /health HTTP 200 at
25.89 ms app time; [correlation](evidence/s5-c02/health-correlation.json). Current
public probes pass 14/14 read-only and 8/8 fresh-account scenarios; Kiet separately
reports phone/private-laptop OK. [Final evidence](s5-c02-wrap-up.md#final-technical-acceptance-and-user-reported-device-check).

## 4. Risks and technical debt

| Item | Layer | What could happen | Plan |
| --- | --- | --- | --- |
| Public behind main | infrastructure | Missing regional UI; an uncoordinated migration breaks exact-head health | Coordinated backed-up rollout and public acceptance: [#254](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/254), [#256](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/256) |
| Required checks not evidenced | infrastructure | A red candidate could merge | Admin configuration and authentic screenshot: [#250](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/250), C02 audit |
| Local-only backups | data | Disk loss leaves no durable recovery copy | Durable destination, operator access, daily execution and independent reproduction remain [#253](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/253) follow-up |
| Free sleep/ephemeral index | infrastructure | Slow first request; index rebuilt after replacement | Accepted: free hosting is the agreed scope; disclose, check before demos and rebuild derived state |
| Shared Neon quota | infrastructure | Heavy jobs affect runtime capacity | Accepted: separate databases, quota checks and quiet import/test windows |
| TMDb regional gaps | data | A selected market has no provider/link information | Accepted: neutral unknown wording, exact-market nullable link and attribution; development coverage is not public acceptance |
| Manual monitoring | infrastructure | Incidents between daily checks may be missed | Accepted for this free-plan scope: named owner/backup and incident escalation |
| Test automation is not a phone/PO decision | tests | Emulation or green CI is mistaken for full acceptance | Physical device, real rehearsal and PO decision: [#254](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/254) |

## 5. Maintenance plan

| Area | What to do | Owner / backup | How often |
| --- | --- | --- | --- |
| Bugs | Reproduce, prioritise and fix by reviewed PR | Area owner; @kietxuan prioritises | On report; daily triage |
| Dependencies | Review locks/advisories, `npm --prefix frontend audit --omit=dev`, affected CI before adoption | @vu-huzy / @anotify-vie | Before releases/demos |
| Backups | Private logical backup, verify restoration and retain seven successful copies | @hoang3003 / @NguyenTuanAnh0608 | Daily after writes and before changes; durable automation/access pending |
| Monitoring | Health/log error rate/latency/quota checks and response above | @vu-huzy / @kietxuan | Daily, before demos, on failure |
| Documentation | Keep URL/SHA/commands/accounts/owners true; recheck links | @vu-huzy / @kietxuan | Every release/change |
| Retention | Keep service and extend the deadline when grading is announced | @kietxuan / @anotify-vie | Confirm at each month end |

Retain at least through **12 December 2026**, extending to one calendar month
after actual `v1.0` and grade publication, whichever is latest. Daily execution,
shared-backup access and final maintenance handoff are not claimed by this plan.

## 6. Lessons learned

| What happened | What changed | What to do differently |
| --- | --- | --- |
| VN had no data for 989 movies | PO approved US/GB/SG; the actual VN run stays dated history | Probe market coverage before promising availability |
| Comparator once returned 0 without comparing tables | T06 registers all 12 models and rejects empty metadata | Deliberately break every important verifier |
| Source CI was green while public code/head stayed old | T07 records live SHA/API and named failed public checks | Verify deployment identity as well as source CI |
| Two stale-empty provider cases omitted their warning | T05 shows the warning for every stale combination | Enumerate status/link combinations before UI work |
| Windows WIN1252 restore rejected multilingual TMDb titles | T07 restored the real catalogue successfully with UTF8 | Check server/target encoding before restore |
