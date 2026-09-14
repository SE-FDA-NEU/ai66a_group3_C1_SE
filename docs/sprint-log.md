# Sprint log

One section per sprint. Fill it in during the sprint, not the night before the
milestone deadline. The commit timestamps on this file are part of the evidence
that the process was real.

---

## Sprint 1 - 2026-09-11 to 2026-09-14

### Sprint goal

Make the AI Movie Recommendation System ready for implementation by setting up
the Sprint 1 board, issue workflow, process evidence, and a prioritized product
backlog with traceable stories.

### Committed

Sprint 1 contained process/setup work plus the initial product backlog stories.
Story points are counted only where the issue body included an explicit story
point estimate. Chores and the spike were committed work but were not estimated
as story points in GitHub.

| Issue | Story / work item | Points | Owner |
|-------|-------------------|--------|-------|
| #11 | [Chore] C01 - Refine Sprint 1 backlog | - | @kietxuan |
| #12 | [Chore] C02 - Sprint 1 wrap-up | - | @hoang3003 |
| #13 | [Chore] C03 - Collect and synthesize evidence for two personas | - | @anotify-vie |
| #14 | [Chore] C04 - Complete the M1 requirements dossier and traceability | - | @vu-huzy |
| #15 | [Chore] C05 - Review repository setup and team information | - | @NguyenTuanAnh0608 |
| #16 | [Spike] Investigate movie data and the initial recommendation approach | - | @NguyenTuanAnh0608 |
| #17 | [Story] S01 - Select favorite genres to start choosing a movie | 3 | @hoang3003 |
| #18 | [Story] S02 - Get a movie list based on preferences | 5 | @kietxuan |
| #19 | [Story] S03 - View movie details before deciding | 3 | @NguyenTuanAnh0608 |
| #20 | [Story] S04 - Explore movies without preferences | 5 | @vu-huzy |
| #21 | [Story] S05a - Rate a movie and save feedback | 3 | @anotify-vie |
| #22 | [Story] S05b - Use movie ratings to improve recommendations | 5 | @hoang3003 |
| #23 | [Story] S06 - Filter recommendations by genre | 3 | @kietxuan |
| #24 | [Story] S07 - Find similar movies from the details page | 3 | @vu-huzy |

**Total committed: 30 story points plus 6 unestimated process items**

### Result

At wrap-up, none of the committed Sprint 1 issues had a linked closing PR merged
to `main`. The issue state check was taken from the public GitHub issue data for
`SE-FDA-NEU/ai66a_group3_C1_SE` on 2026-09-14.

| Issue | Points | Final status | If not done, why |
|-------|--------|--------------|------------------|
| #11 | - | Carried over | Open on GitHub; backlog refinement evidence not merged into `main`. |
| #12 | - | Carried over | Sprint wrap-up docs are in PR #25 with review requested from @kietxuan; approval and merge are not completed. |
| #13 | - | Carried over | Open on GitHub; persona evidence and synthesis were not recorded in merged docs. |
| #14 | - | Carried over | Open on GitHub; M1 dossier and traceability still need review and merge evidence. |
| #15 | - | Carried over | Open on GitHub; repository setup review still needs recorded completion evidence. |
| #16 | - | Carried over | Open on GitHub; spike findings were not recorded as a merged decision. |
| #17 | 3 | Carried over | Open on GitHub; no implementation PR merged. |
| #18 | 5 | Carried over | Open on GitHub; no implementation PR merged. |
| #19 | 3 | Carried over | Open on GitHub; no implementation PR merged. |
| #20 | 5 | Carried over | Open on GitHub; no implementation PR merged. |
| #21 | 3 | Carried over | Open on GitHub; no implementation PR merged. |
| #22 | 5 | Carried over | Open on GitHub; no implementation PR merged. |
| #23 | 3 | Carried over | Open on GitHub; no implementation PR merged. |
| #24 | 3 | Carried over | Open on GitHub; no implementation PR merged. |

**Completed: 0 story points. Velocity this sprint: 0**

### Final Sprint 1 Board Snapshot

Snapshot file: [docs/evidence/sprint1-board-final.md](evidence/sprint1-board-final.md)

| Board column | Cards at wrap-up |
|--------------|------------------|
| Done | #10 only; this was already closed and is not counted in the Sprint 1 commitment above. |
| In Review | #12. |
| In Progress | #11, #13, #14, #15. |
| Todo | #16, #17, #18, #19, #20, #21, #22, #23, #24. |

### Sprint Review

- What we demonstrated: GitHub issue templates for stories, tasks, bugs,
  chores, and spikes; the Sprint 1 board structure; process rules; Definition of
  Done; and the first traceability skeleton for the movie recommendation system.
- Feedback received: the backlog was broad enough for the product direction but
  too much was committed without closing evidence, linked PRs, or visible review
  records.
- Backlog changes as a result: keep #17-#24 as the implementation backlog for
  Sprint 2, keep #11-#16 as process carry-over items, and reduce Sprint 2 WIP
  before starting new product stories.

### Retrospective

| Keep doing | Stop doing | Start doing |
|------------|------------|-------------|
| Keep using GitHub issues, labels, PRs, and traceability docs as the shared source of truth. | Stop leaving issue progress, blockers, and review status outside GitHub where the next Scrum Master cannot verify them. | Start one mid-sprint board check that records a next step or blocker on every issue that has not moved. |

**One concrete action for next sprint (with an owner):** In Sprint 2, @hoang3003
will run one 10-minute mid-sprint board check and add a blocker or next-step
comment to every issue that has not moved since planning.

### Blockers

- PR #25 was opened for #12 and review was requested from @kietxuan, but no
  teammate approval was present at wrap-up, so merge and issue closure remain
  blocked.
- Project board field data was not available through the public issue API; the
  final board snapshot is recorded as a text snapshot from the available board
  evidence and public issue states.
- No Sprint 1 issue comments were present on #11-#24, so blockers and attendance
  could not be verified from GitHub discussion history.

### Unfinished Work and Carry-over

All committed Sprint 1 issues were unfinished at wrap-up and should be carried
into Sprint 2: #11, #12, #13, #14, #15, #16, #17, #18, #19, #20, #21, #22, #23,
and #24. Issue #12 has PR #25 open and waiting for teammate review.

### Scrum Master Handover

Next Scrum Master should start from the final board snapshot above, follow up on
the requested @kietxuan review for PR #25, check the single retro action with
@hoang3003, and re-plan the carried-over issues before accepting new Sprint 2
work.

### Attendance

Planning attendance is evidenced only by assigned Sprint 1 issues. Review and
retro attendance were not recorded in GitHub comments or merged notes, so they
are marked as not evidenced rather than assumed.

| Member | Planning | Review | Retro |
|--------|----------|--------|-------|
| @anotify-vie | Assigned Sprint 1 work (#13, #21) | Not evidenced | Not evidenced |
| @hoang3003 | Assigned Sprint 1 work (#12, #17, #22) | Not evidenced | Prepared wrap-up docs for #12 |
| @kietxuan | Assigned Sprint 1 work (#11, #18, #23) | Not evidenced | Not evidenced |
| @vu-huzy | Assigned Sprint 1 work (#14, #20, #24) | Not evidenced | Not evidenced |
| @NguyenTuanAnh0608 | Assigned Sprint 1 work (#15, #16, #19) | Not evidenced | Not evidenced |
