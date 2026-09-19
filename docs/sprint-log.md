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

**Completed work:** 5 of 5 committed Chores.

**Unfinished work:** None among the five committed Sprint 1 Chores.

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
- S04 was refined to show at most 10 non-personalised popular movies, ordered by
  popularity descending and title A-Z for equal scores, with a visible action
  to choose genres.
- Mood-based discovery remained outside the MVP pending data-source evidence
  and testable acceptance criteria.

#### Carried-over and unresolved items

- None of the five committed Sprint 1 Chores was carried over.
- The board evidence shows the movie-data Spike #16 as In Progress, while the
  backlog-refinement decision says to keep it in Backlog. The team must reconcile
  its iteration and status before the final Sprint 1 snapshot.
- Product Stories S01-S11 are backlog work rather than unfinished Sprint 1
  commitments and therefore are not counted as carry-over from this sprint.

### Sprint Review

**Review date:** Not recorded in the repository.

**Repository outcomes available for demonstration:**

- A research-backed product scope and 12-Story backlog.
- Three personas and their scenarios.
- The M1 requirements document, screen flow, business rules, and route-to-Story
  traceability.
- Repository process rules, issue templates, Definition of Done, and README
  handoff information.

**Feedback received:** Not recorded in the repository.

**Backlog changes resulting from the recorded refinement work:** S06 was
promoted, S05 was split, S08-S11 were added, and S04's cold-start behaviour was
made deterministic. The repository does not identify which changes, if any,
were specifically agreed during a Sprint Review meeting.

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
