# Sprint 1 backlog refinement

## Purpose

This document records the Product Owner's refinement decisions after reviewing
the anonymous user-research evidence. It is the reference for the matching
GitHub Project fields and Story updates.

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

| Story | Decision | Required GitHub update |
| --- | --- | --- |
| S01 - Select favourite genres | Keep as P0. Genre is the primary initial personalisation input. | Keep the one-to-five genre limit and current-session behaviour. |
| S02 - View personalised recommendations | Keep as P0. Limit the first result set and provide an understandable match reason. | Change the result count to up to 10. Add a no-match fallback to popular movies plus actions to edit preferences or retry. |
| S03 - View essential movie details | Keep as P0, but do not expand the MVP details scope. | Require title, year, genres, and overview. Do not add trailer, cast, reviews, or comments to the MVP. |
| S04 - Explore movies without preferences | Keep as P0. | Show popular movies and a visible action to choose genres. |
| S05a - Rate a movie and save feedback | Keep as P1 and separate it from recommendation-ranking behaviour. | Add an acceptance criterion confirming that ratings are optional. |
| S05b - Use ratings to improve recommendations | Keep as P1. | Create a separate Story if rating storage and ranking impact still share one issue. |
| S06 - Filter recommendations by genre | Promote from P1 to P0. | Keep the filter, no-result, and reset acceptance criteria. |
| S07 - View similar movies | Keep as P1. | Retain the existing maximum-five and exclude-current-movie rules. |

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
Given a new guest session has no saved preferences,
When the user opens recommendations,
Then the system shows up to 10 popular movies and a visible action to select
favourite genres.
```

### S05a - Optional rating

```text
Given a user has not rated any movie,
When the user requests recommendations,
Then the recommendation flow remains available without requiring a rating.
```

## GitHub Project updates

1. Keep C01-C05 in Sprint 1 with their assigned owners and no Points.
2. Keep all product Stories in Backlog until a development sprint commits them.
3. Set P0 for S01, S02, S03, S04, and S06.
4. Set P1 for S05a, S05b, and S07.
5. Record Story Points only after a team Planning Poker session. Do not assign
   Points to Chores or the Spike.
6. Keep the movie-data Spike in Backlog and add the question of whether
   practical mood-related discovery data exists.

## C01 completion checklist

- [ ] The user-research evidence is linked from C01.
- [ ] The product scope is agreed by the team.
- [ ] GitHub Story priorities match this refinement decision.
- [ ] S02, S04, and S05a acceptance criteria are updated.
- [ ] S05 is split if one issue still contains both rating storage and ranking
      impact.
- [ ] Story Points are agreed by the team and entered in the Project field.
- [ ] C04 has updated traceability after the final Story edits.
- [ ] The C01 PR is reviewed and merged before C01 is closed.
