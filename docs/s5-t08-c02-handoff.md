# S5-T08 handoff to C02: release readiness and manual submission

From [T08 #255](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/255),
@vu-huzy, to SM5 @kietxuan, [C02 #256](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/256).
Baseline **11 November 2026**: main `50aa9ad4fccc63f5d7ef8186bb296ed12f0d18ee`;
public Render runs `f24ef54699efb2fa26f363107bd31401f9b12e58`.
No final acceptance, release, rehearsal, PDF or LMS receipt is invented. PDF/LMS
work is manual; no export tooling or submission PDF is added to Git.

## Supplied and verified

| Deliverable | Source/result |
| --- | --- |
| Operations | [operations.md](operations.md): six enumerated M5 sections, real monitoring windows, risks, maintenance, lessons |
| README first screen | [README](../README.md): live URL, CI badge, PO-approved working public demo account, six P0 starts, all members and SM5 |
| Portable setup | [SETUP](SETUP.md#postgresql-18-neon-and-render-public-runtime): PostgreSQL 18/TLS, 50-page initial import, whole-catalogue enrichment, mode-specific resume, account, UTF8, index/recovery/tests |
| Real Render state | [Observations](evidence/s5-t08-operations/observations.json): correct service/workspace, live SHA/deploy ID, Free/Singapore/main/health and After CI Checks Pass verified read-only |
| Monitoring/account | Two complete log windows (220 and 106 requests; zero 5xx), route-independent baseline p95 and correlated health ID; public demo login/session/logout/refusal pass |
| Scope/contracts | [Planning](sprint5-backlog-refinement.md#current-scope-and-delivery-map-amended-7-8-and-10-november-2026), [log](sprint-log.md), [design section 13](design.md#13-sprint-5-amendment-postgresql-18-regional-providers-and-the-tmdb-action), [architecture section 10](architecture.md#10-sprint-5-amendment-public-runtime-and-regional-providers) |
| T07 technical handoff | [PR #265](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/265): 989-real-movie local run, actual public account journeys, mutation red/restored-green, screenshots and human-acceptance checklist. The PR is not final public acceptance |

## Still required before closure/submission

| Pending item | Owner and next action |
| --- | --- |
| Regional public rollout and T07 final acceptance | Render @anotify-vie + Neon @NguyenTuanAnh0608 coordinate the frozen green-main release; T07 records actual deployed SHA, US/GB/SG data, all affected public journeys, real phone/private-laptop checks, rehearsal and PO decision |
| Effective branch protection and authentic screenshot | Repository admin adds the five required CI contexts plus PR/approval, verifies enforcement and captures the actual settings screen. [Current API snapshot](evidence/s5-t08-operations/github-protection.json) is evidence of the gap, not a substitute screenshot |
| Durable recovery handoff | @hoang3003 / @NguyenTuanAnh0608: private durable destination, actual shared access, daily execution/retention and independent reproduction. A locally restored backup is not those items |
| Final-candidate monitoring | @vu-huzy / @kietxuan repeat windows/correlation after rollout; current baseline is from f24, not the future regional candidate |
| Eligible formal T08 review | @hoang3003 coordinates a substantive Review changes + approval from a non-contributor. Do not count short approval text or an author/contributor's own verification |
| C02 final facts | SM5 records Review/Retro, accepted outcomes/contributions, ≥4 reviewed green merged S5 PRs, each member's merged PR/review/closed issue, committed/completed/velocity and the five-Sprint table |
| Release/submission | SM5 binds exact live SHA/green CI/v1.0, exports/submits manually and records a real receipt in #256 |

The six enumerated sections are implemented; the brief's seven-versus-six typo
remains tracked, without inventing a seventh section. Extend retention when the
grade-publication date becomes known; that future date is not fabricated.

## One-batch release plan

The PO deferred all production deploy/migration/enrichment on 11 November and
wants preparation complete before one **Manual Deploy → Deploy latest commit**.
This is an intended rollout, not an assertion that the issue acceptance can be
finished before a new public version exists. Nothing in this T08 PR changes
Render settings, migrations or the public catalogue.

1. Finish and independently review implementation/readiness PRs. Merge partial
   T07/T08/C02 documentation using **Refs**, retaining truthful pending items.
   Their final public/external gates stay open. Do not turn pending results into
   "done" to prepare a merge.
2. Render is still **After CI Checks Pass**, so ordinary main merges may auto
   deploy. For the agreed batching hold, put the documented **`[skip render]`**
   phrase in each actual main merge/squash commit message (not merely a PR body),
   then verify the skipped event. GitHub CI must still run. This is documented
   [Render behaviour](https://render.com/docs/deploys#skipping-an-auto-deploy);
   no auto-deploy toggle is performed by this PR. Do not replace the gate with
   On Commit or claim an unverified bypass is safe.
3. Before selecting the release SHA, merge the reviewed wrap-up documents as C02
   requires. Freeze that main commit, verify its **latest ci.yml is green** and
   confirm the actual Render source/settings. The final SHA may differ from this
   baseline; do not hard-code `50aa9ad4` as the future release.
4. In the agreed window, take a **new** consistent backup and verify the target,
   role, PostgreSQL 18 and restore path. Coordinate the matching deploy,
   migrations/grants and exact-head health; a temporary 503 is possible while
   versions differ. The button does not run migrations or TMDb enrichment.
   After **live + healthy**, enrich the existing active catalogue for US/GB/SG;
   do not run a new 50-page import solely to add provider data.
5. Run the final public T07 journeys/phone/rehearsal/PO and T08 monitoring checks.
   Record actual results and handoffs before closing their issues. C02's
   explicit post-merge completion comment records the deployment/tag/submission
   facts; code/repo documents remain a dated pre-release baseline until a
   verified update is made.
6. Verify **running SHA = selected green-main SHA = v1.0 target**. Create the tag
   on that verified deployed commit, export the manual PDF with actual links,
   submit and record the receipt. Close #256 manually only when all its gates
   are fulfilled. No tag or date is supplied in advance.
7. If acceptance exposes a code/document defect, fix/review it and obtain fresh
   CI and whatever subsequent deployment is required. One click is a preference,
   not a reason to accept a failing release or tag a different, unserved commit.
   C02 forbids silently moving the demonstrated version; do not assume a later
   main documentation commit is the SHA currently running.

T07 does not depend on T08's final dossier. Preparation can merge without
closing either issue, so the plan avoids a circular "close all → deploy → prove
closure" dependency. If a reviewer requires final observations in repository
files rather than the allowed completion record, make that update truthfully
and recheck the exact-SHA release rule; do not promise a single deploy regardless
of what final acceptance finds.

## Manual submission block

Fill the **actual** release/CI fields after the frozen candidate is live. The
following team/role values are already confirmed; submission itself is not.

| Field | Value |
| --- | --- |
| Running app (first line) | <https://cineai-o9tf.onrender.com/> |
| Team / topic | Team 03 — CineAI; AI Movie Recommendation System |
| Members | Nguyen Xuan Kiet (11247306); Tran Minh Hoang (11247292); Tran Tuan Anh (11247264); Vu Quoc Huy (11247301); Nguyen Tuan Anh (11247260) |
| Product Owner / SM5 | @kietxuan / @kietxuan |
| Repository | [SE-FDA-NEU/ai66a_group3_C1_SE](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE) |
| Setup | [docs/SETUP.md on main](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/blob/main/docs/SETUP.md) |
| Final deployed SHA / matching green CI | Pending final release; do not substitute the old f24 deployment or a PR-only CI run |
| Release v1.0 | [Intended release URL](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/releases/tag/v1.0), **not created/verified yet** |
| Test accounts | See the first screen of README; shared app-only demo login was verified |
| Submitted by | Nguyen Xuan Kiet, planned SM5 submitter; record actual submission |
| PDF / date / receipt | `Team03_M5.pdf`; actual export date and LMS receipt pending; no PDF/tools committed |

Keep the service until at least **12 December 2026**, one calendar month after
actual v1.0, and grade publication, whichever is latest. @kietxuan owns retention,
@anotify-vie is backup. This is the maintenance commitment, not an execution log.
