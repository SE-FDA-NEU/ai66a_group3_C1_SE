# Sprint 3 UI-state contract

Contract revision: `S3-DRAFT`, reconciled with the current frontend on
2026-10-08.

This document separates current UI evidence from committed Sprint 3 state
contracts whose implementation is pending. These states are required Sprint
scope, not optional future work, but are not implementation or test-evidence
claims. HTTP payloads and errors are defined in [api.md](api.md).

## 1. Current P0 screen: public catalogue `/`

The existing `HomePage` is the selected P0 screen because it calls the real
`GET /api/movies?limit=10` boundary and implements all four required states.

| State | Trigger | Exact rendered content | Recovery/transition |
|---|---|---|---|
| Loading | Request is in flight | `Loading movies...` | Wait; stale results are ignored after unmount. |
| Empty | `200` with `data.movies: []` | Heading `No movies available`; text `The active catalogue does not contain any movies yet.` | Valid empty state; do not show fake cards or treat it as an API error. |
| Error | Non-success response or network/parse failure | Heading `Movies are unavailable`; safe API message or `Something went wrong`; button `Retry` | `Retry` issues a new list request and clears the previous error. |
| Data | `200` with one or more movies | `Movie catalogue` grid with title, year/`Information unavailable`, genres/`Information unavailable`, and `View details` | Open `/movies/:movieId` using the opaque movie ID. |

These states are mutually exclusive. In particular:

- An API error is a non-2xx response and safe error envelope. It renders the
  error state and must not be converted into an empty list.
- A client-side validation error is detected before a request (for example,
  missing login fields). It stays with the relevant form and is not an API
  error or catalogue empty state.
- A valid empty result is `200` with an empty array. It renders empty guidance,
  not an alert and not invented data.

Current evidence: `frontend/src/pages/HomePage.tsx` and
`frontend/src/tests/movies.test.tsx`.

## 2. Mapping current API errors to UI behaviour

Every code below exists in the current backend/tests. Contract-only codes are
not included merely to reach a row count.

| HTTP | Code | Business rule / condition | Exact rendered message | Recovery action |
|---:|---|---|---|---|
| 400 | `VALIDATION_ERROR` | Server rejects invalid fields/query input | `Please correct the highlighted fields` when surfaced from the API; registration/login perform their documented field validation before request | Correct the input and submit again. |
| 401 | `INVALID_CREDENTIALS` | Email is unknown or password is wrong; do not reveal which | `Email or password is incorrect` | Edit credentials and submit again. |
| 401 | `AUTHENTICATION_REQUIRED` | Protected route has a missing, expired, invalid, or revoked session | No private content is rendered; the central auth state opens `/login` | Sign in; clear previous account-scoped state. |
| 403 | `ORIGIN_NOT_ALLOWED` | Browser session write fails same-origin protection | `Request origin is not allowed` | Retry only from the application origin; do not claim the write succeeded. |
| 404 | `MOVIE_NOT_FOUND` | Opaque ID is not present in the active catalogue | Heading `Movie not found`; text `That movie is not available in the active catalogue.` | `Return to catalogue` opens `/`. |
| 409 | `EMAIL_ALREADY_REGISTERED` | Normalized email already exists | `This email is already registered` | Sign in or use a different email. |
| 503 | `CATALOGUE_UNAVAILABLE` | No active local catalogue revision | Heading `Movies are unavailable`; text `Movie catalogue is unavailable` | `Retry`; operator fixes/imports the catalogue if it persists. |
| 503 | `SERVICE_UNAVAILABLE` | Database read/write is unavailable | Heading `Movies are unavailable` (catalogue screen); text `Service is temporarily unavailable` | `Retry`; preserve previously committed/private state. |

Messages must not include stack traces, SQL/database internals, passwords,
session values, or TMDb credentials. The two Story messages remain exact:
`Email or password is incorrect` and `This email is already registered`.

## 3. Committed Sprint 3 rating UI contract (implementation pending)

Movie detail remains public. A guest load calls only
`GET /api/movies/{movieId}` and must not automatically call either private
rating endpoint. If a guest chooses a rating action, open `/login` before any
private rating GET/PUT.

For an authenticated account and current movie, the committed rating control has
these states:

| State | UI contract |
|---|---|
| Loading | Show `Loading your rating...` while `GET /api/me/ratings/{movieId}` is current. Do not display another account/movie's value. |
| Unrated | `rating: null`; show `You have not rated this movie.` Never display `0`. |
| Committed | Show the last server-confirmed integer 1-5 for the current account/movie. |
| Saving | Keep the prior committed value, disable duplicate submission, and show `Saving rating...`. A selected value is a draft until `200`. |
| Failure | Show `Rating was not saved. Try again.` Do not show success and do not replace the prior committed value. A valid draft may remain selected for retry. |
| Retry | Resubmit the retained valid draft; success changes committed state only after the API confirms commit. |

