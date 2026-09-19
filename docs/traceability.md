# Traceability

This file is the project's route crosswalk. A GitHub Story issue is the source
of truth for its title, priority, points and acceptance criteria; its
`Related screen / route` field must match one or more rows below. Update the
affected Story issue, this file and `docs/requirements.md` in the same PR
whenever a route or requirement changes.

## Screen and Story map

| Route | Purpose | Access | Priority | Feature | Story issue(s) | Relevant rules | PR | Status |
|---|---|---|---|---|---|---|---|---|
| `/` | Start genre selection, open the popular list, read the explanation, or open the profile. It also begins the non-personalised cold-start journey. | G | P0 | F1, F4, F10, F11, F12 | #17 S01, #20 S04 | BR1, BR5 | — | Open / Backlog |
| `/preferences` | Select, save, and revisit 1 to 5 favourite genres. | G | P0 | F1 | #17 S01 | BR1, BR8 | TBD | Open / Backlog |
| `/recommendations` | Show personalised movies, no-match alternatives, cold-start results, rating-informed ranking and the current-list genre filter. | G | P0 | F2, F4, F6, F7 | #18 S02, #20 S04, #22 S05b, #23 S06 | BR2, BR3, BR4, BR5, BR9, BR10 | — | Open / Backlog |
| `/movies/:movieId` | View details, save an optional rating, and find similar movies; rating feedback affects later recommendations. | G | P0 details; P1 additions | F3, F5, F6, F8 | #19 S03, #21 S05a, #22 S05b, #24 S07 | BR6, BR7, BR8, BR9, BR11 | — | Open / Backlog |
| `/search` | Search the catalogue by title and open a selected result's details. | G | P1 | F9 | #30 S08 | BR12 | — | Open / Backlog |
| `/popular` | Browse a ranked popular-movie list independently of recommendation fallback. | G | P1 | F10 | #31 S09 | BR5 | — | Open / Backlog |
| `/about-recommendations` | Explain in exactly 3 steps how genres and optional ratings affect recommendations. | G | P2 | F11 | #32 S10 | BR13 | — | Open / Backlog |
| `/profile` | Confirm and reset the current session's saved genres and ratings. | G | P2 | F12 | #33 S11 | BR8, BR14 | — | Open / Backlog |

Access codes: G = guest; U = authenticated user; A = administrator. The current
MVP has no accounts, so all planned routes are G. `Open / Backlog` describes the
current pre-implementation state, not an assertion that a feature is complete.

## Feature and rule map

| Feature | Capability | Story | Rules |
|---|---|---|---|
| F1 | Select favourite genres | #17 / S01 | BR1, BR8 |
| F2 | Get recommendations based on preferences | #18 / S02 | BR2 to BR4 |
| F3 | View movie details | #19 / S03 | BR6 |
| F4 | Explore without preferences | #20 / S04 | BR4, BR5 |
| F5 | Rate and save movie feedback | #21 / S05a | BR7, BR8 |
| F6 | Improve recommendation ranking from ratings | #22 / S05b | BR2, BR3, BR9 |
| F7 | Filter recommendations by genre | #23 / S06 | BR10 |
| F8 | Find similar movies | #24 / S07 | BR11 |
| F9 | Search for a movie by title | #30 / S08 | BR12 |
| F10 | Browse popular movies | #31 / S09 | BR5 |
| F11 | Learn how recommendations are personalised | #32 / S10 | BR13 |
| F12 | Reset the personalisation profile | #33 / S11 | BR8, BR14 |

## Persona matrix

Rows marked as a product control capture a Story that supports all guests or a
stated product capability. They are not presented as a direct survey finding
unless the persona evidence explicitly supports them.

| Persona | Need | Feature | Rules | Route | Issue |
|---|---|---|---|---|---|
| Frequent Explorer | Select favourite genres as input | F1 | BR1, BR8 | `/preferences` | #17 |
| Frequent Explorer | Receive a small, relevant list with a reason for each match | F2 | BR2, BR3, BR4 | `/recommendations` | #18 |
| Frequent Explorer | Filter the current list by genre | F7 | BR10 | `/recommendations` | #23 |
| Frequent Explorer | Open a movie details page | F3 | BR6 | `/movies/:movieId` | #19 |
| Frequent Explorer | Continue exploring similar movies | F8 | BR11 | `/movies/:movieId` | #24 |
| Frequent Explorer | Optionally rate a watched movie to influence later recommendations | F5, F6 | BR7, BR8, BR9 | `/movies/:movieId`, `/recommendations` | #21, #22 |
| Occasional Undecided Viewer | See popular movies when no preferences exist | F4 | BR5 | `/`, `/recommendations` | #20 |
| Occasional Undecided Viewer | Have a visible action to select 1 to 5 genres | F1 | BR1 | `/`, `/preferences` | #17 |
| Occasional Undecided Viewer | See popular alternatives and an option to edit preferences when nothing matches | F2 | BR4 | `/recommendations` | #18 |
| Occasional Undecided Viewer | Use the product without rating movies | F5 | BR7 | `/movies/:movieId` | #21 |
| Occasional Undecided Viewer | Browse a ranked popular list without setting preferences | F10 | BR5 | `/popular` | #31 |
| Detail-Oriented Chooser | See a clear reason why a movie was recommended | F2 | BR2 | `/recommendations` | #18 |
| Detail-Oriented Chooser | Open detailed information before deciding | F3 | BR6 | `/movies/:movieId` | #19 |
| Detail-Oriented Chooser | Filter recommendations by genre | F7 | BR10 | `/recommendations` | #23 |
| Detail-Oriented Chooser | Continue exploring similar movies | F8 | BR11 | `/movies/:movieId` | #24 |
| Detail-Oriented Chooser | Search directly when they already know a title | F9 | BR12 | `/search` | #30 |
| Detail-Oriented Chooser | Read how optional genres and ratings affect recommendations | F11 | BR13 | `/about-recommendations` | #32 |
| All guest personas (product control) | Clear current-session genres and ratings when starting over | F12 | BR8, BR14 | `/profile` | #33 |

Every Story now appears in at least one persona or product-control row. The
persona evidence is in `docs/personas.md`; the complete acceptance criteria
are in `docs/requirements.md` and the linked GitHub Story issues.

## Implementation and reporting rules

1. A PR that implements a route records its PR number in every relevant row and
   changes a Story's status only after the linked Story meets the Definition of
   Done.
2. A PR that only creates a task, rule, document, or design never marks a product
   Story Done.
3. The M1 screen-flow diagram at
   [`docs/images/screen-flow.png`](images/screen-flow.png) includes all eight
   routes above. Every route is reachable from `/`.
4. The rule wording and numeric worked examples are in section 5 of
   [`docs/requirements.md`](requirements.md).
