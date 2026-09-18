# Product scope

## Product vision

For university students facing choice overload, the AI Movie Recommendation System turns a small set of genre preferences and optional ratings into transparent movie recommendations, unlike a generic popularity list that gives every viewer the same choices.

## Target users

The initial target segment is university students aged 18-20. The product is
designed for two behaviour patterns identified in user research:

- Frequent Explorers want to find new and relevant movies without repeatedly
  browsing long popular lists.
- Occasional Undecided Viewers need a clear starting point when they do not know
  what movie or genre to choose.

## Problem statement

Users face choice overload when many movies are available. They need a quick
way to narrow the available options and recover when there are no matching
recommendations.

## MVP scope

The first usable product flow is:

1. A guest selects one to five favourite genres.
2. The system displays up to 10 relevant movie recommendations.
3. The guest can filter the current recommendation list by genre.
4. The guest can view essential movie details before deciding.
5. A guest without preferences sees popular movies and an action to select
   genres.
6. A guest with no matching result sees popular alternatives and can edit
   preferences or retry.

## Backlog priority

### P0 - Core MVP

- S01 - Select favourite genres.
- S02 - View personalised recommendations.
- S03 - View essential movie details.
- S04 - Explore movies without preferences.
- S06 - Filter recommendations by genre.

### P1 - Valuable follow-up capabilities

- S05a - Rate a movie and save feedback.
- S05b - Use ratings to improve recommendations.
- S07 - View similar movies.
- S08 - Search for a movie by title.
- S09 - Browse popular movies.

### P2 - Later capabilities

- S10 - Learn how recommendations are personalised.
- S11 - Reset my personalisation profile.

## Scope constraints

- Ratings are optional and must not block the recommendation flow.
- Movie details in the MVP include title, year, genres, and overview. Trailer,
  cast, reviews, and comments are not required for the MVP.
- Mood-based discovery is not part of the MVP. It remains a research question
  for the movie-data spike.
- User accounts, administrator features, payments, social features, and a
  complex machine-learning model are out of scope for the MVP.
- P1 and P2 Stories remain in the product backlog and are not committed to the
  Sprint 1 requirements sprint.

## Evidence basis

The scope is based on the aggregated questionnaire findings in
`docs/user-research.md` and the behaviour patterns in `docs/personas.md`.
The small, student-only sample guides the initial MVP; it does not represent
all movie viewers. The Product Owner must validate or refine these decisions
after C03 records the required anonymised user conversations.
