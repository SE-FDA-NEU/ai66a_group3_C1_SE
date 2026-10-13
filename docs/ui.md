# Sprint 3 UI-state contract

Contract revision: `S3-DRAFT`, reconciled with the current frontend on
2026-10-13.

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
| 404 | `MOVIE_NOT_FOUND` | Opaque ID is not present in the active catalogue | Heading `Movie not found`; text `That movie is not available in the active catalogue.` | Return to the validated originating movie list; a direct or unsafe return context uses `Return to catalogue` and `/`. |
| 409 | `EMAIL_ALREADY_REGISTERED` | Normalized email already exists | `This email is already registered` | Sign in or use a different email. |
| 503 | `CATALOGUE_UNAVAILABLE` | No active local catalogue revision | Heading `Movies are unavailable`; text `Movie catalogue is unavailable` | `Retry`; operator fixes/imports the catalogue if it persists. |
| 503 | `SERVICE_UNAVAILABLE` | Database read/write is unavailable | Heading `Movies are unavailable` (catalogue screen); text `Service is temporarily unavailable` | `Retry`; preserve previously committed/private state. |

Messages must not include stack traces, SQL/database internals, passwords,
session values, or TMDb credentials. The two Story messages remain exact:
`Email or password is incorrect` and `This email is already registered`.

### Movie-detail return context (S3-T17)

Every shared movie card records only the current list location in React Router
state before opening `/movies/:movieId`. The detail page accepts return paths
whose parsed pathname is exactly `/`, `/popular`, or `/recommendations` and
preserves that path's query string and fragment. Success, not-found, and error
detail states all use the same validated destination.

The state is navigation context, not trusted input or account data. Absolute
URLs, scheme-relative values such as `//example.com`, backslashes, malformed
values, non-string values, and internal paths outside the list allow-list are
discarded. A direct detail URL has no return state and therefore renders
`Return to catalogue` linking to `/`.

Returning from a recommendation detail opens `/recommendations`, where the
existing protected route and current session select the account and fetch its
recommendations again. The round trip never serialises genre choices and never
calls `PUT /api/me/preferences`, so the database remains the sole owner of the
account's committed preferences.

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

The recommendation page (S3-T10) now calls `GET /api/me/recommendations?limit=10`
through `frontend/src/api/recommendations.ts`. It renders `data.movies` in
server order with the shared movie cards and these states:

| State | Rendered content |
|---|---|
| Loading | `Loading recommendations...` |
| Popular cold start (`mode=popular`, `noMatch=false`) | Heading `Popular`, label `Not personalised`, cards without a genre-match reason; it is not presented as a failed personalisation request |
| Personalised (`mode=personalised`) | Heading `Recommended for you`, cards with `Matches your genres: <names>` from `reason.matchedGenres` |
| No match (`mode=popular`, `noMatch=true`) | `No movies matched your favourite genres.` with `Edit preferences` and `Retry`; render any returned `data.movies` once as `Popular alternatives` |
| Valid empty (`movies: []`, `noMatch=false`) | `No recommendations available yet.` with a link to `/preferences`; zero cards and no error/no-match claim |
| Error | Alert `Recommendations are unavailable` with the API/network message and `Retry`; never shown as empty or no-match data |
| Protected API `401` | `handleUnauthorized` discards the account and opens `/login` |

T11 (#113) implements retry, no-match guidance, and request-race handling.
Every attempt uses the single T10 client path with the same `limit=10` query.
The component captures the authenticated `user.id` and a request generation;
it aborts obsolete work and also rejects delayed completions whose generation
is no longer current. An old success or `401` therefore cannot replace or sign
out a newer account after retry, navigation, logout, or account switch.
Cold-start transitions after a preference save remain owned by T13 (#115).

### Current-list genre filtering (S3-T15, #117)

The ready, non-empty recommendation list is passed to
`frontend/src/components/RecommendationFilter.tsx` as one accepted response
snapshot. `Filter by genre` defaults to `All genres`. Options use canonical IDs
from the authenticated `GET /api/genres` active-catalogue list, not only genres
present in these up-to-ten cards. A genre available elsewhere in the catalogue
can therefore legitimately have no matches in the current snapshot.

- Selection filters `snapshot.movies` locally and preserves server order,
  card links, popular labels, and personalised matching reasons.
- `Showing N of M movies` reports the visible count and original snapshot size.
- Zero filtered matches show `No movies match this filter.` and
  `Clear filter to see the full recommendation list.`, with `Show all movies`.
  This is not an API failure, an empty source catalogue, or `noMatch=true`.
- `Clear filter` or `All genres` restores the original snapshot. No preference
  write, recommendations refetch, browser-storage write, or TMDb call occurs.
- Each newly accepted response object resets selection to `All genres` and
  becomes the only reset target, even if the catalogue revision is unchanged.
  An ordinary rerender with the same response keeps the current filter.
- Genre-option loading/failure does not hide valid cards. The disabled select
  explains loading/unavailable options; `Retry filter options` retries only
  `GET /api/genres`. A genre `401` uses central auth recovery. Cleanup aborts
  old option requests and ignores their late success/error responses.
- Account changes remount the guarded subtree, discarding the temporary filter.
- A non-empty T11 no-match alternatives snapshot uses the same filter without
  hiding its guidance, `Edit preferences`, or `Retry`. An accepted retry
  response is a new snapshot and resets the temporary selection.

T16 (#118) still owns independent S06 acceptance and committed-database
preference comparisons. See [T15 evidence](evidence/s3-t15-recommendation-filter.md)
for author tests and the isolated real-TMDb-catalogue browser smoke. This does
not claim Story #23 is closed or that T13 is implemented.

T11 remains responsible for retry, no-match guidance, and request-race
handling; cold-start transitions remain owned by T13 (#115).

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
implemented today. T11 adds recommendation request generation checks in
`RecommendationsPage`; preference request invalidation is also implemented.
Rating/reset UI invalidation remains owned by their dedicated tasks.

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
