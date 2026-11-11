# S5-T08 handoff to C02: M5 manual submission and release checklist

From S5-T08 [#255](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/255)
(@vu-huzy) to S5-C02 [#256](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/256)
(@kietxuan). State as of **11 November 2026** on main
`50aa9ad4fccc63f5d7ef8186bb296ed12f0d18ee`. The PDF and LMS submission are manual.
No PDF, export tool, generated PDF or receipt is stored in Git, and none is claimed here.

## What T08 supplies

| Deliverable | Where |
| --- | --- |
| Operations (deployment, CI, monitoring, risks, maintenance, lessons) | [operations.md](operations.md) |
| README first screen: URL, CI badge, six P0 journeys, team, SM5 | [README](../README.md) |
| Portable PostgreSQL 18 / Neon / Render setup | [SETUP](SETUP.md#postgresql-18-neon-and-render-public-runtime) |
| Reconciled Sprint 5 scope, dependencies and history | [Planning](sprint5-backlog-refinement.md#current-scope-and-delivery-map-amended-7-8-and-10-november-2026), [sprint log](sprint-log.md) |
| Regional providers current design | [design section 13](design.md#13-sprint-5-amendment-postgresql-18-regional-providers-and-the-tmdb-action), [architecture section 10](architecture.md#10-sprint-5-amendment-public-runtime-and-regional-providers) |

## Open items that block a truthful M5 submission

Each row is **Not done** until its owner records real evidence. T08 did not create or
simulate any of it.

| Open item | Owner | Where it must be recorded |
| --- | --- | --- |
| Public runtime still reports schema `a3d1f8b72c44`; regional migration, matching deployment and US/GB/SG enrichment on the public database | Operators: Render @anotify-vie, Neon @NguyenTuanAnh0608; T07 verifies | [operations section 1](operations.md#1-deployment-and-release), T07 [#254](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/254) |
| Render Deploy Details SHA equal to the green main run's head SHA | @anotify-vie, @kietxuan | operations section 1 |
| Effective main protection with required status checks, stale-review dismissal, and an authentic admin screenshot | Repository administrator | operations section 2 |
| Error-rate and response-time observations over explicit intervals, plus log-side request-ID correlation, from Render Logs | @vu-huzy, @kietxuan | operations section 3 |
| Durable private backup storage, daily execution, seven-copy retention and independent reproduction | @hoang3003, @NguyenTuanAnh0608 | [T06 evidence](evidence/s5-t06-recovery/README.md#remaining-closure-work) |
| PO-approved public application-only review accounts for the README | @kietxuan | README first screen |
| Instructor clarification of the seven-versus-six sections, and the grade-publication date | @kietxuan | operations header and maintenance date |
| Non-contributing reviewer's substantive approval of the T08 PR | @hoang3003 (coordinator) or another non-contributor | the PR |

## Release order (from the Sprint 5 Planning)

Tick each box only with real evidence.

- [ ] T07 public acceptance merged, with the deployed candidate SHA recorded
- [ ] T08 documentation PR approved by a non-contributor and merged
- [ ] C02 wrap-up PR merged (it uses `Refs #256` while external steps remain)
- [ ] Green push-to-main CI run on that merge commit (record the run URL and duration)
- [ ] Render deployment of exactly that SHA, matching `/health` head and a public smoke check
- [ ] `v1.0` tag and release created on the same SHA
- [ ] `Team03_M5.pdf` exported manually from the final documents (not committed)
- [ ] LMS submission made manually and the receipt recorded by C02
- [ ] Maintenance date confirmed: at least 12 December 2026, one month after the actual v1.0 date, and until grades are published

## Manual submission block (for C02 to fill from real results)

| Field | Value |
| --- | --- |
| Team and topic | Team 03, AI Movie Recommendation System (members in the [README](../README.md)) |
| Public URL | <https://cineai-o9tf.onrender.com/> |
| Deployed commit SHA | to be recorded from Render Deploy Details |
| Matching green main CI run | to be recorded |
| `v1.0` tag target | to be recorded; must equal the deployed SHA |
| Evidence set | [operations](operations.md), [recovery](evidence/s5-t06-recovery/README.md), [regional providers](evidence/s5-t04-providers/regional-2026-11-10.md), [regional UI](evidence/s5-t05-regional-ui.md), T07 results |
| PDF file name and export date | `Team03_M5.pdf`, to be recorded |
| LMS submission receipt | to be recorded after the real submission |
