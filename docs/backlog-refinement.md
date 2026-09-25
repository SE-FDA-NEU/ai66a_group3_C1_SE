# Sprint 1 backlog refinement

## Purpose

This record contains the Product Owner's final refinement decisions. It is the
reference for matching GitHub Project fields, Story updates, and the M1
requirements document. The questionnaire supplies discovery evidence;
registration and authentication are course requirements and were added even
though they were not a survey choice.

## Evidence used

- 6 of 8 respondents reported choice overload.
- Genre was selected by 6 of 8 respondents as important before choosing.
- Favourite genres, personal recommendations, and genre filtering each scored
  4.125 out of 5.
- 5 of 8 wanted both popular movies and a genre-selection action for
  cold-start.
- 6 of 8 wanted popular alternatives after no matching result.
- Ratings were not frequent, although willingness to rate for improved
  recommendations averaged 3.875 out of 5.
- TF-IDF/cosine is a course-driven technical decision. The timeboxed NLP Spike
  validates feasibility and fallback wording before implementation.

## Final Story decisions

| Story | Decision | Required backlog state |
|---|---|---|
| S01 Select favourite genres | P0. Preference input is the first personalisation action after sign-in. | Keep the 1-5 limit; save and retrieve selections only for the current account. |
| S02 Personalised recommendations | P0. Give a short, reasoned result set. | Return up to 10 distinct genre-matching movies; preserve account preferences on errors; show no-match alternatives. |
| S03 Movie details | P0. Do not expand details scope. | Require title, year, genres, overview, exact not-found and unavailable states; preserve signed-in preferences on return. |
| S04 Explore without preferences | P0. Give a newly signed-in account a useful first state. | Show up to 10 popularity-ranked movies; equal scores use title A-Z; do not call it personalised. |
| S05a Save rating | P1 and separate from ranking. | Permit only integer 1-5 ratings in the current account; rating remains optional; verify Account A/B isolation. |
| S05b Rating-informed ranking | P1 and separate from S05a. | Use 4-5 positive, 1-2 negative, and 3 neutral signals from the current account only. |
| S06 Genre filter | P1. Valuable but not a prerequisite for basic account, preferences, and recommendations. | Keep filter, no-result, reset, and exactly 2 Action/3 Comedy criteria. |
| S07 Similar movies | P1. Keep genre eligibility and add deterministic text ranking. | Limit to 5, exclude source, rank usable overview vectors with TF-IDF/cosine, and use the fixed fallback contract. |
| S08 Search | P1, 5 points. Keep title search and add description-text discovery. | Keep short-query validation and 10-result limit; add positive-score TF-IDF/cosine description criteria after Spike approval. |
| S09 Popular movies | P1 and distinct from S04 fallback. | Show 10 highest-ranked movies and the exact no-data message. |
| S10 Recommendation explanation | P2 transparency content. | State exactly 3 steps: register/sign in, choose genres, receive recommendations with optional ratings. |
| S11 Reset profile | P2 control over account data. | Require confirmation; reset only the signed-in account; verify Account A/B isolation. |
| S12 Register account | P0 course requirement. | Use unique case-insensitive email, at-least-8-character password, field validation, and no password/hash in an API response. |
| S13 Sign in and sign out | P0 course requirement. | Use generic invalid-credential message, protect personal routes/actions, isolate accounts, and invalidate the current session at sign-out. |

## Required acceptance-criteria additions

### Account ownership across existing Stories

Apply this pattern to S01, S02, S03, S04, S05a, S05b, S06, and S11: given a
viewer is signed in as the current account, when they save, request, edit,
rate, or reset personalisation data, then only that account's data is read or
changed.

For Account A/B criteria, Account B must not see or overwrite Account A's
genres or ratings. The obsolete phrase "independent session" becomes
"another signed-in account".

### S12 Register account

A valid email and password of at least 8 characters create an account and
direct the viewer to /login. If viewer@example.com exists, registering
VIEWER@example.com is rejected with "This email is already registered".

### S13 Sign in and sign out

A registered email and correct password create an authenticated session that
opens /recommendations after successful sign-in. Sign-out opens / and revokes the current session. An unsigned viewer trying /preferences,
/recommendations, /profile, or rating save is directed to /login and no
personal data is read or saved.

## GitHub Project updates

1. Keep C01-C05 in Sprint 1 with assigned owners and no points.
2. Keep all 14 product Stories in Backlog until a development sprint commits
   them; do not close a Story merely because it was refined.
3. Use six P0 Stories: S01-S04, S12, and S13.
4. Use six P1 Stories: S05a, S05b, S06-S09. Use P2 for S10-S11.
5. Use agreed estimates totalling 54 points. Do not assign points to Chores or
   Spikes.
6. Movie-data Spike #16 is closed on GitHub, but its Result and review evidence
   need reconciliation. NLP Spike #43 is planned for Sprint 2. Move it to
   In Progress when investigation starts; Done needs actual reviewed results.

## Definition of Ready checks

- S12 can start as an independent P0 Story.
- S13 depends on S12 for complete end-to-end testing; its dependency checkbox
  stays unchecked until registration is available.
- S01, S02, S04, S05a, S05b, S06, and S11 depend on the reviewed S13 auth-core
  milestone (session identity, login/logout, guards), not closure of S13.
  Full S13 acceptance follows real preference/rating/reset integration in
  Sprint 4. Do not create a circular Story-level completion dependency.
- S07 and the description part of S08 depend on the approved NLP Spike and
  reviewed contract, not on an unfinished implementation Story.