Client validation accepts only the integers 1-5. It rejects `0`, `6`, negative
numbers, fractions, strings, booleans, null, and missing selection before a
request and shows `Choose a whole-number rating from 1 to 5.` Server validation
is still authoritative.

On a movie change, cancel/obsolete the old rating request and clear the old
movie's transient state before loading the new key. A delayed response for
movie A must not update movie B. On account change/logout, clear rating state
and ignore every response captured for the previous account.

The rating UI and its tests do not exist in the current repository. This
section is committed Sprint 3 scope with implementation pending.

## 4. Committed preference, recommendation, and reset UI states

- Preferences: initialise from the current account only. On successful save,
  accept the committed response, invalidate that account's recommendation
  result, then request/navigate to fresh recommendations. On failure, keep the
  prior committed selection and show a retry path.
- Recommendations: preserve `data.movies`, `mode`, `personalised`, `noMatch`,
  and `reason.matchedGenres`. `mode=popular` with `noMatch=false` is cold start;
  `mode=popular` with `noMatch=true` is a valid no-match result with popular
  alternatives; neither is an API error.
- Profile reset: require an explicit confirmation interaction before sending
  `{ "confirm": true }`. Cancel, missing/false confirmation, validation error,
  origin rejection, authentication error, or save failure changes no local
  committed profile state. After `200`, clear preference/rating/profile state
  and show the next recommendation request as popular cold start.
- Story #33 is not fully complete in Sprint 3: only the authenticated reset
  backend contract is committed by this document; the current `/profile` page
  remains a protected placeholder.

The current recommendation page is also a placeholder: it renders an empty
state and does not call `/api/me/recommendations`. That implementation mismatch
must be resolved by a separate feature task before claiming the Sprint 3 data
state is delivered.

Implementation handoff is explicit:

- Shared cards, API client, and recommendation container integration belong to
  [S3-T10 #112](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/112).
- No-match errors, retry, and request-race states belong to
  [S3-T11 #113](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/113).
- Cold-start transitions after saving preferences belong to
  [S3-T13 #115](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/115).
- This UI-state explanation and the matching `docs/design.md` change must be
  coordinated in the same reviewed change for
  [S3-C05 #136](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/136).

These assignments do not claim that any issue is complete or reviewed.

## 5. Account/cache/request invalidation

The current frontend has no shared query-cache library, so “cache” includes
component state and any future request cache. Private keys must include the
authenticated `user.id`; rating keys must also include `movieId`.

| Event | Required invalidation |
|---|---|
| Preferences saved | After success, replace/invalidate the current user's preference entry and invalidate that user's recommendations. Ignore older preference/recommendation responses. |
| Rating saved | After success, replace the `(userId, movieId)` rating entry and invalidate dependent private result state. Sprint 3 recommendation order must still ignore ratings. |
| Logout | After successful logout, abort/obsolete all private requests, clear all private account state, and let the guard return to `/`. Public catalogue/detail state may remain. |
| Account switch | Increment the account request generation, clear/remount private state keyed by the old `user.id`, and reject every delayed old-account response. |
| Movie switch | Increment the movie/rating request generation, clear transient rating state, and reject every delayed old-movie response. |
| Profile reset | Only after reset success, invalidate preferences, every rating for that user, recommendations, and profile summaries; the next recommendation request is cold start. |
| Protected API `401` | Use central authentication recovery (`handleUnauthorized`): discard private state and open `/login`; do not retry as the stale account. |

A response may update state only when its captured account ID, optional movie
ID, and request generation still match current UI state. Aborting a request is
preferred, but the identity/generation check is required because abort and
response completion can race.

Current account isolation evidence is the `AuthProvider` ownership model and
the `RequireAuth` subtree keyed by `user.id`. Movie-detail request cleanup is
implemented today. Preference/rating/reset request invalidation is committed
Sprint 3 behaviour with implementation pending because those API clients do
not yet exist.

## 6. UI-driven architecture evidence

The current detail UI provides two concrete design reconciliations:

1. Missing `releaseYear`/`overview` are represented as JSON `null`, backed by
   nullable SQLite columns, so the UI can render `Information unavailable`
   without discarding the rest of the movie.
2. Detail fetching is keyed by `movieId` and guarded by effect cleanup, so a
   response for a previous route cannot update the next movie after cleanup.

These are present in code, migration, and tests. No comparable backdrop field
or fallback is present; backdrop reconciliation remains pending rather than
being documented as complete.
