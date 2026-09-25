# Definition of Done

A story is Done when **all** of the following are true. Not "mostly true".
An unfinished Story never earns completed Story points. If completion was
committed this sprint, record unfinished/carry-over. If only named technical
milestones were planned, record those Tasks separately, not a completed parent
Story. Record the planned closure sprint and review one-sprint readiness at Planning.

| # | Criterion | Who checks |
|---|-----------|------------|
| 1 | Every acceptance criterion on the issue passes | Reviewer, by hand |
| 2 | The feature works from a clean clone with only the README steps | Reviewer |
| 3 | At least one automated test covers the new behaviour | CI |
| 4 | CI is green on the PR branch | CI |
| 5 | Code reviewed and approved by a teammate who did not write it | GitHub |
| 6 | Merged into `main` | GitHub |
| 7 | No secrets, `.env`, or database dumps in the diff | CI |
| 8 | `docs/traceability.md` updated if a screen or route changed | Reviewer |

## What Done is not

- "It works on my machine" - criterion 2 exists for this reason.
- "I will write the test later." Tests accompany implementation. Sprint 4 is the testing milestone;
  the final demo is Sprint 5 / session 15.
- "My teammate approved it in five seconds." A review with no comments on a
  300-line PR is not a review. Ask a real question.

## Documentation and requirements PRs

Requirements work does not make a product Story Done. A documentation PR is ready to
merge when it links its planned chore, contains checkable statements backed by the
relevant Issue or research evidence, updates traceability when a route/rule changes,
passes the applicable CI checks, and is approved by a teammate who did not author the
change. It must not invent interview evidence, test results, implementation status, or
future Sprint outcomes.

## Changing this document

The team may add criteria at a retrospective. Removing one requires the
lecturer's agreement, and the reason goes in the retro notes.
