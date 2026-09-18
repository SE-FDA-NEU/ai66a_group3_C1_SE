# Business rules

These rules are the C05 source for Section 5 of the M1 requirements document. They
are system constraints, not a list of features. C04 should copy the approved rules
and worked examples into `docs/requirements.md` without changing their IDs or values.

| ID | Rule | Worked example | Source Story |
|---|---|---|---|
| BR1 | A viewer must save **1–5** distinct genres before receiving personalised recommendations. | `[]` and a six-genre set are rejected; `[Action]` and `[Action, Comedy, Drama, Horror, Romance]` are accepted. | #17 / S01 |
| BR2 | Each personalised recommendation must share at least one selected genre. | With selected genres `[Action, Comedy]`, a movie tagged `[Action, Thriller]` may appear; a movie tagged only `[Documentary]` may not. | #18 / S02 |
| BR3 | A personalised recommendation response contains at most **10 distinct movie IDs**. | If 12 matching records include duplicate ID `44`, the response contains no duplicate and no more than 10 IDs. | #18 / S02 |
| BR4 | A valid preference set with zero matching movies produces a no-match state, up to **10** popular alternatives, and actions to edit preferences or retry. | A viewer selects `[Documentary]` and the catalogue has 0 Documentary matches: show the no-match message and 0–10 popular alternatives, not a blank page. | #18 / S02 |
| BR5 | Without saved preferences, fallback/popular movies sort by `popularityScore` descending; equal scores sort by title A–Z; the list contains at most **10** movies. | A=90, B=80, C=80 returns A first, then B before C when B’s title alphabetically precedes C’s. | #20 / S04, #31 / S09 |
| BR6 | Every movie ID identifies at most one movie record; an unknown ID does not display another movie’s details. | Movie ID `42` opens its own title, year, genres, runtime, and overview; ID `999` returns the exact not-found state `Movie not found`. | #19 / S03 |
| BR7 | A rating is a whole integer from **1 to 5**; invalid values are rejected and do not replace a saved rating. | Rating `4` is accepted; `4.5`, `0`, and `6` are rejected. | #21 / S05a |
| BR8 | Preferences and ratings are isolated by session until a user resets the profile. | Session A saves 3 genres and 2 ratings. A new Session B starts with 0 saved genres and 0 ratings and cannot read A’s data. | #17 / S01, #21 / S05a, #33 / S11 |
| BR9 | Ratings affect future ranking deterministically: **4–5** is positive, **1–2** negative, and **3** neutral. | With Action and Comedy candidates both at base score 80, an Action rating of 5 places Action above Comedy; a rating of 1 places it below; a rating of 3 preserves the base-score tie rule. | #22 / S05b |
| BR10 | A genre filter applies only to the recommendation list already displayed and never changes saved preferences. | A list has exactly 2 Action and 3 Comedy movies. Selecting Action displays exactly the 2 Action movies; removing the filter restores all 5 and leaves saved genres unchanged. | #23 / S06 |
| BR11 | A similar-movies list excludes its source movie, shares at least one genre with it, and shows at most **5** candidates. | For source movie `M10` tagged Action, candidates `[M10, M11(Action), M12(Comedy)]` must omit `M10`; only matching candidates can appear, up to 5. | #24 / S07 |
| BR12 | A title search needs at least **2** characters, is case-insensitive, and returns at most **10** matching movies. | Query `a` is rejected; `in` and `IN` use the same matching rule. If 14 titles match `in`, return at most 10. | #30 / S08 |
| BR13 | The recommendation explanation contains exactly **3** steps and must state that popular movies are available without preferences. | The page lists: choose genres; receive recommendations; optionally rate movies. It also displays `You can browse popular movies without providing preferences`. | #32 / S10 |
| BR14 | Resetting a profile requires confirmation; a confirmed reset clears the saved genres and ratings and returns a fixed success message. | A profile with 3 genres and 2 ratings becomes 0 genres and 0 ratings after confirmation and shows `Your personalisation profile was reset`. Cancelling leaves all 5 values unchanged. | #33 / S11 |

## Rule-to-screen handoff

| Rule range | Main route(s) | M1 use |
|---|---|---|
| BR1–BR4 | `/preferences`, `/recommendations` | Core P0 preference and recommendation flow |
| BR5 | `/`, `/recommendations`, `/popular` | Cold-start fallback and popular browsing |
| BR6–BR9 | `/movies/:movieId`, `/recommendations` | Details, optional rating, and future ranking |
| BR10 | `/recommendations` | P0 in-list filtering |
| BR11 | `/movies/:movieId` | Similar-movies constraint |
| BR12 | `/search` | Search constraint |
| BR13 | `/about-recommendations` | Transparency content constraint |
| BR14 | `/profile` | Profile-reset constraint |

## Maintenance rule

When a Story acceptance criterion changes, update its matching row here and
`docs/traceability.md` in the same PR. Do not renumber an existing BR after it has
been cited in a Story, test, PR, or report.
