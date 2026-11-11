# CineAI operations

Issue [#255](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/255), owner @vu-huzy.
Facts are as of **11 November 2026, 15:40 (UTC+7)** on main
`50aa9ad4fccc63f5d7ef8186bb296ed12f0d18ee`. Every unproven item is marked **Not done**.
Public URL: <https://cineai-o9tf.onrender.com/>. Setup commands are in [SETUP](SETUP.md).
The supplied M5 brief says seven sections but enumerates six; the six below follow
that enumerated order, and the instructor's clarification is still awaited
([planning record](sprint5-backlog-refinement.md)).

## 1. Deployment and release

| Item | Current state and source |
| --- | --- |
| Platform | Render Free web service (native Python, Singapore) serving the React build, `/api` and `/health` from one HTTPS origin; Neon Free PostgreSQL 18, AWS `ap-southeast-1`. Settings: [deployment runbook](s5-t03-deployment.md), [Neon record](evidence/s5-t02-neon/README.md). |
| Merge to green to deploy | PR, required checks and teammate review, merge to `main`, green main CI, then Render **After CI Checks Pass**. The Render dashboard values were not visible to this author; confirmation by the service owner is **Not done**. |
| Latest green main | `50aa9ad4fccc63f5d7ef8186bb296ed12f0d18ee` (merge of PR #263), [CI run 42987332068](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/42987332068), success. Its code Alembic head is `d9a6f2c1e508`. |
| Running public release | `/health` returned 200 with `migrationVersion` `a3d1f8b72c44` and `/` returned the React HTML. The Render deployed commit SHA is **Not recorded** (Deploy Details needed). The public runtime is therefore older than main: Details has no `providers`/`watchOptionsUrl` and ignores `country`. |
| Release identity | No `v1.0` tag exists. Exact-SHA identity, tag and final deployment belong to [#256](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/256): **Not done**. |
| Exercised rollback | Rehearsed on isolated PostgreSQL targets only ([recovery evidence](evidence/s5-t06-recovery/README.md)): reviewed T03 source `f24ef54699efb2fa26f363107bd31401f9b12e58` returned health 503 against the regional schema and 200 against a restored pre-provider archive. A Render dashboard redeploy of an earlier SHA was **Not done**. |
| Safe forward order | Fresh private backup, migrate with the operator role, deploy the matching green commit, check `/health` and Details, then enrich. `/health` requires the exact code head, so never migrate ahead of the code. See [recovery runbook](s5-t06-postgresql-recovery.md). |

## 2. Continuous integration and protected main

The `CI` workflow ([ci.yml](../.github/workflows/ci.yml)) runs on every push, on pull requests to main/develop and manually.

| Required context | Steps |
| --- | --- |
| Detect stack | Decide whether storage and test-bootstrap checks apply to the diff. |
| Python tests | Locked install, Ruff, 40 P0 tests, P0 traceability, regional provider/CLI tests, optional storage/bootstrap checks, health/serving/session tests. |
| PostgreSQL 18 integration | `postgres:18` service, PostgreSQL integration suite with no skips, PostgreSQL 18 clients, isolated native recovery rehearsal. |
| Node build and tests | `npm ci`, lint, the 42-case regional provider UI suite, production build. |
| No secrets committed | Credential-pattern scan and forbidden-file check. |

| Evidence | Result |
| --- | --- |
| Actual duration | The last six push-to-main runs (#258 to #263) took 1m06s to 1m26s. Run 42987332068: created 08:28:36Z, finished 08:29:54Z, 1m18s. |
| Green main run | [42987332068](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/42987332068), all five jobs succeeded. |
| Effective protection (GitHub API, 11 November) | Ruleset 21296815 supplies deletion block, non-fast-forward block and a pull-request rule with one approving review. Stale-review dismissal, last-push approval and thread resolution are off. **No required status checks** are present. |
| Authentic protection screenshot | **Not done.** A repository administrator must apply the settings in the [runbook](s5-t03-deployment.md#main-protection-and-deploy-gate) and capture the real screen. No image is fabricated. |
| Review hygiene | The `Scrum hygiene` workflow requires an issue link and a reviewer other than the author. |

## 3. Monitoring, logs and incident response

Source of record: the Render service **Logs** and **Events** pages plus `GET /health`. Logging, request IDs and
redaction are defined in the [deployment runbook](s5-t03-deployment.md#serving-security-health-and-logs).
Check from a terminal:

```bash
curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" https://cineai-o9tf.onrender.com/health
```

The Free service sleeps when idle, so the first request can take about a minute. These checks neither
prevent sleep nor imply guaranteed uptime, and no keep-alive pinger is used.

| Signal | Source and interval | Threshold (proposed, awaiting PO/owner confirmation) | Owner |
| --- | --- | --- | --- |
| Availability | `/health` once daily and before each demonstration | Not 200, or a warm answer slower than 5 s; repeat after 5 minutes, a second failure is an incident | @vu-huzy, backup @kietxuan |
| Error rate | Render Logs over one observation window: server-error lines divided by all request lines | Above 2% in a window, or the same route failing repeatedly | @vu-huzy |
| Response time | Log `latency` field and the curl timing | Warm `/health` above 1 s repeatedly; a cold first request is expected to be slow | @vu-huzy |
| Quotas | Render and Neon consoles, daily | Any warning or exhausted allowance | Render @anotify-vie, Neon @NguyenTuanAnh0608 |

| Observation | Source | Result |
| --- | --- | --- |
| 11 Nov 2026, 15:37 to 15:40 | `curl` from the author's machine, not Render logs | First `/health` 53.7 s (consistent with wake-up; idle state not independently confirmed), then 0.42 s and 0.27 s, all 200. `/api/movies?limit=1` 0.30 s with 989 movies. Unknown `/api` and missing asset return JSON 404 with a `requestId`; `/health` returns an `X-Request-ID` header. |
| Error-rate series over explicit intervals | Render Logs | **Not done.** Log access was unavailable to this author. The service owner must record windows, request counts and 5xx counts. |
| Log-side request correlation | Render Logs | **Not done.** The response side is confirmed above; matching an ID in Render Logs is pending. |

| Incident step | Action |
| --- | --- |
| Confirm and record | Repeat the check, note time, status and `requestId`. Never paste cookies, URLs with identifiers or connection strings. |
| Diagnose | Check Render Events for a running deploy, then Logs for startup `error_type`, `sqlstate` or `errno`. A 503 can mean a head mismatch, so hold deployment and never bypass health. |
| Escalate | Runtime and deploys: @anotify-vie then @kietxuan. Database access: @NguyenTuanAnh0608 then @hoang3003. Backup and restore: @hoang3003 then @NguyenTuanAnh0608. Decisions: @kietxuan. |
| Record | Open a GitHub issue with timeline, SHA, head and outcome. |

## 4. Risks and technical debt

| Item | Layer | What could happen | Plan |
| --- | --- | --- | --- |
| Public runtime behind main | Deployment and database | Regional Details and selector are absent publicly; migrating the database before the code makes `/health` fail | Backup, migrate, deploy and enrich as one rehearsed change, tracked by [#254](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/254) and [#256](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/256) |
| Backup storage is a local operator folder | Data | Disk loss leaves no restorable copy; daily execution and independent reproduction are not done | Pending items listed in [#253](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/253) and its [evidence](evidence/s5-t06-recovery/README.md#remaining-closure-work) |
| Main lacks required checks and stale-review dismissal | Process | A red or outdated candidate could merge | Repository administrator applies the runbook settings; C02 audits at [#256](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/256) |
| Free-plan sleep, one worker, ephemeral disk | Runtime | A cold request takes about a minute (53.7 s seen); the NLP index rebuilds in `/tmp` | Accepted: no paid plan in scope. Disclosed, checked before demos, no uptime claim |
| Neon Free shared compute and quota | Database | Development or test jobs slow or exhaust the runtime database | Accepted: separate databases, no heavy jobs near demos, daily quota check ([Neon record](evidence/s5-t02-neon/README.md)) |
| TMDb regional coverage and terms | External data | Many movies lack a market (development run: no data for US 89, GB 134, SG 283 of 989) | Accepted: neutral unknown wording, TMDb/JustWatch attribution, operator-only token, refresh with `--refresh` |
| No automated alerting | Monitoring | An outage goes unnoticed between daily checks | Accepted for this scope: manual daily check by the monitoring owner |

## 5. Maintenance plan

| Area | What to do | Owner | How often |
| --- | --- | --- | --- |
| Bugs | Triage new GitHub issues, reproduce locally, fix by reviewed PR | Owner of the affected area; @kietxuan prioritises | On report; reviewed at each daily check |
| Dependencies | Keep lockfiles, rerun the CI jobs, audit production packages with `npm --prefix frontend audit --omit=dev` | @anotify-vie (proposed) | Before any release or demo |
| Backups | Logical backup after public writes and before schema or provider changes; keep the latest seven successes | @hoang3003, backup @NguyenTuanAnh0608 | Daily after writes and before changes |
| Monitoring | Health, error-rate, latency and quota checks from section 3 | @vu-huzy, backup @kietxuan | Daily and before demos |
| Documentation | Update this file, README and SETUP when URL, head, commands, accounts or owners change, then recheck links | @vu-huzy | Each release or change |
| Service retention | Keep the URL available and extend the date when the instructor announces grading | @kietxuan, backup @anotify-vie | Reconfirm at each month end |

Latest required maintenance date: **12 December 2026**. It extends to one calendar month after the actual v1.0
release and to the grade-publication date (still unannounced), whichever is latest.

## 6. Lessons learned

| What happened | What changed | What to do differently |
| --- | --- | --- |
| The VN-only provider run found no data for all 989 movies and TMDb's region list omitted VN ([T04 history](evidence/s5-t04-providers/README.md)) | The PO approved US/GB/SG on 10 November; the VN run stays as dated history | Probe real provider coverage before committing a UI scope |
| The first recovery comparator exited 0 without comparing any table ([T06](evidence/s5-t06-recovery/README.md)) | It now registers all models, refuses empty metadata and compares 12 tables | Give every verifier a deliberate-mutation test that must fail |
| `/health` requires the exact code head, so the regional migration could not reach the runtime before its code | Runbooks state the rollout order and the rollback limit | Schedule migration and deploy as one change and rehearse old code on the new schema early |
| Two stale-empty UI cases showed no warning ([T05](evidence/s5-t05-regional-ui.md)) | A warning now appears for every stale result, with regression tests | List every status and link combination as test cases before building |
