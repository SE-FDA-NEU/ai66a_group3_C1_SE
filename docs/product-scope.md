# Product scope

## Product vision

For university students facing choice overload, the AI Movie Recommendation
System lets each account save a small set of preferences and optional ratings
to receive transparent movie recommendations, rather than showing every viewer
the same generic popularity list.

## Target users

The initial target segment is university students aged 18 to 20. The product
serves three survey-derived behaviour patterns:

- Frequent Explorers want new, relevant movies without repeatedly browsing a
  long popular list.
- Occasional Undecided Viewers need a safe starting point when they do not
  know what movie or genre to choose.

- Detail-Oriented Choosers need movie information and similar alternatives
  before deciding what to watch.

## Problem statement

Users face choice overload when many movies are available. They need a quick
way to narrow the catalogue, recover from a no-match result, and keep their
own preference data for a later visit without exposing it to another account.

## MVP scope

The first usable product flow is:

1. A guest can browse popular movies, search the catalogue, read movie details,
   and read the recommendation explanation.
2. A viewer registers with a unique email and an at-least-eight-character
   password, then signs in.
3. A signed-in viewer selects 1 to 5 favourite genres; those preferences are
   saved to that account.
4. The system displays up to 10 relevant recommendations with a match reason.
5. The signed-in viewer can filter the current recommendation list by genre.
6. A signed-in viewer can save a 1 to 5 rating, and ratings affect later
   ranking only for that account.
7. A signed-in account with no preferences sees popular fallback movies and an
   action to choose genres. A no-match result also shows popular alternatives.
8. A viewer can find content-similar movies from details and search by a title
   or description. The deterministic TF-IDF/cosine behaviour is subject to
   the dedicated NLP Spike decision.
9. A signed-in viewer can inspect and reset only their own saved
   personalisation data, then sign out.

## Backlog priority

### P0 - Core MVP

- S01 - Select favourite genres.
- S02 - View personalised recommendations.
- S03 - View essential movie details.
- S04 - Explore movies without preferences.
- S12 - Register an account.
- S13 - Sign in and sign out securely.

### P1 - Valuable follow-up capabilities

- S05a - Rate a movie and save feedback.
- S05b - Use ratings to improve recommendations.
- S06 - Filter recommendations by genre.
- S07 - Find content-similar movies from the details page.
- S08 - Search by title or description.
- S09 - Browse popular movies.

### P2 - Later capabilities

- S10 - Learn how recommendations are personalised.
- S11 - Reset my personalisation profile.

## Scope constraints

- A guest can browse public catalogue content, but all personal preferences,
  personal recommendations, rating save operations, and profile reset require
  a valid signed-in account.
- Email uniqueness is case-insensitive. Passwords have at least 8 characters
  and are stored only as cryptographic hashes. Passwords and hashes never
  appear in API responses.
- Ratings are optional and must not block the recommendation flow.
- Movie details include title, year, genres, and overview. Trailer, cast,
  social comments, reviews, direct messaging, and moderator tools are not in
  this MVP.
- The NLP enhancement uses deterministic TF-IDF/cosine similarity over
  imported TMDb movie overviews; it is not an LLM, synonym engine, or trained
  recommendation model. The NLP Spike confirms language, preprocessing,
  ranking, and fallback behaviour before implementation.
- TMDb is the catalogue-data source. The server-side import/provider layer
  keeps credentials out of the browser; automated tests use synthetic local
  fixtures rather than live calls.
- A missing overview follows the documented ranking fallback. Title search
  remains available independently of description search.
- Administrator features, payments, social features, account deletion, and
  complex machine-learning models are outside the MVP.
- P1 and P2 Stories remain product-backlog work; Sprint Planning decides which
  are committed to a development sprint.

## Evidence basis

The scope is based on the aggregated questionnaire findings in
docs/user-research.md and the behaviour patterns in docs/personas.md. The
small student-only sample guides the initial MVP but does not represent all
movie viewers. Registration and sign-in are course requirements, not claims
that the 8-person survey ranked authentication above discovery features.
