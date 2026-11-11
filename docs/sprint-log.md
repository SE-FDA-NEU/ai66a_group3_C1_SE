# Sprint log

This log records only facts supported by the repository, Git history, and the
saved Project-board evidence. Meeting details that are not present in those
sources are marked as not recorded rather than reconstructed as facts.

Current: [Sprint 5 Planning](#sprint-5---2026-11-05-to-2026-11-12).

---

## Sprint 1 - repository activity recorded 2026-09-08 to 2026-09-20

**Official Sprint dates:** Not recorded in the repository.

**Sprint Planning date:** Not recorded in the repository.

### Sprint goal

Prepare an evidence-backed and internally consistent M1 requirements baseline,
product backlog, traceability model, and repository process foundation for the
development sprints.

This sentence summarizes the five committed Chore objectives. The exact wording
used by the team during Sprint Planning is not recorded in the repository.

### Committed work

The repository's refinement decision commits C01-C05 to the Sprint 1
requirements sprint. Product Stories, including S04, remain in the product
backlog and are not counted as Sprint 1 committed development work.

| Issue     | Committed work                                                            | Points | Owner                                  |
| --------- | ------------------------------------------------------------------------- | -----: | -------------------------------------- |
| #11 / C01 | Refine Sprint 1 backlog                                                   |      - | Nguyen Xuan Kiet (`@kietxuan`)         |
| #12 / C02 | Complete Sprint 1 wrap-up                                                 |      - | Tran Minh Hoang (`@hoang3003`)         |
| #13 / C03 | Collect user-research evidence and complete personas and scenarios        |      - | Tran Tuan Anh (`@anotify-vie`)         |
| #14 / C04 | Complete the M1 requirements dossier and traceability                     |      - | Vu Quoc Huy (`@vu-huzy`)               |
| #15 / C05 | Review repository readiness, business rules, routes, and team information |      - | Nguyen Tuan Anh (`@NguyenTuanAnh0608`) |

**Total committed:** 5 Chores, 0 Story Points. Chores and Spikes are not assigned
Story Points under the team's backlog-refinement rule.

### Result

| Issue     | Points | Status as of 2026-09-19 | Actual result / remaining work                                                                                  |
| --------- | -----: | ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| #11 / C01 |      - | Done                    | The refined backlog and scope were merged through PRs #27 and #34.                                              |
| #12 / C02 |      - | Done                    | Sprint 1 results, status, evidence, and wrap-up information were consolidated in this Sprint log.               |
| #13 / C03 |      - | Done                    | User research, personas, and scenarios were merged through PRs #26 and #35.                                     |
| #14 / C04 |      - | Done                    | Requirements, screen flow, and traceability work were merged through PRs #28, #38, and #39.                     |
| #15 / C05 |      - | Done                    | Repository readiness, business rules, README, routes, and team information were merged through PRs #36 and #40. |

**GitHub closed count:** 5 of 5 committed Chores. This is a status count, not
verified completion of every checklist; C02 evidence remains unverified below.

**Unverified completion evidence:** C02 is closed, but retrospective, improvement
owner/action, attendance/review details and final snapshot are not fully supported
by the files below. Closed status alone does not prove checklist completion.

**Velocity:** 0 Story Points. The completed Sprint 1 work consists of Chores,
which have no Story Point estimates. S04's 5-point estimate is not counted
because refining its requirements does not make the product Story Done.

### Sprint tracking

#### Blockers and delays

- No blocker or delay is documented in the repository. This does not assert
  that none occurred; it records that no evidence of one is available.
- C02 was completed when the Sprint 1 results and evidence were consolidated
  into this log.

#### Scope and backlog changes

- S06 was promoted from P1 to P0.
- S05 was separated into S05a (save optional feedback) and S05b (use ratings in
  recommendation ranking).
- S08-S11 were added, bringing the product backlog to 12 Stories.
- S12 Register an account and S13 Sign in and sign out securely were later
  added as explicit course requirements, bringing the final M1 backlog to 14
  Stories and 54 points.
- The final account refinement assigns S01-S04, S12, and S13 to P0; S06 is P1
  so the product stays within the required maximum of six P0 Stories.
- S04 was refined to show at most 10 non-personalised popular movies, ordered by
  popularity descending and title A-Z for equal scores, with a visible action
  to choose genres.
- Mood-based discovery remained outside the MVP pending data-source evidence
  and testable acceptance criteria.

#### Carried-over and unresolved items

- None of the five committed Sprint 1 Chores was carried over.
- The historical board image shows #16 In Progress; GitHub now shows it closed.
  Result and independent-review evidence still need reconciliation. Preserve
  historical images; any new snapshot must carry its actual capture date.
- Product Stories S01-S13 are backlog work rather than unfinished Sprint 1
  commitments and therefore are not counted as carry-over from this sprint.

### Sprint Review

**Review date:** Not recorded in the repository.

**Repository outcomes available for demonstration:**

- A research-backed product scope and final 14-Story backlog.
- Three personas and their scenarios.
- The M1 requirements document, screen flow, business rules, and route-to-Story
  traceability.
- Repository process rules, issue templates, Definition of Done, and README
  handoff information.

**Feedback received:** Not recorded in the repository.

**Backlog changes resulting from the recorded refinement work:** S06 was
promoted, S05 was split, S08-S11 were added, S04's cold-start behaviour was
made deterministic, and the final M1 refinement added S12/S13 with
account-owned personalisation. The repository does not identify which changes,
if any, were specifically agreed during a Sprint Review meeting.

### Retrospective

No Sprint 1 retrospective outcome is recorded in the repository. Complete this
section, and create `docs/retro.md`, only after the team holds the retrospective.

| What went well | What did not go well | Lesson learned |
| -------------- | -------------------- | -------------- |
| Not recorded   | Not recorded         | Not recorded   |

**Exactly one improvement action and owner:** Not set; the team must choose this
during the retrospective.

### Attendance

Repository contributions demonstrate work performed, not meeting attendance.
The attendance fields therefore remain explicitly unconfirmed.

| Member           | Sprint 1 responsibility | Planning     | Review       | Retro        |
| ---------------- | ----------------------- | ------------ | ------------ | ------------ |
| Nguyen Xuan Kiet | Product Owner; C01      | Not recorded | Not recorded | Not recorded |
| Tran Minh Hoang  | Scrum Master; C02       | Not recorded | Not recorded | Not recorded |
| Tran Tuan Anh    | C03                     | Not recorded | Not recorded | Not recorded |
| Vu Quoc Huy      | C04                     | Not recorded | Not recorded | Not recorded |
| Nguyen Tuan Anh  | C05                     | Not recorded | Not recorded | Not recorded |

### Board evidence

- [Board after issue creation](<evidence/after create issue.png>) - 14 Todo,
  0 In Progress, 0 In Review, and 1 Done. This is the strongest available
  candidate for the start-of-Sprint snapshot.
- [Board with the five committed Chores in progress](<evidence/before sprint 1.png>)
  - 9 Todo, 5 In Progress, 0 In Review, and 1 Done. Despite its filename, the
    statuses show that Sprint work had already begun.
- [Board captured before the final C02 status update](<evidence/after sprint 1.png>)
  - 12 Todo, 2 In Progress, 0 In Review, and 5 Done. C02 was subsequently
    completed by consolidating the Sprint 1 results and evidence in this log.

Include the selected start and final snapshots in the Sprint 1 wrap-up commit.
The saved board image predates the final C02 status update, so the Project board
must show C02 as Done before the final snapshot is used as evidence.

---

## Sprint 2 - repository activity recorded 2026-09-24 to 2026-10-02

**Official Sprint dates:** Not recorded in the repository or the public Issue
evidence reviewed on 2026-10-03.

**Sprint Planning date:** Not recorded.

### Sprint goal

Produce the Milestone 2 walking skeleton from a public browser page, through a
backend endpoint, to a real local database with visible deterministic movie
data. This wording is a concise restatement of the recorded objective in
[#67 / S2-C01](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/67).

### Commitment and Story-point boundary

The [Sprint 2 planning record](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/67#issuecomment-5829313492)
commits S10 / #32 and S12 / #44 for whole-Story closure, for a total of 6 Story
Points. It keeps S03 / #19, S04 / #20, and S13 / #45 open as partial Stories.
The Sprint plan also places 21 named Tasks and five Chores in the Sprint 2
iteration. The five parent Stories and their complete estimates are:

| Parent Story | Story points | Sprint 2 task coverage |
| ------------ | -----------: | ---------------------- |
| [#19 / S03](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/19) | 3 | #47, #48, #60, #61, #62, #74 |
| [#20 / S04](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/20) | 5 | #58, #59 |
| [#32 / S10](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/32) | 3 | #63, #64, #65 |
| [#44 / S12](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/44) | 3 | #49, #50, #51, #52 |
| [#45 / S13](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/45) | 5 | #53, #54, #55, #56, #57, #66 |

The five parent estimates total 19 points, but only S10 / #32 and S12 / #44
were committed for whole-Story closure. Counting the complete estimates of the
other three parents would claim scope that the planning record explicitly
identifies as partial. Task hours are not Story Points and are not substituted
for velocity.

**Verified committed Story Points:** 6 (S10 / #32: 3 points; S12 / #44: 3
points), supported by the linked Sprint 2 planning record.

**Verified completed Story Points:** 0. Both committed Stories remain open, their
acceptance-criterion checklists remain incomplete, and neither meets the
repository's whole-Story Definition of Done. The three partial parent Stories
also remain open.

**Velocity:** 0 Story Points.

### Completed Sprint 2 items

As of 2026-10-03, GitHub records all 21 named Sprint 2 Tasks as closed. The
table groups them by parent Story without awarding the parent Story's points.
Closed Task status records delivery of the named technical slice; it does not
close or earn points for the parent Story.

| Parent | Closed Tasks | Merged implementation or verification PRs |
| ------ | ------------ | ------------------------------------------ |
| S03 / #19 | [#47](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/47), [#48](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/48), [#60](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/60), [#61](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/61), [#62](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/62), [#74](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/74) | [#77](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/77), [#90](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/90), [#83](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/83), [#86](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/86), [#91](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/91), [#79](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/79) |
| S04 / #20 | [#58](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/58), [#59](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/59) | [#93](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/93), [#95](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/95) |
| S10 / #32 | [#63](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/63), [#64](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/64), [#65](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/65) | [#75](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/75), [#88](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/88), [#94](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/94) |
| S12 / #44 | [#49](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/49), [#50](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/50), [#51](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/51), [#52](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/52) | [#78](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/78), [#85](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/85), [#89](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/89), [#82](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/82) |
| S13 / #45 | [#53](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/53), [#54](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/54), [#55](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/55), [#56](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/56), [#57](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/57), [#66](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/66) | [#80](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/80), [#81](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/81), [#84](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/84), [#87](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/87), [#92](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/92), [#96](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/96) |

Of the five Sprint 2 Chores, [#69 / S2-C03](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/69)
is closed and its baseline contract was merged in
[PR #72](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/72).

### Individual contribution and independent-review evidence

Each member has a merged Sprint 2 PR authored by that member, a closed assigned
Sprint 2 Task, and an approval submitted on another member's PR. The review
links below point to the specific GitHub review records rather than only to the
PR conversation.

| Member | Authored merged and reviewed PR | Closed assigned issue | Independent review contribution |
| ------ | ------------------------------- | --------------------- | ------------------------------- |
| Nguyen Xuan Kiet (`@kietxuan`) | [PR #90](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/90), approved by four other members | [#48](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/48) | [Approved PR #94](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/94#pullrequestreview-5388277229) |
| Tran Minh Hoang (`@hoang3003`) | [PR #95](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/95), approved by four other members | [#59](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/59) | [Approved PR #94](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/94#pullrequestreview-5388945973) |
| Tran Tuan Anh (`@anotify-vie`) | [PR #93](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/93), approved by four other members | [#58](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/58) | [Approved PR #94](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/94#pullrequestreview-5388919871) |
| Vu Quoc Huy (`@vu-huzy`) | [PR #96](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/96), approved by three other members | [#66](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/66) | [Approved PR #94](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/94#pullrequestreview-5388283763) |
| Nguyen Tuan Anh (`@NguyenTuanAnh0608`) | [PR #94](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/94), approved by four other members | [#65](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/65) | [Approved PR #93](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/93#pullrequestreview-5388046814) |

### Unfinished work and carry-over

The following Sprint 2 Chores remain open. Their public Issue records do not
name a next iteration, so assigning one here would invent a planning decision.

| Issue | Recorded unfinished scope | Next iteration |
| ----- | ------------------------- | -------------- |
| [#67 / S2-C01](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/67) | Planning-state board evidence and final completion links remain unrecorded. | Not recorded; team decision required |
| [#68 / S2-C02](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/68) | Final board evidence, retrospective action, handoff, documentation PR and final closure remain pending. | Sprint 2 wrap-up; close only after all evidence exists |
| [#70 / S2-C04](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/70) | The Issue remains open; its checklist still requires recorded clean-clone, CI, reviewed-PR and review links. | Not recorded; team decision required |
| [#71 / S2-C05](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/71) | Final design dossier, setup document, clean-clone evidence, documentation PR, board screenshots and submission evidence remain incomplete. | Not recorded; team decision required |

The five parent Stories #19, #20, #32, #44 and #45 also remain open. This is
consistent with #67's recorded instruction to keep partially implemented
Stories open; they are product-backlog work, not completed Sprint 2 Stories.

### Sprint Review

**Review date:** Not recorded.

**Repository outcomes available for demonstration:** the deterministic local
catalogue bootstrap, database-backed catalogue and detail endpoints, account
registration and server sessions, login/navigation guards, popular cold-start
recommendations, public recommendation explanation, and the integrated
auth-to-catalogue handoff.

**Review feedback:** Not recorded. Repository evidence demonstrates delivered
technical outputs but does not prove that a Sprint Review meeting occurred or
what feedback participants gave.

### Retrospective

No Sprint 2 retrospective outcome is recorded in the repository or linked
Issues. The required single improvement action and its owner must be supplied
from the actual retrospective before #68 is closed.

**Exactly one improvement action:** Not recorded.

**Owner:** Not recorded.

### Sprint Master handoff

The repository identifies `@NguyenTuanAnh0608` as the Sprint 2 wrap-up owner.
The next Sprint Master, handoff date, and handoff evidence are not recorded.
These fields must be completed from the team's actual decision.

### Board and documentation evidence

- **Sprint 2 Planning record:** [Issue #67 planning comment](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/67#issuecomment-5829313492)
  records S10 / #32 and S12 / #44 as the two planned Story closures, totalling
  6 committed Story Points.
- **Planning-state board screenshot:** Not available. Issue #67 requires a
  screenshot with all columns visible, but no screenshot is linked from its
  body or planning comment and none is committed under `docs/evidence/` as of
  2026-10-04. Add the actual Planning screenshot and link it here; do not use a
  later board state as Planning evidence.
- **Final Sprint 2 board screenshot:** Not available. The Project board requires
  authenticated access; no Sprint 2 board image is committed under
  `docs/evidence/` as of 2026-10-04. Add a final screenshot with all board
  columns visible and link it here before merge.
- **Documentation PR:** [PR #97](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/97)
  contains this Sprint 2 wrap-up and is awaiting completion evidence before
  merge.
- **Closure rule:** Do not close #68 until the Sprint has ended, the final board
  screenshot is committed, the retrospective action and owner are recorded,
  the next Sprint Master handoff is recorded, every open item has an agreed
  next iteration, and the documentation PR is reviewed and merged.

---

## Sprint 3 - 2026-10-05 to 2026-10-18

**Official Sprint dates:** 2026-10-05 to 2026-10-18, confirmed by the Product
Owner and recorded in the
[Sprint 3 backlog reconciliation](sprint3-backlog-refinement.md). The Project
board's older iteration-date label was deliberately left unchanged.

**Sprint Planning date:** Not recorded.

**Roles:** Product Owner `@kietxuan`; Scrum Master `@vu-huzy`. The Sprint 3
Scrum Master differs from Sprint 1 (`@hoang3003`) and Sprint 2
(`@NguyenTuanAnh0608`).

This section was written on 2026-10-18 from GitHub issue, pull-request and
review records at `main` commit `c843f8775f993f67a57c4b5b99d1011b928aa882`.
Facts that those sources do not contain are marked "Not recorded".

### Sprint goal

Make every P0 Story work end to end through the interface, using database-backed
TMDb catalogue data and clear user-facing error messages. This is a concise
restatement of the objective in
[#132 / S3-C01](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/132).

### Commitment and Story-point boundary

- **Committed Story Points: 24.** The PO explicitly confirmed during the PR #191
  follow-up that the commitment is the six-P0 baseline: S01 3, S02 5, S03 3,
  S04 5, S12 3 and S13 5. This is a newly recorded PO clarification, not a
  number derived from board card totals or a newly discovered Planning image.
- **Previously delivered scope:** S12 / #44 was closed on 2026-10-04 during
  Sprint 2. It remains in the PO-confirmed 24-point P0 review baseline, but
  earns **zero additional completed points** in Sprint 3. The baseline therefore
  contains 21 points of new P0 delivery and 3 points of previously delivered
  registration functionality to reverify.
- **Planning-state board:** the
  [PO-identified beginning-of-Sprint-3 image](images/sprint3/planning-board.png)
  shows global totals of Todo 53 / In Progress 0 / In Review 0 / Done 35. Those
  totals include Sprint 2 cards and are not Sprint 3 points. The
  [later iteration view](images/sprint3/iteration-board-snapshot.png) shows 43
  Sprint 3 items (37 Task, 5 Chore, 1 Spike) and places Stories #17-#20 under
  "No Sprint".
- Tasks, Chores and Spikes carry no Story Points and are not counted in velocity.

### Result

GitHub records eight Stories closed during Sprint 3. Seven were closed by the PO
in one action on 2026-10-18 between 12:08:33 and 12:08:50 UTC; S13 was closed by
the merge of [PR #178](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/178).

| Story | Issue | Priority | Points | Closed (UTC) | Closed by |
| ----- | ----- | :------: | -----: | ------------ | --------- |
| S01 Select favourite genres | [#17](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/17) | P0 | 3 | 2026-10-18 12:08 | `@kietxuan` |
| S02 Get recommendations from preferences | [#18](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/18) | P0 | 5 | 2026-10-18 12:08 | `@kietxuan` |
| S03 View movie details | [#19](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/19) | P0 | 3 | 2026-10-18 12:08 | `@kietxuan` |
| S04 Explore without preferences | [#20](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/20) | P0 | 5 | 2026-10-18 12:08 | `@kietxuan` |
| S13 Sign in and sign out | [#45](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/45) | P0 | 5 | 2026-10-17 04:42 | `@anotify-vie` (PR #178 merge) |
| S05a Rate a movie | [#21](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/21) | P1 | 3 | 2026-10-18 12:08 | `@kietxuan` |
| S06 Filter recommendations by genre | [#23](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/23) | P1 | 3 | 2026-10-18 12:08 | `@kietxuan` |
| S09 Browse popular movies | [#31](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/31) | P1 | 3 | 2026-10-18 12:08 | `@kietxuan` |

**Completed Story Points: 30** (new P0 delivery: 21; P1 delivery: 9).
The PO has accepted the eight delivered Stories against the checked Story AC,
merged implementation/verification Issues and recorded browser/API/database
evidence, not merely their closed state. S12 / #44 is excluded because it
closed in Sprint 2. [Acceptance basis and point ledger](evidence/s3-c02-reconciliation.md).

**Velocity:** 30 Story Points.

**Accounting and evidence boundaries:**

- [docs/ui.md](ui.md) and the [T25 handoff](evidence/s3-m3-p0-handoff/README.md)
  now distinguish the PO's accepted `works` decision from the older pending
  sign-off snapshot. Existing test results are reused with their actual source
  versions; this documentation reconciliation is not a new application run.
- The latest checked Story AC, Tasks and **Definition of Ready** are complete.
  The dependency checkbox belongs to Ready, not to Definition of Done; neither
  a tick nor issue closure alone replaces the linked verification evidence.
- The 9 P1 points (S05a, S06, S09) are delivered scope additional to the P0
  commitment. Consequently velocity 30 exceeds committed 24; this is explained
  scope accounting, not an arithmetic correction to commitment.
- Detailed notes for Trang's previously PO-confirmed unaided walkthrough are
  still unavailable. They are not invented or represented as newly observed
  tests. Administrative C02/review/submission obligations remain separate.

### Completed Sprint 3 items

Issues closed from 2026-10-05 to 2026-10-18: **51**, namely 8 Stories (above),
38 Tasks, 4 Chores and 1 Spike. Tasks are the 37 planned Sprint 3 Tasks plus
[#189](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/189), the C05
follow-up. The four closed Chores are #132 (C01), #134 (C03), #135 (C04) and
#136 (C05); the Spike is [#43](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/43).
The per-Task owner, reviewer, prerequisite and merged-PR table is in
[sprint3-backlog-refinement.md](sprint3-backlog-refinement.md#4-current-inventory-and-dependency-map).

**Merged pull requests:** 45 ([#143](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/143)
to [#190](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/190), merged
2026-10-08 to 2026-10-18).

### Repository minimums for Milestone 3

| Minimum | Result | Evidence |
| ------- | ------ | -------- |
| At least 4 merged PRs, each reviewed by another person | Met: 45 merged PRs, each with at least one formal `APPROVED` review, submitted before the merge, by a member other than the author. For 30 of them that approval covers the final head; for the other 15 (#145, #151, #156, #158, #159, #164, #170, #171, #173, #175, #176, #184, #187, #188, #190) the pre-merge approvals covered an earlier head | GraphQL query of PRs #143-#190 on 2026-10-18; formal reviews, not plain comments |
| At least 5 issues closed, including P0 Stories marked `works` | Met in the recorded snapshot: 51 issues closed, including the five P0 Stories newly closed in Sprint 3; all six P0 are accepted as `works`. S12 is already delivered and earns no Sprint 3 points | [ui.md section 1](ui.md#1-p0-stories-and-status), [acceptance ledger](evidence/s3-c02-reconciliation.md) |
| Each member has a merged PR, a review given and a closed issue | Met, see the matrix below | GitHub PR, review and issue records |
| README first screen lists the P0 Stories and where each starts | Met | [README](../README.md#sprint-3-review--start-here) |
| README names the Sprint 3 PO and Scrum Master | Met: `@kietxuan` and `@vu-huzy` | [README](../README.md#sprint-3-review--start-here) |
| `docs/SETUP.md` on `main` with a Sprint 3 "tested by" record | Present, with a caveat: both records name Codex (an AI tool), Sprint 3, 2026-10-18. A clean-clone run by a team member on a second machine is not recorded | [SETUP.md](SETUP.md), [clean-clone record](evidence/s3-c04-clean-clone.md) |
| `docs/ui.md` has the four sections in order | Met: sections 1-4 appear in the required order | [ui.md](ui.md) |
| Submitted Project-board link opens | Not verified: an unauthenticated request returns HTTP 404 and the available `gh` token lacks `read:project`. A member with board access, or the instructor's view, must confirm it | [Project 9](https://github.com/orgs/SE-FDA-NEU/projects/9) |

### Individual contribution and independent-review evidence

Closed-issue counts use the current assignee, as in the C01 reconciliation. The
review column counts distinct Sprint 3 PRs on which the member submitted a formal
approval for someone else's PR.

| Member | Merged PRs authored | PRs approved for others | Issues closed | Sample formal review |
| ------ | ------------------: | ----------------------: | ------------: | -------------------- |
| Nguyen Xuan Kiet (`@kietxuan`) | 12 | 30 | 12 | [PR #153](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/153#pullrequestreview-5479847991) |
| Tran Minh Hoang (`@hoang3003`) | 9 | 35 | 9 | [PR #150](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/150#pullrequestreview-5471905199) |
| Tran Tuan Anh (`@anotify-vie`) | 9 | 17 | 12 | [PR #151](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/151#pullrequestreview-5479199238) |
| Vu Quoc Huy (`@vu-huzy`) | 7 | 27 | 8 | [PR #150](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/150#pullrequestreview-5477490126) |
| Nguyen Tuan Anh (`@NguyenTuanAnh0608`) | 8 | 29 | 10 | [PR #150](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/150#pullrequestreview-5472634858) |
| **Total** | **45** | - | **51** | - |

C04 ([PR #185](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/185)) merged
at 08:40 UTC on 2026-10-18 with one pre-merge approval, by `@kietxuan`, who also
contributed to its follow-up commit. A second formal approval, by `@hoang3003`
([review](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/185#pullrequestreview-5562668940)),
was submitted at 11:08 UTC, after the merge. Its body is only "ok", so it does not
record the inspection, findings and reproduction that
[human-validation.md](evidence/s3-m3-p0-handoff/human-validation.md) asks a
non-contributor to write; that gate stays open.

### Unfinished work and carry-over

| Item | Recorded state | Next iteration |
| ---- | -------------- | -------------- |
| [#22 / S05b](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/22) rating-informed ranking | Open; the C01 closeout places it in Sprint 4 | Sprint 4 |
| [#24 / S07](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/24) and [#30 / S08](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/30) | Open; only the NLP Spike #43 was delivered, not production search or similarity | Not recorded; team decision required |
| [#33 / S11](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/33) reset profile UI | Open; the authenticated reset backend (#142) shipped, the profile reset UI did not | Not recorded; team decision required |
| P0 acceptance | Six P0 accepted as `works` by the PO against checked AC and existing verification; not unfinished Story delivery | Completed; detailed participant notes remain an audit limitation |
| Unaided-participant session | A participant ("Trang") was confirmed second-hand by the PO; session date, version and per-journey outcomes are not recorded | Not recorded |
| [#133 / S3-C02](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/133) | Closed by merged PR #191 at `778a693`; historical missing meeting/handoff fields are not inferred from closure | Closed; post-submission source corrections tracked with Refs #133 |

No Sprint 3 issue carries the `carried-over` label. Applying it to the rows above
is a team decision and is not done here.

### Sprint Review

**Review date:** Not recorded.

**Repository outcomes available for demonstration:** the TMDb-imported catalogue
with registration, sign-in and sign-out; genre preferences saved per account;
personalised and popular recommendation cards with reasons, no-match, error and
retry states; the popular-movie page and TMDb popularity display; movie details
with backdrops; per-account ratings; genre filtering; the authenticated reset
endpoint; the M3 UI dossier ([ui.md](ui.md)) and the clean-clone setup guide.

**Feedback received:** Not recorded. Repository evidence shows delivered work but
does not prove that a Sprint Review meeting took place or what was said.

### Retrospective

No Sprint 3 retrospective outcome is recorded in the repository or linked Issues.
`docs/retro.md` is not created until the team holds the retrospective.

| What went well | What did not go well | Lesson learned |
| -------------- | -------------------- | -------------- |
| Not recorded   | Not recorded         | Not recorded   |

**Exactly one improvement action:** Not recorded.

**Owner:** Not recorded.

### Scrum Master handoff

`@vu-huzy` is the Sprint 3 Scrum Master. The next Scrum Master, the handoff date
and the handoff evidence are not recorded. Members who have not yet been Scrum
Master are Nguyen Xuan Kiet and Tran Tuan Anh; the choice is a team decision.

### Board and documentation evidence

- **Planning-state board:** [PO-identified image](images/sprint3/planning-board.png)
  and [iteration view](images/sprint3/iteration-board-snapshot.png); see the
  boundary above. Neither carries a visible capture timestamp.
- **Submission-day board:** [PO-supplied image](images/ui/submission-board.png)
  with all four workflow columns: Todo 4 / In Progress 0 / In Review 0 / Done 87.
  These are global card totals with no visible Sprint filter or timestamp; they
  are not velocity or proof that a Story is accepted.
  [Provenance and limits](evidence/s3-c05-ui/supplied-captures.md).
- **M3 dossier:** [docs/ui.md](ui.md), merged to `main` through
  [PR #188](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/188), with
  later documentation fixes in PR #190.
- **Tested state of `main`:** hosted workflows on `c843f87` (CI, S04 real browser,
  T16, T28, T33, T34 and Sprint 3 C01 documentation) report success. The team
  has not designated one "final tested SHA". The recorded executable candidates
  are `326aadf3ee32342c4e91297ee9e885663eccf565` (clean clone and review account,
  [SETUP.md](SETUP.md)) and the unpublished T25 snapshot
  `05a78c1f503c10f6f5047655acb3800b21966e99`
  ([handoff](evidence/s3-m3-p0-handoff/README.md)). Do not relabel either as the
  merged head.
- **PO-reported submission:** On 2026-10-19 the PO confirmed in chat that the
  assignment had been submitted. The submitted PDF, its hash, LMS timestamp and
  genuine receipt were not supplied, so exact source/PDF correspondence and
  deadline compliance are not independently verified. Keep PDF/receipt handling
  manual and outside Git. Source corrections after this report do not prove a
  replacement upload.
- **Documentation PR:** [PR #191](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/191)
  contains this wrap-up, together with the PO-confirmed commitment and acceptance,
  dossier-verifier corrections and status updates to `docs/ui.md`
  (merged PR #188, closed #136, the C03 final-head approval and the latest C04
  results from PR #190).

**Closure record:** #133 is closed. PR #191 merged at
`778a69306b3915ec6f0407975d6f130264e887a0` on 2026-10-19 00:09:44 +07:00,
and the Issue closed one second later. The earlier instruction to wait for the
remaining records is historical, not a claim that they were all supplied.
The PO has since reported submission; unavailable Review feedback, optional
retrospective outcomes, next-SM handoff, board-access check and LMS receipt are
not manufactured. The current follow-up must receive substantive review from
a non-contributor before merge; approval or submission is not generated on
another person's behalf.

---

## Sprint 4 — wrap-up cutoff 1 November 2026

**C04 closure-state reconciliation, 1 November:** GitHub now records C02 #196
Closed at 11:14:26 UTC, C01 #216 at 12:36:56 UTC and C05 #219 at 12:39:10 UTC.
The Open/merge-pending entries below describe the earlier C02 source cutoff,
not their present issue states. C04 #218 still owns manual report submission.
Its [handoff](evidence/s4-c04/README.md) records the PO's later confirmation
of Hoang's independent C05 check on 1 November and the instructor-approved
late board substitute. Existing command logs remain attributed to their runners.

**Status: PO acceptance and reported Review/Retro/handoff recorded; final
independent gates remain.** SM4 is **@anotify-vie**, PO and SM5 are
**@kietxuan**, SM3 remains **@vu-huzy**. C01 Planning is PO-owned and C02
wrap-up is SM-owned. Final C02 review must come from a non-contributor.

### Planning, commitment and accepted points

On 1 November the PO confirmed **Planning on 20 October 2026**, with all four
Stories below originally committed for whole-Story closure: **18 points**.
The PO subsequently confirmed all four AC/DoD accepted. These are explicit
PO reports in the project conversation, recorded now; they are not inferred
from merges or backdated Planning artifacts. [C01 PR #245](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/245)
publishes the [Planning record](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/blob/b453abf5c4f908f810fb775e6cb24f094c17cb6c/docs/sprint4-backlog-refinement.md).
Its independent review/merge remains outstanding at this cutoff.

| Metric | Result |
|---|---|
| Original committed Story Points | **18 = 5 + 5 + 5 + 3**, PO-confirmed |
| Completed Story Points | **18 PO-accepted** on 1 November; issue-state synchronization is pending the reviewed wrap-up merge |
| Velocity | **18 accepted Story Points** |
| Historical work-item plan | **25: 18 core Tasks + five Chores + two G4 trailer Tasks**; Task/Chore Points blank |
| Work-item state at source read | **21/25 Closed** (20 Tasks plus C03); C01/C02/C04/C05 remain Open |
| Newly accepted parent issue state | #22/#24/#30/#33 remain Open administratively at the source read; the wrap-up's closing directives synchronize their accepted outcome at merge |
| Carry-over / deferral | No additional Story is deferred by this record. VN providers and previously planned release revalidation remain Sprint 5. Other transfers need explicit PO output/owner/destination decisions |
| Capacity | At the PO's request omit hour totals; use named outputs/review accountability from C01 |

| Story | Points | Accepted outcome and delivery evidence |
|---|---|---|
| [S05b #22](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/22) | 5 | PO confirms AC/DoD accepted. Rating-aware ranking/fallback/private score evidence: [#223](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/223), [#226](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/226), [#231](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/231), [#237](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/237), [T05](evidence/s4-t05-acceptance.md). |
| [S07 #24](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/24) | 5 | PO confirms AC/DoD accepted. Similar ranking, missing data and five-AC UI evidence: [#229](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/229), [#233](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/233), [T08](evidence/s4-t08-similar-ui/README.md). |
| [S08 #30](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/30) | 5 | PO confirms AC/DoD accepted, including submitted-query/all-result pagination amendments: [#228](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/228), [#232](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/232), [#235](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/235), [#242](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/242), [Search amendment](evidence/s4-t16-search-pagination.md). |
| [S11 #33](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/33) | 3 | PO confirms AC/DoD accepted. Confirmation/cancel, account isolation, later-login/reset preservation: [#221](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/221), [#227](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/227), [#230](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/230), [#234](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/234), [#238](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/238), [T15](evidence/s4-t15-reset-acceptance/README.md). |

Previously accepted S01/S02/S03/S04/S12/S13 and S05a #21 earn no repeated points.
The PO's whole-Story decisions are distinct from the narrower automated cases
run here. C05's independent environment/recovery gate and final document review
are still tracked below rather than automatically credited by those decisions.

### Review, Retrospective and improvement

The PO reports **Sprint Review and Retrospective on 1 November 2026**, with
**all five members present**: Nguyen Xuan Kiet (@kietxuan), Tran Minh Hoang
(@hoang3003), Tran Tuan Anh (@anotify-vie), Vu Quoc Huy (@vu-huzy), and
Nguyen Tuan Anh (@NguyenTuanAnh0608). An earlier 20 October Review date was
corrected by the PO; 20 October is Planning, not the end-of-Sprint Review.

Main reported feedback/improvement: **UI polish and adding persistent
Add to watchlist**. The Review accepted the four Stories above. Actual
improvement responsibility is traceable to the existing backlog:

| Improvement / follow-through | Accountable owner | Outcome |
|---|---|---|
| Improve existing-page UI and shared visual components | T01 #195 — @kietxuan | Delivered; preserve accepted light/dark UI, navigation and fallback in release revalidation |
| Add account-owned persistent watchlist | T12 #207 — @hoang3003 | Delivered; retain reload/later-login persistence and reset-keeps-watchlist behaviour |
| Carry these accepted UI/watchlist outcomes into the planned Sprint 5 release check | SM5 @kietxuan | Handoff acknowledged by the PO/SM5 on 1 November; Sprint 5 execution remains future work |

Implementation owners above come from existing issue assignments. No extra
meeting quotation, deadline, individual signature or separately held test
session is invented. The PO has explicitly acknowledged receiving the SM5
handoff; the concrete source/runbook/remaining-work packet is below.

### Actual compact execution and source boundary

Merged production baseline:
**`0d2378d5f0c44889ca93c8cff7c8bc9c568b43c5`**, C05 PR #243.
C02 test-relocation source:
**`6ca4760befe135a1083bc3793b92d9db21018c89`**.
Production backend/frontend, workflows, root bootstrap and default discovery
are unchanged. Two member-authored optional modules moved into root `tests/`;
all function/class bodies are unchanged, with one relative fixture-path repair.

```text
python -m pytest -v --junitxml=docs/evidence/s4-c02-finalization-pytest-20261101.xml
```

**40 passed, zero failed/skipped/xfail, 22.21 seconds**, Windows, Python
3.12.6/pytest 9.1.1; all **37 P0 IDs** map to the default two-file selection.
The [finalization record](evidence/s4-c02-finalization-20261101.md),
[receipt](evidence/s4-c02-finalization-20261101.json),
[verbose output](evidence/s4-c02-finalization-pytest-20261101.log) and
[JUnit](evidence/s4-c02-finalization-pytest-20261101.xml) pin the actual result.

Runner: **Codex assisting implementation**, not independent teammate execution.
The 40-item run began before `6ca4760` was created; selected source bytes match
that commit. The later seven-node member/relocation run used the committed
source: **7 passed in 2.54 seconds**. One inherited Starlette/httpx warning
remains. An initial sandbox temp-folder permission failure is disclosed in the
new record and is not used as a business-rule red test.

Fixtures migrate temporary SQLite and block provider HTTP, without a server,
real database or token. No broad backend/frontend/browser regression was run.
Keep [testing.md](testing.md) at four M4 sections; optional member/feature tests
are evidence for contributions and retained functionality, not new P0-report
requirements. The standard optional `pytest tests backend/tests scripts`
command includes the relocated modules.

The immutable [morning receipt](evidence/s4-wrap-up-20261101.json), earlier
[integration record](evidence/s4-c02-integration-20261101.md), and historical
T05/T08/T10/T15/T20 results retain their original SHAs/platforms/times. The
[prior detailed reconciliation](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/blob/186deb5ab93ce3525863a4ba34ea2efb914a8090/docs/sprint-log.md#sprint-4--wrap-up-cutoff-1-november-2026)
preserves those reuse comparisons; none is relabelled as this newer run.

### Team and individual contribution audit

At the source snapshot, **24 merged delivery PRs #220–#243** each have a formal
pre-merge approval by someone other than the PR author, and **21 Sprint 4 work
items are Closed**. This meets team minima of four reviewed merged PRs and five
Closed issues. Sixteen approvals cover final heads; eight cover older heads.
These counts are not a claim that every approval was substantive/non-contributor
verification. Snapshot counts exclude open C01/C02 PRs.

| Member | Merged S4 PRs | Closed assigned items | Sample formal review given |
|---|---|---|---|
| @kietxuan | 5: #220/#221/#224/#230/#235 | 4: #195/#206/#208/#211 | [Approve #222](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/222#pullrequestreview-5637256620) |
| @hoang3003 | 5: #222/#223/#227/#234/#241 | 5: #197/#207/#209/#214/#217 | [Approve #220](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/220#pullrequestreview-5636903087) |
| @anotify-vie | 5: #226/#232/#236/#239/#240 | 4: #198/#205/#212/#213 | [Approve #220](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/220#pullrequestreview-5637095862) |
| @vu-huzy | 4: #229/#231/#233/#238 | 4: #199/#202/#203/#210 | [Approve #220](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/220#pullrequestreview-5637501944) |
| @NguyenTuanAnh0608 | 5: #225/#228/#237/#242/#243 | 4: #200/#201/#204/#215 | [Approve #220](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/220#pullrequestreview-5637104039) |

Each member meets the one merged PR/review-given/Closed-issue minima.
The corrected root-test evidence below also recognizes meaningful additions
inside existing test cases, rather than only authors of initial function lines.

| Member | Attributable root pytest node | Authorship receipt | Focused result |
|---|---|---|---|
| @kietxuan | `tests/test_s03_details.py::test_TC_P0_S03_001_public_known_id` | [`31c5bf7`](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/commit/31c5bf7b9e8b006809a1bb2fcb69338589246421); original detail case authored in merged #235 | Passed |
| @hoang3003 | `tests/test_s4_t02_rating_signals.py::test_s4_t02_account_isolation_and_no_ratings_baseline` | [`8f313bc`](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/commit/8f313bc7e3d7c84671e26f13367cf07850d0f9f5); original member-authored function moved unchanged into root tests | Passed |
| @anotify-vie | `tests/test_p0_acceptance.py::test_TC_P0_S02_001_full_set_paging_has_25_distinct_movies` | [`6fbea72`](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/commit/6fbea7221093116d84450e587d2ffd6caabb72f9); authored the 9/10/11 boundary scenario in this shared S02 case | Passed |
| @vu-huzy | `tests/test_similar_movies_api.py::test_comparator_oracle_usable_source_is_a_b_c_and_missing_source_is_c_b_a` | [`76c4b7f`](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/commit/76c4b7f69b0fc4f26ea0155d86b3b98e3ea0a72f); original member-authored function moved unchanged into root tests | Passed |
| @NguyenTuanAnh0608 | `tests/test_p0_acceptance.py::test_TC_P0_S12_004_duplicate_normalized_email_is_conflict` | [`f0b56b7`](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/commit/f0b56b790f2edaa2bac8830c17d8cc6f1922756b); PO confirms both GitHub accounts are the same member | Passed |

Hoàng/Huy's functions exactly match their original member-authored ASTs.
Both whole modules move from `backend/tests/` without changing function/class
bodies. Nguyễn Tuấn Anh's two accounts are confirmed by the PO to be the same
person. Trần Tuấn Anh authored the meaningful boundary scenario in a shared case;
its initial author remains Nguyễn Tuấn Anh. Relocation commits and Codex's test
execution do not reassign authorship or represent human reviewer runs.

Thus **5/5 member-authored contributions are evidenced in the proposed PR tree**.
The relocations and Trần Tuấn Anh's boundary contribution become merged with
#244; the other original contributions are already merged. No extra per-member
test PR is required. The [receipt](evidence/s4-c02-finalization-20261101.json)
contains original commits, AST equality and exact current nodes/results.

### G4, retained scope, defects and remaining accountability

G4 Go and embedded trailer scope were already confirmed by the PO. Preserve
[the status correction](evidence/s4-t18-core-pre-g4/follow-up/README.md) and
[T20 audit](evidence/s4-t20/media-setup-audit.md). T19/T20 are delivered:
official YouTube selection, below-poster trailer action, on-page playback and
an unavailable caption. Earlier Defer/external-tab records remain historical.

Retain watchlist, half-star explicit-save ratings, full-set rank/filter/page,
submit-only Search, Similar and account-owned reset that preserves watchlist.
VN providers and planned release revalidation remain Sprint 5; no newly
unfinished output is silently transferred. No new production defect was found
by this compact/focused follow-up. Historical dependency advisories and the
inherited warning are not claimed to have been fixed or re-audited.

| Outstanding gate at this snapshot | Owner / next evidence |
|---|---|
| C01 #216 / PR #245 independent review and merge | PO @kietxuan and eligible non-contributor reviewer; Planning facts are now confirmed |
| C05 #219 independent setup/build/index/storage/recovery acceptance | @NguyenTuanAnh0608 and eligible non-author reviewer; merged #243 author evidence can be reused where applicable |
| C02 final substantive non-contributor review | SM4 @anotify-vie coordinates; @kietxuan gave PO approval but also authored follow-up commits |
| Parent Story issue-state synchronization | The wrap-up merge closes the four PO-accepted parent Stories and C02, after outstanding gates pass |
| C04 final report/board/PDF/submission | @vu-huzy, after C02; no reverse dependency on final screenshot or LMS receipt |

### Sprint 5 handoff to SM5 @kietxuan

**Receipt acknowledged:** the PO/SM5 confirmed handoff in the project
conversation on **1 November 2026**. Selected merged production remains
`0d2378d`; current test-only relocation source is `6ca4760`.

| Handoff field | Value / acceptance boundary |
|---|---|
| Migration | Single repository Alembic head `a3d1f8b72c44`; C05 independent operator confirms the selected acceptance DB's actual installed revision |
| Index | Model `overview-tfidf-v1`, artifact version 1; config fingerprint `41785781f34ba44091ac64f3b1c0503402ee760c518af1429d0acb94bbc31c99` |
| Setup/runtime | [SETUP](SETUP.md#steps): locked installs, explicit SQLite DB, migrate/import `--pages 50`, full media `--all`, build/check index and review account, start/check APIs. Runtime reads local imported data; private token stays server-side |
| Acceptance environment | Local TMDb-imported SQLite/index, not a claimed cloud deployment. C05's fresh **951-movie** Windows author rehearsal is evidence at its own revision, not an assertion about every operator's catalogue count or a retained release DB |
| Recovery | [C05 runbook](s4-c05-release-storage.md): consistent backup; restore into unused DB/sidecar-free destination with writers stopped, integrity/FK/schema checks, migrate/rebuild/check index, verify A/B persistence and reset-keeps-watchlist |
| Reusable evidence | [C05 compact record](evidence/s4-c05/compact-m4.md), [manifest](evidence/s4-c05/compact-manifest.json), feature histories, this finalization receipt/logs and member source proof |
| Remaining scope | C01/C05 independent gates and final C02 review; C04 submission afterward. No extra carried-over Story is invented |
| Sprint 5 | VN watch providers and planned release revalidation, preserving UI/watchlist/rating/Search/Similar/reset/media outcomes. Additional transfers require explicit PO decisions and destination issues |

C05's existing author clean-clone/live provisioning/restart/recovery results
are reused at their recorded source identity. @kietxuan's `ok` approval on
#243 is formal review but he also contributed; it is not independent rehearsal.
C02 does not manufacture that missing acceptance. Likewise final C02 needs an
eligible non-contributor's substantive approval after these changes.

C04 #218 owns final report review, authentic submission-day board, manual
`Team03_M4.pdf` and LMS receipt. Missing historical Planning imagery remains
disclosed under C01/C04; no staged/backdated screenshot is introduced.
C02's `Closes #196` is conditional on the actual remaining review/acceptance
gates, not a claim that all Sprint work is already Closed.

---

## Sprint 5 - 2026-11-05 to 2026-11-12

### Planning and commitment

Planning occurred on **6 November 2026**, during the confirmed Sprint of
**5–12 November 2026**. The PO confirmed all five members participated and
accepted two work issues each. PO and SM5 are **@kietxuan**.

The delivery plan is prepared under
[C01 #247](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/247).
The [full Planning record](sprint5-backlog-refinement.md) contains the decisions,
ownership/review map, 23 dependency edges, delivery targets, operator handoff
and [dated issue/image inventory](evidence/s5-c01-planning.json).

**Sprint goal** is a public CineAI HTTPS release with persistent TMDb/account
data, every P0 usable from Home, deployment after green CI, recovery and an
identifiable v1.0 release.

| Planning measure | Value |
|---|---|
| Committed engineering work | **10 items**, eight Tasks and two Chores, #247–#256 |
| Allocation | **2 accepted issues per member**, confirmed by the PO |
| Committed new product Story Points | **0**, with this Sprint committed to release Tasks/Chores |
| Completed engineering items at the captured baseline | **0**, all ten native issues Open |
| Completed Story Points at the captured baseline | **0** |
| Final velocity and throughput | C02 records final Story Point velocity for the selected scope and actual Closed technical items |

The selected implementation is Render Free and Neon Free PostgreSQL in
Singapore, using one HTTPS origin. T02 provisions a fresh TMDb catalogue with
`--pages 50`, dedicated public review accounts and recoverable index startup.
*Historical (6 November plan, superseded):* the original text named PostgreSQL 17
and moved VN watch providers to a future enhancement decision. See the
amendments below for the current PostgreSQL 18 and regional-provider scope.

Project 9 was aligned to **Sprint 5, Nov 05–Nov 12** on 6 November. C01 is
In Progress, the other nine work items are Todo and formal planning PR review
is pending at capture. The Planning record includes authentic table and saved
iteration screenshots.

The selected minimum availability date is **12 December 2026**. The maintenance
policy also covers at least one calendar month after the actual v1.0 release
and continues until grades are published, using the latest deadline.
@kietxuan is the retention owner, with @anotify-vie as backup.

T02/T03/T04 verify actual cloud/repository access for their named operators.
C02 owns the final Review/Retro, PO acceptance, member contribution audit,
committed/completed/velocity reconciliation, five-Sprint table, exact deployed
v1.0 SHA, manual submission receipt and maintenance handoff.

### Historical T08 observation (superseded by C02 below)

The PO amended the existing ten issues in place, creating no new work issue
(recorded in [C01 #247](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/247)):

| Date | Amendment |
|---|---|
| 7 November | Regional watch providers are committed Sprint 5 scope; T03 absorbs CI/protection and basic health/logging, T04 is the providers backend, T05 the providers UI, T08 monitoring and final documentation |
| 8 November | PostgreSQL **18.x** replaces PostgreSQL 17 for integration, CI, Neon and recovery; one validated "View watch options on TMDb ↗" action is added below the provider badges |
| 10 November | Supported markets are US (default), GB and SG with a compact browser-persisted selector, replacing the VN-only policy. The 989-movie VN run with no data stays as historical evidence |

The [Planning record](sprint5-backlog-refinement.md#current-scope-and-delivery-map-amended-7-8-and-10-november-2026)
holds the reconciled owner, dependency and state table, with the 6 November
tables and screenshots kept as labelled history. As of 11 November T01 to T06 are
Closed and T07, T08 and C02 are Open; T04 (#251), T05 (#252) and T06 (#253)
merged as PRs #261, #263 and #262. Evidence for each:
[T04](evidence/s5-t04-providers/regional-2026-11-10.md),
[T05](evidence/s5-t05-regional-ui.md),
[T06](evidence/s5-t06-recovery/README.md).

The public runtime has **not** received the regional migration: `/health` reports
`a3d1f8b72c44` while main's code head is `d9a6f2c1e508`. After reconnecting the
correct Render workspace on 11 November, authenticated Deploy Details confirmed
the live SHA **`f24ef54699efb2fa26f363107bd31401f9b12e58`**, Free/Singapore/main,
`/health` and After CI Checks Pass. No deploy, migration, enrichment or service
configuration change was performed; the PO deferred production rollout until
the readiness PRs are prepared.

T08 recorded two complete Render-log windows (220 and 106 request completions,
zero 5xx; p95 app processing 825.67 and 693 ms), a real response/log request-ID
correlation, and successful public demo login/session/logout. These are baseline
observations of f24, not acceptance of the future regional candidate. See
[operations evidence](evidence/s5-t08-operations/README.md).

[T07 PR #265](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/265) contains
fixed verifiers and real-TMDb technical evidence; physical phone, timed rehearsal
and PO acceptance remain Pending under C02. On 11 November the PO amended
T07/T08 to close at reviewed technical/documentation merges (Closes #254 / #255).
C02 #256 explicitly accepts all remaining public, operational and human checks;
no test result, PO decision or M5 requirement is waived. C02's PR retains Refs
#256 until actual release/submission completion. [The C02 handoff](s5-t08-c02-handoff.md#one-batch-release-plan)
records the intended single manual-release window and the need to control
auto-deploy on actual main commit messages. It does not promise one rollout if
final acceptance finds defects. Final velocity, acceptance, selected release SHA,
v1.0 and the real submission receipt remain C02 facts, not invented task/commit points.

### C02 current delivery and five-Sprint reconciliation — 11 November 2026

This updates the earlier capture without rewriting its observations. Source:
[C02 wrap-up](s5-c02-wrap-up.md), [GitHub audit](evidence/s5-c02/github.json)
and [actual public/Neon evidence](evidence/s5-c02/runtime.json).

| Sprint 5 measure | Current observed value |
| --- | --- |
| Committed | 10 engineering work items; **0 new Story Points** |
| Completed work items | **9/10 Closed**, C01/T01–T08; C02 remains Open |
| Completed Story Points / velocity | **0 / 0**; release Tasks/Chores earn no points |
| Merged PRs | **9**, #257–#265, each with green head CI and another member's pre-merge approval at a recorded revision; substantive/final-head caveats remain in the review audit |
| Per-member formal activity | All five have owned merged PR(s), formal review(s) and Closed assigned issues; this is not blanket certification of review substance |
| Runtime | Render acc4924 Live, Neon PostgreSQL 18.6/head d9a6f2c1e508, public health 200, 989 movies and 2,967 US/GB/SG checks |
| Final PO/release/submission | **Pending**, no approval/receipt invented; rehearsal and Review/Retro documentation removed from C02 by the PO, prepared separately by the team |

| Sprint | Committed Story Points | Completed Story Points | Velocity | Source / interpretation |
| --- | ---: | ---: | ---: | --- |
| 1 | 0 | 0 | 0 | [Sprint 1](#sprint-1---repository-activity-recorded-2026-09-08-to-2026-09-20): five Chores, no product Story delivery |
| 2 | 6 | 6 | 6 | [S10 #32](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/32) and [S12 #44](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/44), 3 each; PO reported both Done. The saved GitHub read confirms final checked AC and closure on 4 October; supersedes the earlier pre-closure 0-completed snapshot, not a new Sprint 5 award |
| 3 | 24 | 30 | 30 | [PO ledger](evidence/s3-c02-reconciliation.md): 21 new P0 + 9 P1 delivered; 24-point review commitment contains already-delivered S12, never count its 3 points again |
| 4 | 18 | 18 | 18 | [Sprint 4 PO record](#planning-commitment-and-accepted-points): four accepted Stories 5+5+5+3 on 1 November |
| 5 | 0 | 0 | 0 | Ten release Tasks/Chores, no newly estimated product Story; 9/10 current work-item throughput is separate |

Sprint 2 reconciliation uses the PO's previously reported S10/S12 completion,
current checked AC and recorded closure dates; it does not equate every closed
Task to a finished Story. [Saved estimates/criteria](evidence/s5-c02/github.json)
support 3+3. The old Sprint 2 section's 0 describes its earlier cutoff; the
five-Sprint table is the later reconciliation. No historical meeting, capacity
or original commitment is reconstructed from commits.

The PO now permits deploy-first/document-afterward and multiple reviewed
releases if needed. The former one-window/merge-docs-first plan is superseded.
Current running acc4924 and its green CI are distinct from this later C02
source. v1.0 must target the verified accepted running main commit; a docs-only
skip does not silently move the deployed app. This PR uses **Refs #256**.

Explicit final PO decision, required-check settings screenshot, durable recovery
handoff, maintenance acknowledgement and manual v1.0/PDF/LMS receipt remain
Pending in [the R01–R09 checklist](s5-c02-wrap-up.md#remaining-c02-gates-and-named-next-actions).
Only close C02 after actual evidence; no new issue or fabricated event is added.

### C02 final technical follow-up and user report — 11 November 2026

Fresh public probes passed 14/14 read-only plus 8/8 reused-account scenarios and
8/8 new-account scenarios (two real HTTP 201 registrations, duplicate HTTP 409,
rating HTTP 200, reload/later-login persistence, A/B isolation, reset preserving
Watchlist and original-list context). Only dedicated synthetic accounts were
written; no real user was used. Health response/log IDs match, HTTP 200/25.89 ms.
The regional backup was restored and all 13 snapshot tables matched; durable
upload/access and independent teammate restore are not yet completed.

PO/tester Nguyen Xuan Kiet reports physical phone and private laptop checks on
11 November, result OK; device/browser/per-device SHA not supplied. Explicit PO
candidate acceptance remains requested. Tag v1.0 exists at Live acc4924; Release
is Draft. [Evidence and current closure gates](s5-c02-wrap-up.md).

Per explicit PO instruction, rehearsal and Review/Retro reporting are removed
from C02. The team prepares these separately; this entry does not fabricate
attendance, feedback or performance. Story Point metrics and 9/10 current work
throughput are unchanged. C02 stays Open for actual protection/review, private
backup handoff, PO/release/maintenance and manual submission evidence.

### PO candidate acceptance and v1.0 publication — 11 November 2026

PO Nguyen Xuan Kiet explicitly confirms candidate **acc4924** accepted. The
existing annotated v1.0 tag resolves to that running green-main source; its
matching Draft Release was published after that decision. No retag or Render
deploy was performed. [Published v1.0](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/releases/tag/v1.0),
[release proof](evidence/s5-c02/release-status.json), [device/PO report](evidence/s5-c02/human-device-report.json).
This supersedes the preceding Pending PO/Draft snapshot without changing its
historical observations. Latest documentation-main SHA/CI can differ from the
running application; v1.0 still identifies the actual served source.

C02 remains Open for genuine required-check/settings screenshot, substantive
review/merge and fresh main CI, durable shared backup/access/independent restore,
maintenance acknowledgement and manual PDF/LMS receipt. Presentation preparation
is outside C02 by PO instruction; no event/attendance/result is invented.
