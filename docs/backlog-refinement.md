# Sprint 1 backlog refinement

## Purpose

This document records the Product Owner's refinement decisions after reviewing
the available user-research evidence. It is the reference for the matching
GitHub Project fields, Story updates, and the M1 requirements document. The
anonymous questionnaire is supporting evidence; C03's anonymised conversations
must validate the final decisions before M1 is submitted.

## Evidence used

- 6 of 8 respondents reported choice overload.
- Genre was selected by 6 of 8 respondents as important information before
  choosing a movie.
- Favourite genres, personalised recommendations, and genre filtering each
  scored 4.125 out of 5.
- 5 of 8 respondents wanted both popular movies and a genre-selection action
  for cold-start.
- 6 of 8 respondents wanted popular alternatives after no matching result.
- Ratings were not a frequent habit, although willingness to rate for improved
  recommendations averaged 3.875 out of 5.

## Story decisions

| Story                                            | Decision                                                                                              | Required GitHub update                                                                                                                               |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| S01 - Select favourite genres                    | Keep as P0. Genre is the primary initial personalisation input.                                       | Keep the one-to-five genre limit and current-session behaviour.                                                                                      |
| S02 - View personalised recommendations          | Keep as P0. Limit the first result set and provide an understandable match reason.                    | Change the result count to up to 10. Add a no-match fallback to popular movies plus actions to edit preferences or retry.                            |
| S03 - View essential movie details               | Keep as P0, but do not expand the MVP details scope.                                                  | Require title, year, genres, and overview. Do not add trailer, cast, reviews, or comments to the MVP.                                                |
| S04 - Explore movies without preferences         | Keep as P0.                                                                                           | Show up to 10 popular movies ordered by popularity score descending; order equal scores by title A-Z, and provide a visible action to choose genres. |
| S05a - Rate a movie and save feedback            | Keep as P1 and separate it from recommendation-ranking behaviour.                                     | Add an acceptance criterion confirming that ratings are optional.                                                                                    |
| S05b - Use ratings to improve recommendations    | Keep as P1 and separate from S05a.                                                                    | Define deterministic positive, negative, and neutral ranking behaviour for ratings 4-5, 1-2, and 3.                                                  |
| S06 - Filter recommendations by genre            | Promote from P1 to P0.                                                                                | Keep the filter, no-result, and reset acceptance criteria; test a list with exactly 2 Action and 3 Comedy movies.                                    |
| S07 - View similar movies                        | Keep as P1.                                                                                           | Retain the existing maximum-five and exclude-current-movie rules.                                                                                    |
| S08 - Search for a movie by title                | Add as P1 for viewers who know a title already.                                                       | Search by title, show no more than 10 matches, and reject searches shorter than 2 characters.                                                        |
| S09 - Browse popular movies                      | Add as P1 for intentional browsing of a ranked list. This is distinct from S04's cold-start fallback. | Display the 10 highest-ranked movies and an exact no-data message.                                                                                   |
| S10 - Learn how recommendations are personalised | Add as P2 transparency information.                                                                   | Explain the process in exactly 3 steps and state that popular browsing works without preferences.                                                    |
| S11 - Reset my personalisation profile           | Add as P2 control over session data.                                                                  | Require confirmation, clear saved genres and ratings, and show an exact success message.                                                             |

## Acceptance-criteria changes

### S02 - Personalised recommendations

```text
Given the user has selected valid genres and matching movies exist,
When recommendations are requested,
Then the system displays up to 10 distinct matching movies.

Given no movies match the selected genres,
When recommendations are requested,
Then the system shows a no-match message, up to 10 popular alternative movies,
and actions to change preferences or retry.
```

### S04 - Cold-start exploration

```text
Given a new session has no preferences and the fallback dataset contains Movie
A with popularity score 90, Movie B with score 80, and Movie C with score 80,
When the user opens recommendations,
Then Movie A appears first and Movies B and C are ordered alphabetically by
title, with at most 10 movies displayed and marked as not personalised.
```

### S05a - Optional rating

```text
Given a user has not rated any movie,
When the user requests recommendations,
Then the recommendation flow remains available without requiring a rating.
```

### S05b - Rating-informed recommendations

```text
Given an Action candidate and a Comedy candidate have the same base popularity
score of 80,
When the viewer has rated an Action movie 5 and requests recommendations again,
Then the Action candidate appears above the Comedy candidate.

Given an Action candidate and a Comedy candidate have the same base popularity
score of 80,
When the viewer has rated an Action movie 1 and requests recommendations again,
Then the Comedy candidate appears above the Action candidate.
```

### S06 - Genre filter

```text
Given the current recommendation list contains exactly 2 Action movies and 3
Comedy movies,
When the viewer selects the Action filter,
Then the system displays exactly the 2 Action movies and no Comedy movies.
```

## GitHub Project updates

1. Keep C01-C05 in Sprint 1 with their assigned owners and no Points.
2. Add all 12 product Stories to the Project with Status set to Backlog and no
   Sprint 1 iteration until a development sprint commits them.
3. Set P0 for S01, S02, S03, S04, and S06.
4. Set P1 for S05a, S05b, S07, S08, and S09; set P2 for S10 and S11.
5. Confirm the current Modified Fibonacci Story Point estimates in a team
   Planning Poker session. Do not assign Points to Chores or the Spike.
6. Keep the movie-data Spike in Backlog and add the question of whether
   practical mood-related discovery data exists.
