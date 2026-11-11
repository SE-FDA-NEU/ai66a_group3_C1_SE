# CineAI operations

Owner: @vu-huzy, [T08 #255](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/255).
Current read-only observation: **11 November 2026**, after the mobile navigation
deployment from merged PR #267. [Post-deploy evidence](evidence/m5-post-mobile/README.md)
identifies the Live source, matching green-main CI, public checks and the
remaining release mismatch. Earlier [C02](evidence/s5-c02/README.md) and
[T08 observations](evidence/s5-t08-operations/README.md) remain dated history.
The six sections below follow the M5 operations requirements. C02 is Closed;
that administrative state does not replace missing operational/admin evidence.

## 1. Deployment and release

| Item | Verified state / operating procedure |
| --- | --- |
| URL/platform | <https://cineai-o9tf.onrender.com/>; Render **Free**, native Python, Singapore, one worker; Neon PostgreSQL **18** (last DB version audit: 18.6), Singapore. [SETUP](SETUP.md#postgresql-18-neon-and-render-public-runtime) |
| Render identity | `cineai`, `srv-dbp96kp42hec73bv94j0`, **My Workspace**. Connected account now sees the correct service. Branch `main`, repository `SE-FDA-NEU/ai66a_group3_C1_SE`, `/health`, Free and `autoDeployTrigger=checksPass` were read from Render; no settings changed |
| Actual live deployment | Deploy `dep-dbq9pjoqidvc73etjt4g`, **live**, SHA `80b15f705ca64752a346a636490b80be347487bd`; completed 16:53:03 UTC / 23:53:03 UTC+7 on 11 November. Public health 200/head `d9a6f2c1e508`. The previous manual deploy of this same SHA is deactivated after the successful automatic deploy. [Current evidence](evidence/m5-post-mobile/release-observation.json) |
| Reviewed application source | Merged [PR #267](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/267); @hoang3003 approved its final head before merge. Matching [green main CI 43062004407](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/43062004407). A later docs-only main SHA may differ from the running application |
| Merge → CI → deploy | Reviewed PRs, required checks/approval, green main CI, configured **After CI Checks Pass**. The setting is verified; a complete failed-CI/no-deploy experiment is not claimed |
| One-batch release hold | **Superseded by PO:** deploy first, document observed results, permit further reviewed deploys. For docs-only merges that should retain the app, use `[skip render]` in the actual merge commit and verify the skip; keep CI enabled. [Current release rule](s5-c02-wrap-up.md#deploy-first-document-afterward--po-amendment) |
| Safe rollout | PR #267 changes frontend/docs/CI and requires no new migration or catalogue import. The current public head and regional APIs pass. Earlier C02 backup/restore and migration evidence remains historical; for each future incompatible change, coordinate backup/migration/grants with matching deployment. Do not reimport the catalogue solely for providers |
| Rollback/recovery | Use the compatible-code or isolated-restore procedure below. Automated regional restore verified all 13 public tables, restored NLP and health; this is not a Render rollback or independent teammate handoff. Durable storage remains C02 R06 |
| Release identity and dated check | M5 requires **Render Live SHA = v1.0 target**. At the 16:55:54 UTC observation, [v1.0](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/releases/tag/v1.0) targeted `acc49243e4db404438b00521c2f7a6234377fb18` while Live was `80b15f7`. The old PO/device acceptance belongs to acc4924. Accept/reconcile the new candidate and record the verified target/date in release notes before submission; recheck the [current sources](../README.md#current-public-release-and-m5-status) rather than treating this snapshot as the later tag state. This documentation update did not change a tag |

For this documentation-only follow-up, preserve the verified application by
retaining **`[skip render]` in the actual merge/squash commit**, leaving CI
enabled, and checking that Render stayed on the intended Live SHA. Record the
new documentation-main CI separately. The latest submission CI link should
identify the latest successful main run when exporting the PDF; it can be newer
than the application-source CI recorded above.

Rollback procedure: identify the last known-good code SHA and its required
schema. If compatible with the current DB, revert the faulty app change through
a reviewed PR, wait for green main CI, deploy and verify Live SHA, health and
affected P0s. If schema differs, first restore a known-good backup to a **new
isolated PostgreSQL target**, verify data/index/health with compatible code, then
coordinate the operator-approved DB configuration/code switch. Preserve the
current DB and later writes until reconciliation; do not downgrade a populated
regional DB blindly. Record the actual action and recheck auto-deploy settings.
[T06 restore steps](s5-t06-postgresql-recovery.md#restore-to-a-separate-postgresql-target).

## 2. Continuous integration and protected main

`CI` ([ci.yml](../.github/workflows/ci.yml)) runs on pushes, main/develop PRs and manual dispatch.

| Job / context to require | Checks |
| --- | --- |
| Detect stack | Select storage/bootstrap scope from the diff |
| Python tests | Locked install, Ruff, **40 P0** cases, traceability, focused provider/CLI and affected storage/bootstrap checks, health/serving/session boundaries |
| PostgreSQL 18 integration | `postgres:18`, authenticated integration and native dump/restore with major-18 clients, zero DB skips |
| Node build and tests | `npm ci`, ESLint, **54 focused provider/navigation/onboarding UI cases**, TypeScript/production build and T07's **18** acceptance-verifier cases. Full optional suites are not required by this pipeline |
| No secrets committed | Credential patterns and forbidden artifacts |

| Evidence | Actual result |
| --- | --- |
| Main CI at verification | Run [43062004407](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/43062004407), `80b15f7`, success, **87 seconds** (16:48:53–16:50:20 UTC). All five jobs passed. [Latest main runs](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/workflows/ci.yml?query=branch%3Amain) must be checked again after a subsequent merge |
| Effective rules API | [Fresh read-only check](evidence/m5-post-mobile/process-check.json): PR, deletion and non-fast-forward rules are returned; no required-status-check entry is returned. The earlier snapshot records one required approval. Admin must confirm/configure CI enforcement; complete protection is not certified |
| Admin action/screenshot | **Still required for M5:** admin confirms/enforces the five contexts plus PR/approval and supplies an authentic settings screenshot. The PO has no admin access; this is an external admin dependency, not an exemption. [Permission evidence](evidence/s5-c02/nonadmin-protection-check.json). C02 closure does not certify this requirement; API JSON is not the screenshot |
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

Historical acc4924 post-deploy observations: 13:45–13:50 UTC had 101 completions (71 health),
0 five-hundreds, p95 408.67 ms; 13:50–13:55 had 70/70 health, 0 five-hundreds,
p95 99.85 ms. [All-page, deduplicated samples](evidence/s5-c02/monitoring.json)
measure app processing, not user-load performance or uptime. Repeat after a new
candidate; preserve the old f24 series as history.

For the historical acc4924 candidate, a health response request ID matched Render's GET /health HTTP 200 at
25.89 ms app time; [correlation](evidence/s5-c02/health-correlation.json). That candidate's
public probes passed 14/14 read-only and 8/8 fresh-account scenarios; Kiet separately
reported phone/private-laptop OK. [Historical acceptance](s5-c02-wrap-up.md#final-technical-acceptance-and-user-reported-device-check).

Current **80b15f7** post-deploy window, **16:53:04–16:58:04 UTC**:
118 completed requests, 71 health, 7 four-hundreds and 0 five-hundreds;
server error rate **0%**, app p50 **30.52 ms**, p95 **698.30 ms**, max **1855.45 ms**.
Both pages were fetched and request IDs deduplicated. This includes health and
read-only verifier traffic; it is not a load benchmark or uptime guarantee.
[Redacted samples and calculation](evidence/m5-post-mobile/monitoring.json).

Fresh public checks on the current deployment: **14/14 read-only checks pass**,
plus **6/6 deployed mobile-navigation checks** (375px emulation, header 69px,
guest destinations, light theme, focus/Escape and protected-route handoff).
Health confirms DB connected/head `d9a6f2c1e508`; public regional checks cover
US/GB/SG. These checks do not claim fresh authenticated write journeys, physical
phone acceptance, PO acceptance or YouTube playback availability.
[Reports and screenshots](evidence/m5-post-mobile/README.md).

## 4. Risks and technical debt

| Item | Layer | What could happen | Plan |
| --- | --- | --- | --- |
| Future code/schema skew | infrastructure | An incompatible deploy or rollback breaks exact-head health | Accepted with coordinated backup/migration/deploy and identity checks; 80b15f7 public health/head and regional APIs are verified |
| Release tag drift | docs | The version opened by the instructor differs from v1.0 | [C02 #256](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/256) release follow-up: reconcile Live 80b15f7 and v1.0, record the prior target, and verify both before submission |
| Required checks not evidenced | infrastructure | A red candidate could merge | Admin configuration and authentic screenshot: [#250](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/250), C02 audit |
| Local-only backups | data | Disk loss leaves no durable recovery copy | [C02 #256/R06](s5-c02-wrap-up.md#remaining-c02-gates-and-named-next-actions) owns durable destination/access/daily retention and independent reproduction; T06 is Closed as technical delivery |
| Free sleep/ephemeral index | infrastructure | Slow first request; index rebuilt after replacement | Accepted: free hosting is the agreed scope; disclose, check before demos and rebuild derived state |
| Shared Neon quota | infrastructure | Heavy jobs affect runtime capacity | Accepted: separate databases, quota checks and quiet import/test windows |
| TMDb regional gaps | data | A selected market has no provider/link information | Accepted: neutral unknown wording, exact-market nullable link and attribution; development coverage is not public acceptance |
| Manual monitoring | infrastructure | Incidents between daily checks may be missed | Accepted for this free-plan scope: named owner/backup and incident escalation |
| Test automation is not a phone/PO decision | tests | Emulation or green CI is mistaken for full acceptance | Accepted: retain the [acc4924 human report](evidence/s5-c02/human-device-report.json); repeat affected human checks and PO acceptance for 80b15f7. Team presentation is separate from C02 |

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
