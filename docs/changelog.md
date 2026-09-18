# Changelog

## 2026-09-18 - Complete the M1 story backlog

- **Before:** The refined backlog contained 8 Story issues and did not include
  deterministic acceptance criteria for fallback ranking, rating-informed
  ranking, or a fixed genre-filter test fixture.
- **After:** Added S08 Search for a movie by title, S09 Browse popular movies,
  S10 Learn how recommendations are personalised, and S11 Reset my
  personalisation profile. The backlog now contains 12 Story issues.
- **Requirements refined:** S04 orders fallback movies by popularity score
  descending and title A-Z for ties. S05b defines positive, negative, and
  neutral rating behaviour. S06 uses a list with exactly 2 Action and 3 Comedy
  movies as a test fixture.
- **Impact:** GitHub Story backlog, Project Backlog view, traceability, screen
  list, screen flow, and `docs/requirements.md`.

## 2026-09-17 - Refine the MVP from user research

- **Source:** Anonymous questionnaire survey with 8 valid responses from
  university students aged 18-20.
- **Before:** Genre filtering was P1. No-match handling only asked users to
  adjust preferences. Rating storage and recommendation-ranking impact were
  described together in one Story.
- **After:** Genre filtering is P0. No-match handling shows popular
  alternatives with actions to edit preferences or retry. Rating storage and
  rating-informed recommendations are separate P1 Stories, and ratings are
  optional.
- **Reason:** Genre-related functions received the highest importance scores.
  Most respondents preferred popular alternatives after no matching result, and
  no respondent rated movies frequently.
- **Impact:** S02, S04, S05a, S05b, S06, the movie-data Spike, traceability,
  and the M1 requirements dossier.
- **PO decision:** Keep mood-based discovery out of the MVP until the team has
  data-source evidence and testable acceptance criteria.
