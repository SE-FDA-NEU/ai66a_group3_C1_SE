# Sprint 5 wrap-up and M5 release completion

Owner/PO/SM5: **@kietxuan**, [C02 #256](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/256).
Sprint: **5–12 November 2026**; Planning **6 November**, all five members,
two accepted issues each (PO-confirmed C01). This is a **partial completion
record**, not PO acceptance, a finished retrospective, a release or an LMS receipt.
The PR uses **Refs #256**, never automatic closure.

## Verified delivery and source identity

| Item | Observation on 11 November 2026 |
| --- | --- |
| Running app | <https://cineai-o9tf.onrender.com/> |
| Verified Render deployment | `dep-dbq71cvf3r2c73e7g890`, live 13:43:59 UTC / 20:43:59 UTC+7; manual; Free, Singapore, correct My Workspace/group-03 repository |
| Running application source | `acc49243e4db404438b00521c2f7a6234377fb18` (merged T08 #264) |
| Green main CI for that source | [43025094939](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/43025094939), completed success; 81 seconds wall time |
| Database | Neon PostgreSQL 18.6; head `d9a6f2c1e508`; 989 active actual TMDb movies |
| Readiness | Public health HTTP 200, database connected, correct schema; real regional Details APIs HTTP 200 for US/GB/SG |
| Migration/recovery preparation | Codex ran the requested two migrations after a fresh consistent backup was restored and matched all 11 pre-change tables. Direct `cineai_runtime` queries read all 12 required application tables; Alembic check found no additional operations. This is not an independent teammate rehearsal or a durable shared backup |
| Delivery throughput | C01 and T01–T08: 9/10 work issues Closed, 9 merged PRs #257–#265; C02 remains Open |
| Product points | Committed 0 / completed 0 / velocity 0 new Story Points; release Tasks/Chores have no points. Do not recount already-delivered product Stories |
| Release/submission | v1.0 not present at the GitHub observation; manual PDF and LMS receipt Pending |

Sources: [Render](evidence/s5-c02/render.json), [runtime](evidence/s5-c02/runtime.json),
[GitHub](evidence/s5-c02/github.json), [operations](operations.md).
The user's report that deployment/availability now works is corroborated by
these independent read-only API/database observations, but not a full UI/device test.
No production write, import, migration or deploy was performed while preparing
this documentation PR. Earlier migration/import actions remain dated separately.

## Regional data actually present

| Country | Movies with data / valid link | Checked, no data | Total checked | Provider memberships |
| --- | ---: | ---: | ---: | ---: |
| US | 904 | 85 | 989 | 11,278 |
| GB | 859 | 130 | 989 | 8,728 |
| SG | 706 | 283 | 989 | 1,459 |
| Total movie-country checks | 2,469 | 498 | 2,967 | 21,465 |

No error/stale/unattempted active-movie pairs were found in this snapshot.
Counts are not interchangeable: 989 movies, 2,967 region checks and 21,465
memberships; this read does not reconstruct the operator CLI's HTTP attempts.
No-data means TMDb did not supply viewing availability for that region, not
that no legal viewing option exists. No provider subscription/playback is claimed.
Three same-movie public DTO samples return success, expected country/provider
groups and matching TMDb movie 953 watch URLs with locale US, GB or SG. The current public probe also passes 14/14 read-only checks, including safe
popup/retained context, selector persistence and mobile emulation; full
authenticated journeys, race edge states and real-device acceptance remain
in the T07 checklist. [Current probe](evidence/s5-c02/c02-public-probe.json).

## Contribution and review audit

The following are recorded GitHub activities, not an assertion that a PR owner
personally authored every follow-up line. Both NguyenTuanAnh0608 and TuanAnh0608
identify Nguyen Tuan Anh, as the PO previously confirmed. Each person has an
owned merged PR, a formal review on another member's PR and a closed assigned issue.

| Member | Owned merged PR(s) | Formal review given on another member's PR | Closed assigned issue(s) |
| --- | --- | --- | --- |
| @kietxuan | [257](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/257) | [258](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/258), [259](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/259), [260](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/260), [261](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/261), [262](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/262), [263](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/263), [264](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/264), [265](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/265) | [#247](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/247) |
| @hoang3003 | [258](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/258), [262](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/262) | [257](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/257), [259](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/259), [260](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/260), [261](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/261), [263](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/263), [264](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/264), [265](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/265) | [#248](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/248), [#253](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/253) |
| @anotify-vie | [260](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/260), [261](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/261) | [258](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/258), [259](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/259), [262](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/262), [263](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/263) | [#250](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/250), [#251](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/251) |
| @vu-huzy | [263](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/263), [264](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/264) | [257](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/257), [258](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/258), [259](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/259), [260](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/260), [261](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/261), [262](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/262) | [#252](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/252), [#255](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/255) |
| @NguyenTuanAnh0608 | [259](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/259), [265](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/265) | [260](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/260), [264](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/264) | [#249](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/249), [#254](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/254) |

### Pre-merge approval audit

| PR | Owner | Head CI | Another member's pre-merge approval | Non-contributor approval on final head |
| --- | --- | --- | --- | --- |
| [257](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/257) | @kietxuan | green | @hoang3003 | yes; short text does not prove substance |
| [258](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/258) | @hoang3003 | green | @kietxuan | yes; short text does not prove substance |
| [259](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/259) | @NguyenTuanAnh0608 | green | @hoang3003 | not evidenced |
| [260](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/260) | @anotify-vie | green | @kietxuan, @vu-huzy | yes; short text does not prove substance |
| [261](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/261) | @anotify-vie | green | @vu-huzy, @kietxuan | not evidenced |
| [262](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/262) | @hoang3003 | green | @kietxuan, @vu-huzy | yes; short text does not prove substance |
| [263](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/263) | @vu-huzy | green | @kietxuan | not evidenced |
| [264](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/264) | @vu-huzy | green | @kietxuan, @hoang3003, @NguyenTuanAnh0608 | not evidenced |
| [265](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/265) | @NguyenTuanAnh0608 | green | @kietxuan, @hoang3003 | not evidenced |

All nine have green head CI and another member's pre-merge approval at some
revision. Several approvals are only `ok`/`oke`, target an older head, or come
from a contributor. That is **not** proof of substantive independent review of
the final change. This table audits formal facts without retroactively fixing
history. For this C02 operations/README follow-up, an eligible non-contributor
must use **Review changes**, leave a real comment about the actual change and
approve the final reviewed version before merge. C02 cannot certify all review
requirements merely because GitHub's metadata check is green.

## Current monitoring

Render app request-completion logs were fetched through every page, request IDs
deduplicated, and only status/latency/health flags retained. No IP, cookie, token,
account identifier, user URL or body is committed.

| Window UTC / UTC+7, 11 November | Requests / health | 4xx / 5xx | 5xx rate | p50 / p95 / max ms |
| --- | --- | --- | --- | --- |
| 13:45–13:50 / 20:45–20:50 | 101 / 71 | 0 / 0 | 0% | 38.26 / 408.67 / 900.37 |
| 13:50–13:55 / 20:50–20:55 | 70 / 70 | 0 / 0 | 0% | 38.52 / 99.85 / 280.52 |

These post-deploy windows measure app time; the second is entirely health
traffic, not user-load performance. Quantiles use nearest rank ceil(n*p)-1;
5xx rate = server errors / completed requests. They prove neither continuous
uptime nor an SLO. [Samples and pagination](evidence/s5-c02/monitoring.json)
reproduce the measurements. Earlier T08/f24 windows remain historical.

## Remaining C02 gates and named next actions

| Gate | Current evidence / remaining work | Owner/helper | State |
| --- | --- | --- | --- |
| R01 rollout/data | Live source, health, schema and all three-country coverage verified; retain fresh backups and final-source identity | SM5; Tran Tuan Anh / Nguyen Tuan Anh | Technical evidence supplied |
| R02 full public acceptance | Re-run all six P0 and accepted Search/Similar/rating/Watchlist/reset/filter/page/return/media/region journeys on the selected final candidate; record real refusal/persistence/isolation and defects | Nguyen Tuan Anh, PO | Pending |
| R03 devices/PO | Real phone + private laptop, named device/browser/tester/date/SHA; actual PO decision. Emulation and user report are not this evidence | PO + testers | Pending |
| R04 demo | Actual five-person 12-minute rehearsal, timing/problems/fixes; normal/refusal/boundaries + local mutation/restore; before/after UI, pipeline/design/lesson/risk | All members | Pending |
| R05 protection/review | Effective rules currently show PR+1 approval but no required-status-check entry; admin confirms/enforces five CI contexts and supplies authentic settings screenshot for operations.md. C02 needs substantive independent pre-merge approval | Repository admin; eligible reviewer | Pending |
| R06 durable recovery | Private shared durable destination, primary/backup access, daily backup/seven successful copies and independent restore reproduction. Local verified archive is only partial evidence | Hoang / Nguyen Tuan Anh | Pending |
| R07 monitoring | Two complete post-deploy windows supplied; continue detection/response and retain incident/request correlation. Re-observe if the deployed candidate changes | Huy / Kiet | Baseline supplied; ongoing |
| R08 wrap-up | Nine delivery issues/PRs and each member's formal activity audited; real Review/Retro date/attendance/feedback, agreed improvement/owner and maintenance acknowledgement still missing | SM5 + all members | Partial |
| R09 release/submission | Verify final live SHA/green CI; create v1.0 with three content lines; manual Team03_M5.pdf and genuine LMS receipt; retention through grades and agreed minimum | SM5 | Pending |

Execution: [T07 C02 checklist](evidence/s5-t07/completion-checklist.md),
[T08 handoff](s5-t08-c02-handoff.md), [manual submission block](s5-t08-c02-handoff.md#manual-submission-block).
No future physical-device test, meeting, independent restore, screenshot or
submission is invented. No generated PDF or export tool is in this PR.

## Deploy first, document afterward — PO amendment

The PO explicitly removed the one-deploy restriction and requested deploying
first to obtain real C02 evidence. That supersedes the prior merge-wrap-up-first
and single-window hold; no additional work issue is created.

1. Deploy a reviewed main commit only after its CI is green; coordinate compatible
   backup/migration/grants. The observed acc4924 deployment is an actual baseline,
   not automatically the final release.
2. Gather acceptance/monitoring evidence, write C02 docs, independently review
   and merge this **Refs #256** PR. Additional reviewed fixes/deploys are allowed.
3. For a documentation-only merge that should retain the running app, include
   `[skip render]` in the actual merge/squash commit; do not use `[skip ci]`.
   Alternatively allow a normal after-CI deploy, then verify its new live SHA.
   This PR changes no platform configuration and triggers no manual deploy.
4. Record **running application SHA**, **latest documentation-main SHA** and each
   matching CI link separately. They can differ after a docs-only skip. Tag v1.0
   on the verified running application commit reachable from main, not blindly
   on the newest documentation commit. If a later deploy changes the app, rerun
   affected acceptance and choose that final candidate before tagging.
5. Reconcile every remaining gate using actual evidence. Submit the manual PDF
   with real app/release/CI/README links; record a completion comment on #256 and
   close it manually only when all requirements pass.

Do not retag an already-published release to conceal an unverified deployment.
If a source/doc change is needed after selection, use review/green CI and explicit
release verification. The source running at the URL must equal the v1.0 target.

## Review/Retro and maintenance receipt to complete

| Record | Required actual value |
| --- | --- |
| Sprint Review | Pending date/time, participants, actual PO AC/DoD decision and feedback |
| Retrospective | Pending date/time, what happened, agreed improvement, named owner/due date |
| Maintenance handoff | Pending primary/backup acknowledgement of access, monitoring/backup schedule and incident/retention duties |
| Retention | Kiet primary, Tran Tuan Anh backup; keep online through the latest of grade publication, 12 December 2026 and one calendar month after actual v1.0. Grade date not announced |
| Final release | Pending actual deploy/SHA/health/CI/tag link; retain current dated baseline above |
| Submission | Pending manual Team03_M5.pdf export/submission date and real receipt; no PDF/tool in Git |

## Completion comment template (manual, after the work)

Fill actual values only: running SHA/deploy and health; documentation-main SHA
and latest green CI; v1.0 target/release link; final P0/devices/PO/demo results;
Review/Retro/action/maintenance acknowledgements; protection screenshot/reviewer;
durable recovery receipt; manual PDF/LMS submission receipt. Link resolved
R01–R09 and note any genuine accepted risk. Then close #256 manually. A merged
preparation PR alone does not close Sprint 5.
