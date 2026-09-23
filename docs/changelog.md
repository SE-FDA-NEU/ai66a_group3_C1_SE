# Changelog

## 2026-09-23 - Reconcile delivery contracts and sprint handoffs (local)

- Aligned registration/login/logout/reset and explanation AC with the 14-Story
  GitHub baseline; requirements now contains 60 AC.
- Separated S07 fallback from positive-only S08 description search; unified
  account ownership, stable string DTO IDs and per-rated-movie ranking signals.
- Added a shared implementation contract and a context pack for every sprint;
  clarified start versus completion dependencies and final release gates.
- Replaced obsolete guest/session diagrams with account-aware diagrams and
  corrected the rendered login destination and list-return transitions.
- Tightened CI test/build/lint and review checks. Repository settings and Project
  automation still require actual verification; no remote updates were made.
- Recorded unresolved research consent/conversation, C02 retrospective and #16
  review/Result evidence honestly. No meeting, approval or test outcome invented.


## 2026-09-22 - Add account registration and authentication

- **Before:** Personal genres and ratings were modelled as guest-session data.
  The backlog had 12 Stories and public routes for every action.
- **After:** Added S12 Register an account (#44) and S13 Sign in and sign out
  securely (#45). The backlog has 14 Stories and 54 points: six P0, six P1,
  and two P2. Preferences, ratings, recommendations, and profile reset now
  belong to the current authenticated account; public movie discovery remains
  available to guests.
- **Reason:** Registration, login, and logout are an explicit course
  requirement. Account ownership also makes saved ratings and preferences
  meaningful after a later visit.
- **Impact:** S01-S06 and S11 use account wording; S06 is P1 to keep the P0
  count at the required maximum of six. Added BR16-BR19, /register and /login,
  protected-route behaviour, account-aware data contract, and screen flow.
- **Status:** Requirements and traceability are updated. The corresponding
  GitHub issues must retain the same account-isolation wording during
  implementation.

## 2026-09-21 - Add a planned NLP text-similarity layer

- **Before:** S07 selected similar movies only by shared genre, and S08 only
  searched a title.
- **After:** S07 now ranks eligible shared-genre candidates by TF-IDF cosine
  similarity over movie overviews. S08 retains title search and adds
  description-text search on the same `/search` route.
- **Reason:** The course requires a demonstrable NLP technique while the team
  wants to preserve the existing 12-Story product backlog and routes.
- **Impact:** S07 is now estimated at 5 points on GitHub. S08 needs Planning
  Poker before its 3-point estimate is accepted for the enlarged scope. BR15,
  requirements, traceability, Sprint plans and a dedicated NLP Spike must be
  synchronised before implementation.
- **Status:** This is a planned deterministic TF-IDF/cosine approach, not a
  claim that NLP has been implemented, evaluated or approved by the Spike.

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
