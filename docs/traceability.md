# Traceability

Every screen traces back to a feature and forward to the issue that built it.
This table is the single source of truth for Milestone 1 section 6 and for the
Milestone 4 report. Keep it current - a PR that adds a route and does not
update this file should not be approved.

| Route | Purpose | Access | Priority | Feature | Story issue | PR | Status |
|-------|---------|--------|----------|---------|-------------|-----|--------|
| `/` | Entry point: start the flow, or land here as a returning guest | G | P0 | F1, F4 | #17, #20 | TBD | Not started |
| `/preferences` | Pick 1 to 5 favourite genres; come back later and change them | G | P0 | F1 | #17 | TBD | Not started |
| `/recommendations` | Up to 10 personalised or popular movies with a match reason; filter by genre | G | P0 | F2, F4, F7 | #18, #20, #23 | TBD | Not started |
| `/movies/:movieId` | Movie details, rate the movie, and similar movies | G | P0 for details, P1 for rating/similar | F3, F5, F6, F8 | #19, #21, #22, #24 | TBD | Not started |

**Access codes:** G = guest (not logged in) · U = authenticated user · A = admin

**Status:** Not started / In progress / Done

Feature codes F1-F8 and what each business rule means are spelled out in
[`docs/m1-requirements-dossier.md`](m1-requirements-dossier.md) sections 2
and 3. They are kept there, not repeated here, so there is one place to
update.

## Business rules

Numbered, so issues and tests can cite them.

| # | Rule | Enforced where | Tested by |
|---|------|----------------|-----------|
| BR1 | Pick 1 to 5 favourite genres before getting recommendations | `/preferences` | AC on #17 |
| BR2 | A recommended movie matches at least one selected genre | `/recommendations` | AC on #18, #22 |
| BR3 | A guest with no saved preferences can still see popular movies | `/`, `/recommendations` | AC on #20 |
| BR4 | No matching movies shows an empty state with popular alternatives and an edit-preferences action | `/recommendations` | AC on #18, #20 |
| BR5 | Every movie has a unique ID used to open its details page | `/movies/:movieId` | AC on #19 |
| BR6 | A valid rating is a whole number from 1 to 5 | `/movies/:movieId` | AC on #21 |
| BR7 | Preferences and ratings only belong to the current session | `/preferences`, `/movies/:movieId` | AC on #17, #21 |
| BR8 | The genre filter only touches the list already on screen, not the saved preferences | `/recommendations` | AC on #23 |
| BR9 | Similar movies share a genre with the original and exclude it | `/movies/:movieId` | AC on #24 |
| BR10 | A recommendation result has no duplicates and never more than 10 movies | `/recommendations` | AC on #18, #22 |
| BR11 | Ratings 4-5 are positive, 1-2 negative, 3 neutral, for future ranking | `/movies/:movieId`, `/recommendations` | AC on #22; data source pending spike #16 |
| BR12 | Popular/fallback movies are ordered by an agreed popularity criterion | `/`, `/recommendations` | AC on #20; final criterion pending spike #16 |

Automated tests for these rules will land with the implementing PRs from
Sprint 2 onward. The "Tested by" column points at each story's acceptance
criteria for now, since that is the actual test contract during Sprint 1.
