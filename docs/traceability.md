# Traceability

This is the source of truth for Story routes. A Story Issue's **Related screen / route**
must match a row below. Update this table in the same PR whenever a route, Story, or
implemented PR changes.

## Screen and Story map

| Route | Purpose | Access | Priority | Feature | Story issue(s) | Relevant rules | PR | Status |
|---|---|---|---|---|---|---|---|---|
| `/` | Landing route: begin choosing genres or see the non-personalised cold-start fallback. | G | P0 | F1, F4 | #17 S01, #20 S04 | BR1, BR5 | — | Open / Backlog |
| `/preferences` | Select, save, and revisit 1–5 favourite genres. | G | P0 | F1 | #17 S01 | BR1, BR8 | — | Open / Backlog |
| `/recommendations` | Show personalised movies, no-match fallback, cold-start results, and the in-list genre filter. | G | P0 | F2, F4, F7 | #18 S02, #20 S04, #23 S06 | BR2–BR5, BR10 | — | Open / Backlog |
| `/movies/:movieId` | View movie details; later rate a movie and find similar movies. | G | P0 details; P1 additions | F3, F5, F6, F8 | #19 S03, #21 S05a, #22 S05b, #24 S07 | BR6–BR9, BR11 | — | Open / Backlog |
| `/search` | Search the catalogue by title and open a result's movie details. | G | P1 | F9 | #30 S08 | BR12 | — | Open / Backlog |
| `/popular` | Browse the ranked popular-movie list independently of recommendation fallback. | G | P1 | F10 | #31 S09 | BR5 | — | Open / Backlog |
| `/about-recommendations` | Explain, in three steps, how genres and optional ratings affect recommendations. | G | P2 | F11 | #32 S10 | BR13 | — | Open / Backlog |
| `/profile` | Confirm and reset saved personalisation data. | G | P2 | F12 | #33 S11 | BR8, BR14 | — | Open / Backlog |

**Access codes:** G = guest; U = authenticated user; A = administrator. The current
MVP has no accounts, so all planned routes are G. `Open / Backlog` describes the
current pre-implementation state, not an assertion that a feature is complete.

## Feature and rule map

| Feature | Capability | Story | Rules |
|---|---|---|---|
| F1 | Select favourite genres | #17 / S01 | BR1, BR8 |
| F2 | Get recommendations based on preferences | #18 / S02 | BR2–BR4 |
| F3 | View movie details | #19 / S03 | BR6 |
| F4 | Explore without preferences | #20 / S04 | BR5 |
| F5 | Rate or save a movie | #21 / S05a | BR7, BR8 |
| F6 | Improve ranking from ratings | #22 / S05b | BR3, BR9 |
| F7 | Filter recommendations by genre | #23 / S06 | BR10 |
| F8 | Find similar movies | #24 / S07 | BR11 |
| F9 | Search for a movie by title | #30 / S08 | BR12 |
| F10 | Browse popular movies | #31 / S09 | BR5 |
| F11 | Learn how recommendations are personalised | #32 / S10 | BR13 |
| F12 | Reset the personalisation profile | #33 / S11 | BR8, BR14 |

## Implementation and reporting rules

1. A PR that implements a route adds its PR number and changes only its relevant
   row(s) from `Open / Backlog` to `In progress` or `Done` after the linked Story
   meets the Definition of Done.
2. A PR that only creates a task, rule, document, or design never marks a product
   Story Done.
3. C04 uses this file for the M1 screens-and-flow section. The M1 diagram must include
   all eight routes above or clearly show a reachable path to every route listed.
4. The authoritative rule wording and numeric worked examples are in
   [`docs/business-rules.md`](business-rules.md).
