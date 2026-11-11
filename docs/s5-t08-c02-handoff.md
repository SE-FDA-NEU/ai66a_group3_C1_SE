# S5-T08 handoff to C02: release readiness and manual submission

From [T08 #255](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/255),
@vu-huzy, to SM5 @kietxuan, [C02 #256](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/256).
Historical T08 baseline **11 November 2026**: main `50aa9ad4fccc63f5d7ef8186bb296ed12f0d18ee`;
public then ran `f24ef54699efb2fa26f363107bd31401f9b12e58`.
**Current C02:** T07/T08 are merged/Closed; acc4924 is Live, migrated and regional
data is populated. See [current wrap-up/evidence](s5-c02-wrap-up.md).
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

## Closure boundary approved by the PO — 11 November 2026

T07 #254 closes through reviewed PR #265 when its acceptance tooling, technical
evidence and execution checklist are merged. T08 #255 closes through reviewed
PR #264 when its monitoring baseline, reconciled documents and release handoff
are merged. Both PRs still require green checks and a substantive formal
pre-merge approval from another eligible member. Neither closure certifies the
future public candidate or completion of Milestone 5.

C02 #256 explicitly accepts ownership of every unexecuted release/operational
and human-acceptance item below. The original T07/T08 final-public requirements
are retained as C02 acceptance criteria, not dropped or marked as passed. No new
issue is created. T07/T08 owners continue assisting their assigned checks under
C02; SM5 is accountable for the final evidence and closure.

## Still required before C02 closure/submission

| Pending item | Owner and next action |
| --- | --- |
| Regional public rollout and final acceptance | C02/SM5 coordinates Render @anotify-vie + Neon @NguyenTuanAnh0608: frozen green-main release, actual deployed SHA/head/PostgreSQL 18, per-country US/GB/SG data, all six P0s and affected regional/media/account journeys, real phone/private-laptop checks, five-person rehearsal and PO decision. Execute the checklist supplied by T07; T07 closure is not a pass for these items |
| Effective branch protection and authentic screenshot | Repository admin adds the five required CI contexts plus PR/approval, verifies enforcement and captures the actual settings screen. [Current API snapshot](evidence/s5-t08-operations/github-protection.json) is evidence of the gap, not a substitute screenshot |
| Durable recovery handoff | @hoang3003 / @NguyenTuanAnh0608: private durable destination, actual shared access, daily execution/retention and independent reproduction. A locally restored backup is not those items |
| Final-candidate monitoring | @vu-huzy / @kietxuan post-deploy windows are recorded in C02; repeat/correlate after any subsequent candidate and retain f24 as history |
| C02 final facts | SM5 records Review/Retro, accepted outcomes/contributions, ≥4 reviewed green merged S5 PRs, each member's merged PR/review/closed issue, committed/completed/velocity and the five-Sprint table |
| Release/submission | SM5 binds exact live SHA/green CI/v1.0, exports/submits manually and records a real receipt in #256 |

The six enumerated sections are implemented; the brief's seven-versus-six typo
remains tracked, without inventing a seventh section. Extend retention when the
grade-publication date becomes known; that future date is not fabricated.
The authentic protection screenshot must be incorporated into operations.md by
a reviewed C02 documentation update before C02 closure; it is still missing.
Final post-deploy observations may be recorded in C02's dated completion comment,
with a direct link from the baseline operations record. Any required source/doc
fix still receives review and green CI; it is not hidden in an issue comment.

## One-batch release plan

**Historical heading retained for existing links; the PO has superseded the
one-deploy restriction.** The selected workflow is now deploy first, collect
actual evidence, then finish reviewed C02 documentation. Further reviewed fixes
and deployments are allowed. The earlier plan is preserved in the T08 source
at acc4924, not treated as current instructions.

1. T07 #265 and T08 #264 are merged; their delivery issues are Closed. C02's PR
   keeps **Refs #256** while actual final gates remain outstanding.
2. Running acc4924, current health/schema and full-catalogue regional data are
   verified in [C02](s5-c02-wrap-up.md). The source is not yet tagged v1.0.
3. Complete actual public P0/accepted-feature/device/demo/PO checks, protection
   screenshot and durable recovery handoff. Review/merge C02's evidence/docs;
   retain Pending for anything not performed. No invented receipt or meeting.
4. Render remains After CI Checks Pass. A docs-only merge may use `[skip render]`
   in its actual merge/squash message to retain the running app; verify the skip.
   Keep CI enabled. If allowing another deploy, verify that new Live SHA and
   affected health/acceptance instead. No platform setting is changed here.
5. Track running app SHA and green CI separately from latest documentation-main
   SHA/CI. Tag v1.0 on the accepted running main commit, not blindly on a newer
   docs-only commit. Never silently move an already-published tag.
6. Export/submit the PDF manually with actual release/CI links. Link final
   acceptance, Review/Retro, metrics/member/protection/recovery/maintenance and
   LMS receipt in #256's completion comment. Close C02 manually only when done.

Full [release policy](s5-c02-wrap-up.md#deploy-first-document-afterward--po-amendment)
and [remaining R01–R09](s5-c02-wrap-up.md#remaining-c02-gates-and-named-next-actions)
replace the old merge-wrap-up-before-deploy constraint. No PDF/export tool is
added and this documentation PR performs no production changes.

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
| Final deployed SHA / matching green CI | Current acc4924/deploy dep-dbq71cvf3r2c73e7g890 and CI 43025094939 are verified; final PO/release selection remains Pending. Record later docs-main SHA separately |
| Release v1.0 | [Intended release URL](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/releases/tag/v1.0), **not created/verified yet** |
| Test accounts | See the first screen of README; shared app-only demo login was verified |
| Submitted by | Nguyen Xuan Kiet, planned SM5 submitter; record actual submission |
| PDF / date / receipt | `Team03_M5.pdf`; actual export date and LMS receipt pending; no PDF/tools committed |

Keep the service until at least **12 December 2026**, one calendar month after
actual v1.0, and grade publication, whichever is latest. @kietxuan owns retention,
@anotify-vie is backup. This is the maintenance commitment, not an execution log.
