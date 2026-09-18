# Traceability

This is the source of truth for Story routes. A Story Issue's "Related screen / route"
must match a row below. Update this table in the same PR whenever a route, Story, or
implemented PR changes.

## Screen and Story map

| Route | Purpose | Access | Priority | Feature | Story issue(s) | Relevant rules | PR | Status |
|---|---|---|---|---|---|---|---|---|
| `/` | Landing route: begin choosing genres or see the non-personalised cold-start fallback. | G | P0 | F1, F4 | #17 S01, #20 S04 | BR1, BR5 | TBD | Open / Backlog |
| `/preferences` | Select, save, and revisit 1 to 5 favourite genres. | G | P0 | F1 | #17 S01 | BR1, BR8 | TBD | Open / Backlog |
| `/recommendations` | Show personalised movies, no-match fallback, cold-start results, and the in-list genre filter. | G | P0 | F2, F4, F7 | #18 S02, #20 S04, #23 S06 | BR2 to BR5, BR10 | TBD | Open / Backlog |
| `/movies/:movieId` | View movie details; later rate a movie and find similar movies. | G | P0 details; P1 additions | F3, F5, F6, F8 | #19 S03, #21 S05a, #22 S05b, #24 S07 | BR6 to BR9, BR11 | TBD | Open / Backlog |
| `/search` | Search the catalogue by title and open a result's movie details. | G | P1 | F9 | #30 S08 | BR12 | TBD | Open / Backlog |
| `/popular` | Browse the ranked popular-movie list independently of recommendation fallback. | G | P1 | F10 | #31 S09 | BR5 | TBD | Open / Backlog |
| `/about-recommendations` | Explain, in 3 steps, how genres and optional ratings affect recommendations. | G | P2 | F11 | #32 S10 | BR13 | TBD | Open / Backlog |
| `/profile` | Confirm and reset saved personalisation data. | G | P2 | F12 | #33 S11 | BR8, BR14 | TBD | Open / Backlog |

Access codes: G = guest; U = authenticated user; A = administrator. The current
MVP has no accounts, so all planned routes are G. `Open / Backlog` describes the
current pre-implementation state, not an assertion that a feature is complete.

## Feature and rule map

| Feature | Capability | Story | Rules |
|---|---|---|---|
| F1 | Select favourite genres | #17 / S01 | BR1, BR8 |
| F2 | Get recommendations based on preferences | #18 / S02 | BR2 to BR4 |
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

## Persona matrix

Each need is taken from the "Needs from the product" list of the persona in
`docs/personas.md`.

| Persona | Need | Feature | Rules | Route | Issue |
|---|---|---|---|---|---|
| Frequent Explorer | Select favourite genres as input | F1 | BR1, BR8 | `/preferences` | #17 |
| Frequent Explorer | Receive a small, relevant list with a reason for each match | F2 | BR2, BR3, BR4 | `/recommendations` | #18 |
| Frequent Explorer | Filter the current list by genre | F7 | BR10 | `/recommendations` | #23 |
| Frequent Explorer | Open a movie details page | F3 | BR6 | `/movies/:movieId` | #19 |
| Frequent Explorer | Continue exploring similar movies | F8 | BR11 | `/movies/:movieId` | #24 |
| Occasional Undecided Viewer | See popular movies when no preferences exist | F4 | BR5 | `/`, `/recommendations` | #20 |
| Occasional Undecided Viewer | Have a visible action to select 1 to 5 genres | F1 | BR1 | `/`, `/preferences` | #17 |
| Occasional Undecided Viewer | See popular alternatives and an option to edit preferences when nothing matches | F2 | BR4 | `/recommendations` | #18 |
| Occasional Undecided Viewer | Use the product without rating movies | F5 | BR7 | `/movies/:movieId` | #21 |
| Detail-Oriented Chooser | See a clear reason why a movie was recommended | F2 | BR2 | `/recommendations` | #18 |
| Detail-Oriented Chooser | Open detailed information before deciding | F3 | BR6 | `/movies/:movieId` | #19 |
| Detail-Oriented Chooser | Filter recommendations by genre | F7 | BR10 | `/recommendations` | #23 |
| Detail-Oriented Chooser | Continue exploring similar movies | F8 | BR11 | `/movies/:movieId` | #24 |

Stories S05b, S08, S09, S10 and S11 (#22, #30 to #33) are not listed under any
persona in `docs/personas.md`, so they do not appear in this matrix.

## Implementation and reporting rules

1. A PR that implements a route adds its PR number and changes only its relevant
   row(s) from `Open / Backlog` to `In progress` or `Done` after the linked Story
   meets the Definition of Done.
2. A PR that only creates a task, rule, document, or design never marks a product
   Story Done.
3. C04 uses this file for the M1 screens-and-flow section. The M1 diagram must include
   all eight routes above or clearly show a reachable path to every route listed.
4. The rule wording and numeric worked examples are in section 5 of
   [`docs/requirements.md`](requirements.md).
