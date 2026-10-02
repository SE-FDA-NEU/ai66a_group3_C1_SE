# Sprint log

This log records only facts supported by the repository, Git history, and the
saved Project-board evidence. Meeting details that are not present in those
sources are marked as not recorded rather than reconstructed as facts.

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

The recorded Sprint plan commits 21 named Tasks and five Chores to the Sprint 2
iteration. It links those Tasks to five parent Stories, but it also explicitly
requires the partially implemented parent Stories to remain open. The parent
Stories and their complete estimates are:

| Parent Story | Story points | Sprint 2 task coverage |
| ------------ | -----------: | ---------------------- |
| [#19 / S03](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/19) | 3 | #47, #48, #60, #61, #62, #74 |
| [#20 / S04](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/20) | 5 | #58, #59 |
| [#32 / S10](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/32) | 3 | #63, #64, #65 |
| [#44 / S12](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/44) | 3 | #49, #50, #51, #52 |
| [#45 / S13](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/45) | 5 | #53, #54, #55, #56, #57, #66 |

The five parent estimates total 19 points, but the evidence does not commit
completion of those five whole Stories. Counting those full estimates would
claim scope that #67 explicitly identifies as partial. Task hours are not
Story Points and are not substituted for velocity.

**Verified committed Story Points:** 0.

**Verified completed Story Points:** 0. All five parent Stories remain open,
their acceptance-criterion checklists remain incomplete, and none meets the
repository's whole-Story Definition of Done.

**Velocity:** 0 Story Points.

If a dated Planning artifact or start-of-Sprint board snapshot proves that one
or more whole parent Stories were committed for completion, the committed
figure must be corrected from that artifact before this wrap-up is merged. The
completed figure remains zero unless the corresponding whole Story reaches
Done.

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

- **Final Sprint 2 board screenshot:** Not available. The Project board requires
  authenticated access; no Sprint 2 board image is committed under
  `docs/evidence/` as of 2026-10-03.
- **Documentation PR:** Not available yet. This section was prepared on local
  branch `docs/sprint-2-wrap-up` and must link its reviewed PR before merge.
- **Closure rule:** Do not close #68 until the Sprint has ended, the final board
  screenshot is committed, the retrospective action and owner are recorded,
  the next Sprint Master handoff is recorded, every open item has an agreed
  next iteration, and the documentation PR is reviewed and merged.
