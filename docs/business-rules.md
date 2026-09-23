# Business rules

These are C05's source rules for section 5 of the M1 requirements document.
They are constraints the system enforces, not a feature list. The IDs and enforced outcomes must agree with docs/requirements.md and tests.
Different examples must demonstrate the same enforced constraints.

| ID | Rule | Worked example | Source Story |
|---|---|---|---|
| BR1 | A signed-in viewer must save 1 to 5 distinct favourite genres for their account before receiving personal recommendations. | Empty selection and a six-genre set are rejected. Action alone and Action, Comedy, Drama, Horror, Romance are accepted. | #17 / S01 |
| BR2 | Each personal recommendation must share at least one genre selected by the current account. | With Action and Comedy selected, an Action/Thriller movie may appear; a Documentary-only movie may not. | #18 / S02 |
| BR3 | A personal recommendation response contains at most 10 distinct movie IDs. | Twelve matching records including duplicate ID 44 produce no duplicate and no more than 10 items. | #18 / S02 |
| BR4 | A valid preference set with zero matches produces a no-match state, up to 10 popular alternatives, and actions to edit preferences or retry. | Selecting Documentary with 0 matches shows a message and 0 to 10 popular alternatives, not a blank list. | #18 / S02 |
| BR5 | Fallback and popular movies sort by popularity score descending, then title A-Z for ties, and contain at most 10 movies. | A=90, B=80, C=80 returns A, then B before C when B sorts first alphabetically. | #20 / S04, #31 / S09 |
| BR6 | A movie ID identifies at most one movie record; an unknown ID must not display another movie's details. | Movie ID 42 opens its title, year, genres, and overview; ID 999 returns "Movie not found". | #19 / S03 |
| BR7 | A rating is a whole integer from 1 to 5; invalid input is rejected and does not replace a saved rating. | 4 is accepted; 4.5, 0, and 6 are rejected. | #21 / S05a |
| BR8 | Preferences and ratings belong only to their authenticated account and persist when that account later signs in again. | Account A saves 3 genres and 2 ratings, signs out, and later sees 3 and 2 after signing in. Account B sees 0 and 0. | #17 / S01, #21 / S05a, #22 / S05b, #33 / S11, #45 / S13 |
| BR9 | Ratings change future ranking deterministically: 4-5 is positive, 1-2 is negative, and 3 is neutral. | With Action and Comedy candidates both at base score 80, an Action rating of 5 places Action first; 1 places it below Comedy; 3 preserves the base-score tie rule. | #22 / S05b |
| BR10 | A genre filter applies only to the list currently displayed and never changes saved preferences. | A list with exactly 2 Action and 3 Comedy movies shows exactly the 2 Action movies under the Action filter; removing it restores all 5. | #23 / S06 |
| BR11 | A similar-movies list excludes its source movie, shares at least one genre with it, and shows at most 5 candidates. | For source M10 tagged Action, M10 is omitted and at most 5 other Action-sharing candidates may appear. | #24 / S07 |
| BR12 | A title search needs at least 2 characters, is case-insensitive, and returns at most 10 matching movies. | Query a is rejected. Queries in and IN use the same matching rule. Fourteen matches return at most 10. | #30 / S08 |
| BR13 | The recommendation explanation contains exactly 3 steps and says that popular movies are available without preferences. | It lists register or sign in; choose genres; receive recommendations with optional ratings, and displays the required popular-browsing statement. | #32 / S10 |
| BR14 | Resetting a profile requires confirmation; a confirmed reset clears only that account's genres and ratings. | An account with 3 genres and 2 ratings becomes 0 and 0 after confirmation. Cancelling leaves all 5 values unchanged. | #33 / S11 |
| BR15 | S07: usable candidates rank by cosine descending, popularity descending, title ascending, then ID; missing-text candidates follow by popularity/title/ID. With no usable source vector, all eligible candidates use popularity/title/ID. S08: trimmed query length >=2; literal case-insensitive title matches take precedence and sort by title/ID. Only if no title matches exist, use overview cosine >0 sorted by cosine descending, title ascending, then ID. No popularity fallback for search. | S07: A=0.68, B=0.21, C=no overview returns A,B,C. S08: no title matches and scores A=0.4, B=0 returns only A; all zero returns "No movies found". | #24 / S07, #30 / S08 |
| BR16 | An account email is unique after case-insensitive normalization. | If viewer@example.com exists, registration with VIEWER@example.com is rejected with "This email is already registered". | #44 / S12 |
| BR17 | A registration password has at least 8 characters and is stored only as a cryptographic hash. | movie123 is accepted; movie7 is rejected. No registration response contains a password or password hash. | #44 / S12 |
| BR18 | A personal-data action requires a valid authenticated session and may read or write only that session account's data. | An unsigned request to /preferences goes to /login. Account B cannot read or overwrite Account A's rating. | #45 / S13 |
| BR19 | Sign-out invalidates the current authenticated session without deleting the account's data. | After sign-out, /profile goes to /login. Signing in again to the same account restores saved preferences and ratings. | #45 / S13 |

## Rule-to-screen handoff

| Rule range | Main route(s) | M1 use |
|---|---|---|
| BR1-BR4 | /preferences, /recommendations | Core preference and recommendation flow |
| BR5 | /, /recommendations, /popular | Fallback and popular browsing |
| BR6-BR9 | /movies/:movieId, /recommendations | Details, rating, and account-specific ranking |
| BR10 | /recommendations | In-list filtering |
| BR11, BR15 | /movies/:movieId, /search | Similarity and search constraints |
| BR12 | /search | Search validation and limit |
| BR13 | /about-recommendations | Transparency content |
| BR14 | /profile | Account-profile reset |
| BR16-BR17 | /register | Registration constraints |
| BR18-BR19 | /login, protected routes | Authentication, access control, and sign-out |

## Maintenance rule

When a Story acceptance criterion changes, update its matching row here,
docs/requirements.md, and docs/traceability.md in the same PR. Do not renumber
an existing BR after it has been cited in an issue, test, PR, or report.
