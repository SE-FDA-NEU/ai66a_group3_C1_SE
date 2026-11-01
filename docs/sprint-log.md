# Sprint log

This log records only facts supported by the repository, Git history, and the
saved Project-board evidence. Meeting details that are not present in those
sources are marked as not recorded rather than reconstructed as facts.

Current: [Sprint 4 wrap-up and Sprint 5 handoff](#sprint-4--wrap-up-cutoff-1-november-2026).

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

**Status: prepared for PO review; not finally accepted.** SM4 is
`@anotify-vie`; PO reviewer and agreed SM5 is `@kietxuan`.
SM3 remains `@vu-huzy`. C01 Planning (#216) stays PO-owned; C02 (#196)
stays SM-owned. This author-assisted reconciliation does not close either issue.
PO acceptance is separate from independent formal review. A member who
contributed to this follow-up cannot supply its independent non-author review.
Git records the delivery merges on 24 October–1 November; official Sprint dates and
the actual Planning event/date are **Not verified**.

**Historical morning cutoff:** public GitHub REST reads on 1 November 2026,
Asia/Ho_Chi_Minh, with merged baseline
**`b1e8c1e50cbbf21099dc424e481df065f9e6b99b`** (PR #242).
The saved [morning audit receipt](evidence/s4-wrap-up-20261101.json) is immutable:
its issue/PR snapshot, source comparisons and test times retain that cutoff.

**Current integration update:** C05 [PR #243](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/243)
merged at **2026-11-01 04:26:24 UTC / 11:26:24 +07:00**, producing main
**`0d2378d5f0c44889ca93c8cff7c8bc9c568b43c5`**. C02 [PR #244](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/244)
integrates it at **`ba7d8f9b01a2d26680205991e7f980d1d45d22cd`**.
The separate [integration audit](evidence/s4-c02-integration-20261101.md) and
[current receipt](evidence/s4-c02-integration-20261101.json) record the updated
state, source boundary and actual verification results. These snapshots establish
repository state, not historical board transitions or attendance.
No Sprint 4 Planning/cutoff board screenshot was found; both remain **Pending**.

### Commitment, completion and velocity

[C01 #216](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/216)
retains the historical **25-item plan: 18 core Tasks, five Chores and two
G4-gated trailer Tasks**. Core Tasks are T01 #195 and T02–T18 #197–#213;
Chores are C02 #196 and C01/C03/C04/C05 #216–#219; gated Tasks are
T19/T20 #214/#215. Tasks and Chores have **no Story Points**.
The original Planning snapshot, whole-Story closure commitment and member-confirmed
capacity were not supplied. **Actual committed Story Points: Pending the Planning
record/user confirmation.** If all four Stories below were originally committed
for whole-Story closure, the numeric commitment would be **18 = 5 + 5 + 5 + 3**;
their estimates alone do not establish that Planning decision.

| Reconciliation | Current verified result |
|---|---|
| Original work-item commitment | 23 core items plus two conditional trailer items, as retained by C01; original contemporaneous board/Planning record **Not verified** |
| Delivered / Closed | All 20 Tasks (#195, #197–#215) and C03 #217: **21/25 Closed items**; closure alone does not prove every AC/DoD or independent execution |
| Unfinished Chores | **4/25 Open**: C01 #216, C02 #196, C04 #218, C05 #219. Merged #243 uses `Refs #219`; it leaves C05 Open pending acceptance. C02 is partial delivery under `Refs #196` |
| Newly accepted Stories / completed points | **0 Stories / 0 points**: #22/#24/#30/#33 remain Open, with all AC checkboxes unchecked and 0 comments on each |
| Velocity | **0 newly accepted Story Points**; potential maximum 18 only after Story AC/DoD acceptance |
| Carry-over awaiting planning | The four unaccepted Stories and unfinished C01/C02/C05 outputs; transfer/owner/new issue/date **Pending PO replan**, not silently assigned to Sprint 5 |
| Submission work | C04 #218 remains Pending in its own workflow; no points and no reverse dependency from C02 |
| Explicit deferrals | C01 retains VN providers and previously transferred release revalidation in Sprint 5. No additional C01-approved deferral of unfinished Sprint 4 work was found |

| Story / estimate | Merged delivery and acceptance evidence candidates | Whole-Story result / newly counted points |
|---|---|---|
| [S05b #22](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/22), 5 | [#223](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/223), [#226](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/226), [#231](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/231), [#237](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/237); [T05 audit](evidence/s4-t05-acceptance.md) | Implemented/test evidence available; **Pending PO/reviewer acceptance**, 0 |
| [S07 #24](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/24), 5 | [#229](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/229), [#233](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/233); [five-AC author evidence](evidence/s4-t08-similar-ui/README.md) | No known unimplemented AC in that author record; **Pending whole-Story acceptance**, 0 |
| [S08 #30](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/30), 5 | [#228](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/228), [#232](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/232), [#235](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/235), [#242](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/242); [Search evidence](evidence/s4-t10-search/README.md) | Later pagination/submit-only/race fixes delivered; **Pending whole-Story acceptance**, 0 |
| [S11 #33](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/33), 3 | [#221](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/221), [#227](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/227), [#230](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/230), [#234](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/234), [#238](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/238); [reset evidence](evidence/s4-t15-reset-acceptance/README.md) | Functional evidence exists; **Pending whole-Story acceptance**, 0 |

Accepted historical Stories remain S01 #17, S02 #18, S03 #19, S04 #20,
S12 #44, S13 #45 and S05a #21, per the Sprint 3 acceptance ledger and current
Closed states. **None earns points again.** No accepted Sprint 4 whole-Story
link is available; merged delivery PR links above must not be labelled PO acceptance.

Approved changes recorded by C01: preserve half-star ratings, paginated Search
and embedded trailers where accepted; on 1 November replace repeated exhaustive
regression/report requirements with the compact six-P0 scope. C01 says this is
a scope amendment, not proof of earlier events or completion. Original approval
timestamps/capacity for the earlier feature amendments remain **Not verified**.

### Compact M4 execution and reuse of feature evidence

**Historical morning execution at `b1e8c1e`:** used that baseline's existing
EARLY_TEST_SETUP. The initial run used its exact committed tests; the amended
run includes six added S02 boundary-assertion lines pinned in the morning receipt:

```text
.venv/bin/python -m pytest tests/test_p0_acceptance.py tests/test_s03_details.py -v
```

**Morning amended run: 40 collected, 40 passed, 0 failed, 0 skipped, 0 xfailed; 5.70 s pytest
runtime, 6.646 s measured process time**, 1 November 2026,
08:55:29–08:55:35 +07:00. Initial exact-SHA baseline: 40 passed in 5.94 s
(6.887 s process time). At execution, the amended tests were uncommitted;
the wrap-up change delivers that exact patch without claiming a merge.
One inherited Starlette/httpx deprecation warning. This is Codex execution in
the existing macOS environment, not an independent human/fresh-clone run.
[Full actual output](evidence/s4-t05-compact-20261101.log) and
[37-ID / 40-node expected-versus-actual mapping](evidence/s4-t05-acceptance.md#compact-m4-wrap-up-execution--1-november-2026)
cover all six P0 Stories (8/6/9/6/5/6 items respectively).
Temporary migrated SQLite, in-process TestClient, blocked live HTTP and blank
provider token require no running server, real account database or live service.

**Merged C05:** PR #243, authored by @NguyenTuanAnh0608 at final head
`97d99d224db36871056dccee4fb835667ded2879`, supplies compact default pytest/CI,
storage tooling and the [release/recovery runbook](s4-c05-release-storage.md).
At selected main `0d2378d` and integration candidate `ba7d8f9`, plain `pytest`
selects **40 P0 items** in the two root files. Broader suites remain explicit
optional checks; no new long-suite requirement is introduced here.

The [C05 compact record](evidence/s4-c05/compact-m4.md) and
[manifest](evidence/s4-c05/compact-manifest.json) preserve **Windows author
verification** at executable `132394c57a12b81bf889227f96370f39531bbb08`:
40 passes in 15.25/15.28 s for plain/verbose commands, focused storage/startup
checks, and fresh live provisioning of **951 active TMDb movies** with recovery.
That same-production evidence is reusable for this integration; it is not a
new C02 live setup or a selected release database. @kietxuan's single formal
[approval](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/243#pullrequestreview-5724953852)
on the final head says `ok`. He also authored C05 commits, so this supplies
formal review count evidence, **not independent non-author rehearsal**.
C05 #219 remains Open for its outstanding independent setup/recovery acceptance.

**Current C02 delta versus merged main `0d2378d`:** production code, default
test selection and workflows are unchanged; executable/test changes are only
six S02 recommendation-limit assertion lines in `tests/test_p0_acceptance.py`.
Documentation changes include README. No test was deleted or skipped by this
patch. Actual checks on `ba7d8f9` belong to the separate
[integration audit](evidence/s4-c02-integration-20261101.md) and
[receipt](evidence/s4-c02-integration-20261101.json); the historical runtimes
above are not results for this integration candidate.

**Historical T20 source boundary:** the empty executable-path comparison
between `23e655c` and **`b1e8c1e`**, and **18/18** final manifest matches,
apply specifically to the morning baseline. The earlier C02 head added the
six S02 test lines and README: its T20 manifest comparison was **17/18**.
Current `ba7d8f9` also incorporates C05's test/config/CI/storage changes and
does not have the old tree. The [T20 audit](evidence/s4-t20/media-setup-audit.md)
preserves 818-pass backend / 467-pass frontend / build / clean-checkout results
at their original SHAs; these are historical results with scoped reuse.

The feature-manifest counts below come from the morning comparison against
`b1e8c1e`; they are not newly measured matches against `ba7d8f9`.

| Area | Historical reuse boundary |
|---|---|
| Rating/ranking | T03 manifest: 585/668 entries unchanged, including ranker/service/index; entire old candidate differs. Reuse rule-specific history plus T05 and later T20 regression, not the old tree as final acceptance |
| Similar | T08 manifest: 13/28 unchanged, including Similar service/widget/index. Main route/detail shell changed; retain original five-AC results with their candidate and later regression evidence |
| Search / pagination | T10 manifest: 9/26 unchanged; Search service/page changed. Old top-ten-total/auto-submit expectations are superseded; use T16 pagination/submit-only and T20's final Search race RED/GREEN evidence |
| Reset/profile | T15: 9/11 entries unchanged, including production reset/profile files. Package scripts and acceptance harness differ; old browser execution remains historical, not a fresh same-tree run |
| Watchlist / stars / half stars | Reuse [T12](evidence/s4-t12-watchlist/README.md), [T14/T16](evidence/s4-t16-t14-reconciliation.md), [T05](evidence/s4-t05-acceptance.md), later T20 regressions. Watchlist survives reset; ratings accept 0.5–5 in exact half steps |
| Build / storage / recovery | C05 #243 is merged: use its [compact manifest](evidence/s4-c05/compact-manifest.json), author build/startup/live-recovery results and [runbook](s4-c05-release-storage.md). Automated WAL/schema-aware backup/restore and compact CI exist; independent non-author acceptance remains Pending |

Source equality supports reuse; it does not establish a missing PO decision,
reviewer execution, deployed environment or fresh live import. The six-line
C02 assertion patch leaves merged-main production unchanged; its compact
verification is recorded separately from both the morning run and C05's rehearsal.

### Review, Retrospective and outcomes

**Review:** Pending team Review event. **Retrospective:** Pending team
Retrospective event. No dated event record, confirmed attendance, actual meeting
feedback or acceptance decision was accessible. Git/PR activity is not attendance.

| Member | Review attendance | Retro attendance |
|---|---|---|
| @kietxuan | Pending confirmed attendance | Pending confirmed attendance |
| @hoang3003 | Pending confirmed attendance | Pending confirmed attendance |
| @anotify-vie | Pending confirmed attendance | Pending confirmed attendance |
| @vu-huzy | Pending confirmed attendance | Pending confirmed attendance |
| @NguyenTuanAnh0608 | Pending confirmed attendance | Pending confirmed attendance |

Repository outcomes available for Review: rating-aware ranking; local-index
Similar/Search; account-owned watchlist/profile/reset; half-star draft/save;
full-set pagination and safe detail return; optional embedded trailers; all six
P0 regression journeys. The four new Stories still require explicit AC/DoD decisions.

Evidence-derived lessons proposed for the Retro: passing author tests and a merge
do not prove independent reproduction or whole-Story acceptance; source manifests
need comparison before reuse; planned test stewardship does not establish authorship.
These are audit findings, **not recorded team-agreed Retro outcomes**.

**Concrete proposed improvement:** before SM5 accepts a release candidate,
attach one dated receipt containing executable SHA, TC-ID/node, actual result,
test-author evidence and independent review link for each outstanding gate.
**Proposed accountable owner: SM4 @anotify-vie**, transferring the receipt to
SM5 @kietxuan. Team agreement, due date and actual completion remain **Pending**.
The team must fill real event dates, attendance, feedback, Story decisions,
agreed lesson/action/owner/date and the actual handoff acknowledgement here.

### Contribution audit

**M4 team minimums:** at least **4 reviewed-and-merged Sprint 4 PRs** and
**5 closed Sprint 4 issues**. The current totals are **24 merged PRs #220–#243**
and **21 Closed Sprint 4 items**, so both team counts are met.
**Per-member minimums are separate:** **1 merged PR, 1 formal review given,
1 closed issue and 1 authored pytest in root `tests/`**. Neither the four-PR
nor the five-issue team threshold is a per-member threshold.

Closed issues below are attributed by **native assignee**, not by an inferred
closer. All 24 PRs have a pre-merge formal `APPROVED` review by someone other
than the PR author. Sixteen have such approval on the final head; eight
(#220/#221/#224/#235/#236/#237/#239/#240) only on older heads.
Many review bodies are `ok` or empty. This meets the observable formal-review
count, not a claim of substantive independent verification or final acceptance.

| Member | S4 merged PRs (minimum 1) | S4 Closed assigned issues (minimum 1) | Sample formal review given (minimum 1) |
|---|---|---|---|
| @kietxuan | **5, met**: [#220](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/220), [#221](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/221), [#224](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/224), [#230](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/230), [#235](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/235) | **4, met**: #195/#206/#208/#211 | **Met**: [Approve #222](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/222#pullrequestreview-5637256620) |
| @hoang3003 | **5, met**: [#222](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/222), [#223](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/223), [#227](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/227), [#234](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/234), [#241](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/241) | **5, met**: #197/#207/#209/#214/#217 | **Met**: [Approve #220](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/220#pullrequestreview-5636903087) |
| @anotify-vie | **5, met**: [#226](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/226), [#232](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/232), [#236](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/236), [#239](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/239), [#240](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/240) | **4, met**: #198/#205/#212/#213 | **Met**: [Approve #220](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/220#pullrequestreview-5637095862) |
| @vu-huzy | **4, met**: [#229](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/229), [#231](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/231), [#233](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/233), [#238](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/238) | **4, met**: #199/#202/#203/#210 | **Met**: [Approve #220](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/220#pullrequestreview-5637501944) |
| @NguyenTuanAnh0608 | **5, met**: [#225](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/225), [#228](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/228), [#237](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/237), [#242](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/242), [#243](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/243) | **4, met**: #200/#201/#204/#215 | **Met**: [Approve #220](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/220#pullrequestreview-5637104039) |

All five members meet the merged-PR/review-given/closed-issue counts. Authored
root pytest evidence is evaluated separately below; it remains incomplete.

Root-test authorship was checked with file history, function-line blame and
GitHub commit-author records, not PR ownership or C01 stewardship:

| Member | Root pytest file / function / TC-ID | Authorship evidence and status |
|---|---|---|
| @kietxuan | `tests/test_s03_details.py::test_TC_P0_S03_001_public_known_id`; TC-P0-S03-001 | **Verified**: introduction/blame [31c5bf7](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/commit/31c5bf7b9e8b006809a1bb2fcb69338589246421) in merged #235; GitHub author login `kietxuan`; test passed in the historical morning compact run |
| @hoang3003 | Pending verification | No authored root pytest established; planned S13 stewardship does not supply authorship |
| @anotify-vie | Pending verification | No authored root pytest established; #239/#240 PR ownership does not transfer Codex-authored bootstrap tests to this member |
| @vu-huzy | Pending verification | No authored root pytest established; planned S03 stewardship does not transfer Kiet's authored tests |
| @NguyenTuanAnh0608 | Candidate: `tests/test_p0_acceptance.py::test_TC_P0_S12_001_eight_char_normalized_hashed_registration`; TC-P0-S12-001 | **Pending user identity confirmation**: blame/introduction [f0b56b7](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/commit/f0b56b790f2edaa2bac8830c17d8cc6f1922756b) in merged #237 says `Tuan Anh <nguyentuananh0608tuananh@gmail.com>`; GitHub maps the commit to **@TuanAnh0608 (ID 247933931)**, whereas PR author is **@NguyenTuanAnh0608 (ID 224349508)**. These are different GitHub accounts; person equivalence requires user confirmation. The historical test pass supplies no identity proof |

The saved introduction audit also identifies `Codex <codex@openai.com>` for
setup probes; this supplies no human contribution credit. The three members
without an established authored case remain Pending, and Nguyen's identity
question remains separate. Thus the all-member pytest requirement
is **not demonstrated**. Team members should first link any existing qualifying
authored case/commit/review or confirm the account discrepancy; no dedicated
extra test PR or invented coauthor credit is required by this audit.

### G4, scope outcomes, defects and capacity

**G4 decision: reported PO Go, already confirmed by the user.** The
[31 October T19 record](evidence/s4-t19-live-20261031.md) records that report;
the [T20 amendment](evidence/s4-t20/media-setup-audit.md) records authorization
of embedded playback. The [30 October preflight](evidence/s4-t18-core-pre-g4/follow-up/README.md)
recommended Defer earlier, with capacity/independent-execution gaps; preserve
it as earlier history. A separate dated repository PO decision/capacity record
is **Pending documentation**. This records the existing Go; it does not create
a new approval gate or reopen the user's confirmed decision.

Actual trailer outcome: **implemented and merged**, T19 #214 / PR #241 and
T20 #215 / PR #242 are Closed/merged. Current UI has a button below the poster,
an on-page player, and an unavailable caption for null data. Old external-tab
evidence is historical. Independent functional acceptance remains a human
follow-up; the reported Go and embedded-scope authorization are already recorded.

Core delivery includes watchlist, explicit-save stars/half stars, title-first
and description Search, complete-set pagination, ranking, Similar and reset
that preserves watchlist. Closed implementation Tasks and prior P0 acceptance
are established; final acceptance of the four new parent Stories is still Pending.
No new product failure was observed in the historical morning compact P0 run.

Known limitations/work: C05 compact defaults/CI and schema-aware WAL recovery
are implemented and merged. The C05 author record documents the hot
rollback-journal defect and merged fix; independent setup/recovery acceptance
remains Pending. Legacy Story issue text
and implementation contract differences still need PO reconciliation; the T05
record lists integer-star/login-destination amendments. Existing T20 evidence
records 18 development dependency advisories (4 high; earlier production-only
audit 0) and the inherited Starlette warning; neither was re-audited here.
No verified remaining-defect count or release deployment exists in this audit.

| Member | Outstanding responsibility from current evidence | Confirmed remaining hours / capacity |
|---|---|---|
| @kietxuan | C01 #216, PO acceptance, dated PO/capacity documentation and SM5 receipt | **Pending member confirmation** |
| @anotify-vie | C02 #196, actual Review/Retro record and handoff; independent reviews as eligible | **Pending member confirmation** |
| @NguyenTuanAnh0608 | C05 #219, #243 final independent setup/recovery acceptance | **Pending member confirmation** |
| @vu-huzy | C04 #218 report/submission and C05 independent review if eligible | **Pending member confirmation** |
| @hoang3003 | Confirm contribution evidence and remaining eligible review work | **Pending member confirmation** |

Recorded historical estimates are C01 3h + 0.5h review, C02 3h author,
C04 7h + 1h review, C05 6h + 1h review. They are **not** current remaining
hours, actual time spent or proof of G4 capacity. Final correction/review buffer
and any additional deferral require a C01 PO decision with owner/new issue/date.

### Sprint 5 handoff to SM5 @kietxuan

**Selected merged baseline:** `main`,
**`0d2378d5f0c44889ca93c8cff7c8bc9c568b43c5`** (PR #243 merge).
**Current C02 integration test candidate:**
**`ba7d8f9b01a2d26680205991e7f980d1d45d22cd`** in PR #244.
Its only executable/test delta versus selected main is the six S02 assertion
lines; production is unchanged. SM5 acknowledgement/date: **Pending**.
Final release acceptance remains Pending the documented human follow-ups.

| Handoff field | Verified value / follow-up |
|---|---|
| Migration | Single repository Alembic head **`a3d1f8b72c44`**, also recorded in C05's Windows rehearsal; installed release DB revision **Not verified** |
| Search/index revision | Model **`overview-tfidf-v1`**, artifact version **1**; index implementation last changed at `ceec4426366d4635dfb3a7f620ed131141f7b47a` |
| Index config revision | Observed `config_fingerprint()` = **`41785781f34ba44091ac64f3b1c0503402ee760c518af1429d0acb94bbc31c99`** |
| App config revision | Committed config at selected SHA; `.env.example` last changed at `cbd7d55f25df28c8eb1484d54a4ce6299da403f3`. Private runtime environment/paths **Not verified**, never copied into evidence |
| Actual release catalogue/index | **Pending operator selection/check**. T18's 964-movie revision `00a9831b-1c3a-489b-a8cf-51d36424e702`, T19's 831-movie revision `3cb8f1aa-61cc-4df6-8da6-1205ddc21da6` and C05's fresh 951-movie Windows author rehearsal are separate recorded snapshots; none establishes the selected release DB |
| Setup | Follow [SETUP](SETUP.md#steps): locked Python/backend and npm installs; one explicit DB for migrate/import `--pages 50`/trailer enrichment `--all`; rebuild/check index, provision review account, start backend/frontend; verify health migration plus catalogue/details/Search/Similar. Live import needs a private server-side operator token; runtime uses local data |
| Recovery | Merged [C05 release/storage runbook](s4-c05-release-storage.md) and [index readiness](overview-index.md#build-and-readiness). `storage_snapshot inspect/backup/restore` is implemented. Stop writers for restore; preserve original data, use an unused destination with no DB/WAL/SHM/journal sidecars, migrate to head and rebuild/check the index. Independent non-author rehearsal/acceptance remains Pending |
| C05 evidence | [Compact record](evidence/s4-c05/compact-m4.md) / [manifest](evidence/s4-c05/compact-manifest.json), executable `132394c`, final PR head `97d99d2`, merged in `0d2378d`. Windows author clean-clone/live-951/recovery evidence is reusable for unchanged production; it is not a new C02 live import or independent rehearsal |
| Evidence packet | [Current integration audit](evidence/s4-c02-integration-20261101.md) / [receipt](evidence/s4-c02-integration-20261101.json); immutable morning compact log/37-ID map and receipt; historical [T20 source/build/Search fix](evidence/s4-t20/media-setup-audit.md); scoped feature histories and C05 manifest. Formal approvals are linked; substantive independent whole-Story/recovery acceptance **Pending** |
| Known unfinished scope | #22/#24/#30/#33 AC/DoD acceptance; C01 actual Planning commitment/board/dated capacity, C02 Review/Retro/PO acceptance, C05 independent setup/recovery acceptance, root-test authorship gaps and Nguyen account confirmation. Proposed carry-over needs explicit C01 approval |
| Explicit Sprint 5 work | **VN providers and release revalidation**, plus any explicitly approved deferred/unaccepted scope. PO must identify owners/new issue links for unrecorded transfers; this audit creates none |
| Separate dossier/submission work | C04 #218 **Open / Pending**, without blocking C02. Consume this log/mapping/audit now; actual final report review, manual `Team03_M4.pdf`, board/test-output screenshots and LMS receipt stay with C04. No new PDF tool or submission requirement is introduced by this update |

The integration audit records actual new commands/results separately; historical
morning and C05 runs retain their original candidates, platforms and times.
This wrap-up reuses scoped evidence without claiming a new live setup or
deployment. Actual committed points, Review/Retro dates/attendees/decisions,
PO whole-Story and wrap-up acceptance, member capacity, authorship confirmation,
C05 independent rehearsal and SM5 acknowledgement remain **Pending** until their
real records are supplied. C02 remains partial delivery under `Refs #196`.
