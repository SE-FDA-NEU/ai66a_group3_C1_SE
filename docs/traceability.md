# Traceability

This file is the route crosswalk for the product. A GitHub Story issue is the
source of truth for its title, priority, points, and acceptance criteria. Its
Related screen / route field must match one or more rows below. Update the
affected issue, this file, and docs/requirements.md in the same PR whenever a
route or requirement changes.

## Screen and Story map

| Route | Purpose | Access | Priority | Feature | Story issue(s) | Relevant rules | PR | Status |
|---|---|---|---|---|---|---|---|---|
| / | Start public discovery; reach account access, popular browsing, search, and the explanation. | G | P0 | F1, F4, F9, F10, F11, F13, F14 | #17 S01, #20 S04 | BR1, BR5 | — | Open / Backlog |
| /register | Create a new account with a unique email and secure password. | G | P0 | F13 | #44 S12 | BR16, BR17 | — | Open / Backlog |
| /login | Sign in to an existing account; authenticated navigation provides sign-out. | G | P0 | F14 | #45 S13 | BR18, BR19 | — | Open / Backlog |
| /preferences | Select, save, and revisit 1 to 5 favourite genres for the current account. | U | P0 | F1 | #17 S01 | BR1, BR8, BR18 | — | Open / Backlog |
| /recommendations | Show personal movies, no-match alternatives, fallback, rating-informed ranking, and the current-list genre filter. | U | P0 and P1 | F2, F4, F6, F7 | #18 S02, #20 S04, #22 S05b, #23 S06 | BR2, BR3, BR4, BR5, BR8, BR9, BR10, BR18 | — | Open / Backlog |
| /movies/:movieId | View public movie details, rate when signed in, and find text-ranked similar movies. | G; rating U | P0 details; P1 additions | F3, F5, F6, F8 | #19 S03, #21 S05a, #22 S05b, #24 S07 | BR6, BR7, BR8, BR9, BR11, BR15, BR18 | — | Open / Backlog |
| /search | Search catalogue title or description text and open a selected result. | G | P1 | F9 | #30 S08 | BR12, BR15 | — | Open / Backlog |
| /popular | Browse a ranked popular-movie list independently of personal recommendations. | G | P1 | F10 | #31 S09 | BR5 | — | Open / Backlog |
| /about-recommendations | Explain the 3-step account, genre, and optional-rating model. | G | P2 | F11 | #32 S10 | BR13 | — | Open / Backlog |
| /profile | Confirm and reset the current account's saved genres and ratings. | U | P2 | F12 | #33 S11 | BR8, BR14, BR18 | — | Open / Backlog |

Access codes: G = guest; U = authenticated user; A = administrator. A guest
may browse catalogue content. Personal preferences, recommendations, saved
ratings, and the profile require a valid U session. Open / Backlog means the
feature is planned, not completed.

## Feature and rule map

| Feature | Capability | Story | Rules |
|---|---|---|---|
| F1 | Select favourite genres | #17 / S01 | BR1, BR8, BR18 |
| F2 | Get recommendations based on preferences | #18 / S02 | BR2 to BR4, BR8, BR18 |
| F3 | View movie details | #19 / S03 | BR6 |
| F4 | Explore without preferences | #20 / S04 | BR4, BR5, BR8 |
| F5 | Rate and save movie feedback | #21 / S05a | BR7, BR8, BR18 |
| F6 | Improve recommendation ranking from ratings | #22 / S05b | BR2, BR3, BR8, BR9 |
| F7 | Filter recommendations by genre | #23 / S06 | BR10 |
| F8 | Find text-ranked similar movies | #24 / S07 | BR11, BR15 |
| F9 | Search by title or description text | #30 / S08 | BR12, BR15 |
| F10 | Browse popular movies | #31 / S09 | BR5 |
| F11 | Learn how recommendations are personalised | #32 / S10 | BR13 |
| F12 | Reset personalisation profile | #33 / S11 | BR8, BR14, BR18 |
| F13 | Register an account | #44 / S12 | BR16, BR17 |
| F14 | Sign in and sign out securely | #45 / S13 | BR8, BR18, BR19 |

## Persona matrix

Rows marked product control are necessary for safe account behaviour. They are
not claimed to be direct survey findings unless persona evidence says so.

| Persona | Need | Feature | Rules | Route | Issue |
|---|---|---|---|---|---|
| Frequent Explorer | Restore favourite genres after a later visit | F1, F14 | BR1, BR8, BR18, BR19 | /login, /preferences | #17, #45 |
| Frequent Explorer | Receive a small relevant list with a reason | F2 | BR2, BR3, BR4 | /recommendations | #18 |
| Frequent Explorer | Filter the current list by genre | F7 | BR10 | /recommendations | #23 |
| Frequent Explorer | Open details and explore text-ranked similar movies | F3, F8 | BR6, BR11, BR15 | /movies/:movieId | #19, #24 |
| Frequent Explorer | Optionally rate a movie to affect later recommendations | F5, F6 | BR7, BR8, BR9 | /movies/:movieId, /recommendations | #21, #22 |
| Occasional Undecided Viewer | Browse popular movies before providing data | F10 | BR5 | /popular | #31 |
| Occasional Undecided Viewer | Create an account when they choose to retain preferences | F13 | BR16, BR17 | /register | #44 |
| Occasional Undecided Viewer | See popular alternatives and edit preferences when nothing matches | F2, F4 | BR4, BR5 | /recommendations | #18, #20 |
| Occasional Undecided Viewer | Use the product without rating movies | F5 | BR7 | /movies/:movieId | #21 |
| Detail-Oriented Chooser | Read details before deciding | F3 | BR6 | /movies/:movieId | #19 |
| Detail-Oriented Chooser | Continue with movies whose descriptions are related | F8 | BR11, BR15 | /movies/:movieId | #24 |
| Detail-Oriented Chooser | Search by a known title or story description | F9 | BR12, BR15 | /search | #30 |
| All personas (product control) | Access only their own preferences and ratings, then sign out safely | F14 | BR8, BR18, BR19 | /login, protected routes | #45 |
| All signed-in personas (product control) | Reset only their own saved profile after confirmation | F12 | BR8, BR14, BR18 | /profile | #33 |

| All personas (product control) | Understand optional personalisation and public browsing | F11 | BR13 | /about-recommendations | #32 |

Every Story appears in at least one persona or product-control row. Persona
evidence is in docs/personas.md; complete acceptance criteria are in
docs/requirements.md and the linked GitHub issues.

## Implementation and reporting rules

1. A PR implementing a route records its PR number in every relevant row and
   changes a Story's status only after the linked Story meets the Definition of
   Done.
2. A PR creating a task, rule, document, or design never marks a product Story
   Done.
3. The M1 flow source is docs/screen-flow.puml. The rendered diagram at
   docs/images/screen-flow.png must include all ten routes and their access
   decision. Every route must be reachable from /.
4. Rule wording and numeric worked examples are maintained in section 5 of
   docs/requirements.md and docs/business-rules.md.
