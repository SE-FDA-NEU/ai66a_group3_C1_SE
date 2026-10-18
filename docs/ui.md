# Sprint 3 UI-state contract

Contract revision: `S3-FINAL`, reconciled on 2026-10-18 against Sprint 3
`main` SHA `f9774cbe7248c29915086d29bf2b9f99c2aa528a`.

This document records the implemented Sprint 3 UI states and their evidence.
The profile/reset UI, rating-adjusted ranking, and NLP product behaviour remain
unfinished and are labelled as such. HTTP payloads and errors are defined in
[api.md](api.md).

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

These four API failures are the C05 UI mapping. Client-side “no genre”
validation, successful no-match data, and a valid empty filter result are not
API errors and are not used to inflate the table.

| HTTP status | API code | Business Rule | Exact rendered message | Recovery action | Evidence |
|---:|---|---|---|---|---|
| 401 | `INVALID_CREDENTIALS` | BR18 — authentication; do not reveal whether email or password was wrong | `Email or password is incorrect` | Edit the credentials and submit `Sign in` again. | [`LoginPage.tsx`](../frontend/src/pages/LoginPage.tsx), [`app.test.tsx`](../frontend/src/tests/app.test.tsx), [`s13.acceptance.ts`](../frontend/e2e/s13.acceptance.ts) |
| 409 | `EMAIL_ALREADY_REGISTERED` | BR16 — normalized email is unique | `This email is already registered` | Sign in with the existing account or use a different email. | [`RegisterPage.tsx`](../frontend/src/pages/RegisterPage.tsx), [`app.test.tsx`](../frontend/src/tests/app.test.tsx), [M3 handoff browser verification](evidence/s3-m3-p0-handoff/README.md) |
| 404 | `MOVIE_NOT_FOUND` | BR6 — an opaque movie ID opens only its own record | Heading `Movie not found`; text `That movie is not available in the active catalogue.`; return link is `Back to recommendations`, `Back to popular movies`, or `Return to catalogue` according to validated list context | Follow the rendered link to the validated originating list; direct/unsafe context returns to `/`. | [`MovieDetailPage.tsx`](../frontend/src/pages/MovieDetailPage.tsx), [`movie-detail-acceptance.test.tsx`](../frontend/src/tests/movie-detail-acceptance.test.tsx) |
| 503 | `SERVICE_UNAVAILABLE` on recommendations | Technical failure, not a new Business Rule. BR8 is relevant only because committed current-account preferences must be preserved. | Heading `Recommendations are unavailable`; body `Service is temporarily unavailable Choose Retry to load your recommendations again.`; button `Retry` | Retry the same GET. Do not rewrite or clear preferences; a successful current request replaces the error. | [`RecommendationsPage.tsx`](../frontend/src/pages/RecommendationsPage.tsx), [`recommendations.test.tsx`](../frontend/src/tests/recommendations.test.tsx), [T12 source-failure/recovery evidence](evidence/s3-t12-recommendations-acceptance/README.md) |

For `401 AUTHENTICATION_REQUIRED` on a current protected request, the actual UI
behaviour is central recovery and navigation to `/login`; it does not invent an
inline “exact message”. An obsolete request's `401` is ignored. Other API
codes retain the safe envelope and screen-specific error/retry behaviour in
[api.md](api.md). Messages must not include stack traces, SQL/database
internals, passwords, session values, or TMDb credentials.

### Movie-detail return context (S3-T17)

Every shared movie card records only the current list location in React Router
state before opening `/movies/:movieId`. The detail page accepts return paths
whose parsed pathname is exactly `/`, `/popular`, or `/recommendations` and
preserves that path's query string and fragment. Success, not-found, and error
detail states all use the same validated destination.

On `/recommendations`, `RecommendationsPage` passes that location through the
T15 `RecommendationFilter` to `MovieGrid` and `MovieCard`; filtering therefore
does not discard the return context. The same path is used for a non-empty T11
popular-alternatives snapshot as for an ordinary recommendation snapshot.

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

## 3. Implemented Sprint 3 rating UI

Movie detail remains public. A guest load calls only
`GET /api/movies/{movieId}` and must not automatically call either private
rating endpoint. If a guest chooses a rating action, open `/login` before any
private rating GET/PUT.

For an authenticated account and current movie, the implemented control has
these states:

| State | UI contract |
|---|---|
| Loading | Show `Loading your rating...` while `GET /api/me/ratings/{movieId}` is current. Do not display another account/movie's value. |
| Unrated | `rating: null`; show `Not rated yet`. Never display `0`. |
| Committed | Show `Your saved rating: 4/5` (with the actual confirmed integer 1–5). |
| Saving | Keep the prior committed value, disable duplicate submission, render button text `Saving...`, and show status `Saving your rating...`. A selected value is a draft until `200`. |
| Success | Replace the committed value only after the acknowledgement matches the current movie and submitted rating; show `Rating saved.` |
| Failure | Show `Your rating was not confirmed as saved. <safe error detail> Please retry.` Do not show success or replace the prior committed value. Keep the valid draft for retry. |
| Retry | The button text is `Retry save`; resubmit the retained draft and change committed state only after a matching API acknowledgement. |

The rendered `<select>` exposes only 1–5 and disables save when no rating is
selected. The typed client also rejects non-integer/out-of-range values before
a request (`Choose a whole-number rating from 1 to 5`); server validation
remains authoritative.

On a movie change, cancel/obsolete the old rating request and clear the old
movie's transient state before loading the new key. A delayed response for
movie A must not update movie B. On account change/logout, clear rating state
and ignore every response captured for the previous account.

Implementation/evidence: `frontend/src/api/ratings.ts`,
`frontend/src/components/MovieRating.tsx`, `movie-rating.test.tsx`,
`movie-detail-rating.test.tsx`, [T33 evidence](evidence/s3-t33-rating-control.md),
and [T34 browser/API/DB acceptance](evidence/s3-t34-rating-acceptance/README.md).

## 4. Implemented preference/recommendation states and reset UI boundary

- Preferences: initialise from the current account only. On successful save,
  accept the committed response, invalidate that account's recommendation
  result, then request/navigate to fresh recommendations. On failure, keep the
  prior committed selection and show a retry path.
- Recommendations: preserve `data.movies`, `mode`, `personalised`, `noMatch`,
  and `reason.matchedGenres`. `mode=popular` with `noMatch=false` is cold start;
  `mode=popular` with `noMatch=true` is a valid no-match result with popular
  alternatives; neither is an API error.
- Profile reset is not a current UI state. `/profile` remains a protected
  placeholder. A future UI must require explicit confirmation before sending
  `{ "confirm": true }` and invalidate private state only after `200`; the
  implemented T35 backend does not by itself complete Story #33.

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
Cold-start transitions after a preference save are implemented under T13
(#115) and verified under T14.

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

T16 (#118) supplies independent S06 acceptance and committed-database
preference comparisons. See [T15 evidence](evidence/s3-t15-recommendation-filter.md)
for author tests and the isolated real-TMDb-catalogue browser smoke.

T11 implements retry, no-match guidance, and request-race handling; T13
implements the cold-start transition after a confirmed preference save.

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

The linked implementation and acceptance records provide the completion
evidence; this C03/C05 documentation reconciliation still requires its own
reviewed PR.

## 5. Account/cache/request invalidation

The current frontend has no shared query-cache library, so “cache” includes
component state and any future request cache. Private keys must include the
authenticated `user.id`; rating keys must also include `movieId`.

| Event | Required invalidation |
|---|---|
| Preferences saved | After success, replace/invalidate the current user's preference entry and invalidate that user's recommendations. Ignore older preference/recommendation responses. |
| Rating saved | After success, replace only the current `(userId, movieId)` committed rating state. Sprint 3 recommendations are not invalidated or reranked because they ignore ratings. |
| Logout | After successful logout, abort/obsolete all private requests, clear all private account state, and let the guard return to `/`. Public catalogue/detail state may remain. |
| Account switch | Increment the account request generation, clear/remount private state keyed by the old `user.id`, and reject every delayed old-account response. |
| Movie switch | Increment the movie/rating request generation, clear transient rating state, and reject every delayed old-movie response. |
| Future profile-reset UI | Only after reset success may a future client invalidate preferences, every rating for that user, recommendations, and profile summaries; no reset UI exists at the reconciled SHA. |
| Protected API `401` | Use central authentication recovery (`handleUnauthorized`): discard private state and open `/login`; do not retry as the stale account. |

A response may update state only when its captured account ID, optional movie
ID, and request generation still match current UI state. Aborting a request is
preferred, but the identity/generation check is required because abort and
response completion can race.

Current account isolation evidence is the `AuthProvider` ownership model and
the `RequireAuth` subtree keyed by `user.id`. Movie-detail request cleanup is
implemented. T11 adds recommendation request-generation checks in
`RecommendationsPage`; preference save invalidation is implemented under T13,
and rating account/movie invalidation is implemented and verified under
T33/T34. Reset UI invalidation remains future work.

## 6. UI-driven design change: isolate asynchronous state by account/movie

1. **UI problem.** A request made for account A or movie A can complete after
   the viewer has switched to account B, navigated to movie B, saved new
   preferences, retried, or left the screen.
2. **Risk.** A late completion could render A's rating/recommendations in B's
   context, restore an old movie, or let an obsolete `401` clear B's valid
   session.
3. **Implemented design.** `AuthProvider` centrally owns account identity and
   `RequireAuth` remounts the protected subtree by `user.id`.
   `RecommendationsPage` captures `userId`, recommendation version, retry
   version, and request generation. `PreferencesPage` and `MovieRating` abort
   obsolete requests; rating state is mounted with the composite
   `(userId, movieId)` key and uses a save generation. Detail state carries its
   `movieId`. Cleanup/abort is paired with identity/generation checks because a
   response can race with abort. Only a still-current protected `401` invokes
   `handleUnauthorized`.
4. **Evidence.** [T11](evidence/s3-t11-no-match-retry-request-races.md) covers
   recommendation retry and delayed account success/error/401;
   [T14/T13](evidence/s3-t14-cold-start-acceptance/README.md) covers a delayed
   cold-start response after preference save; [T33](evidence/s3-t33-rating-control.md)
   and [T34](evidence/s3-t34-rating-acceptance/README.md) cover delayed account
   and movie rating responses plus central auth recovery.

The corresponding architecture explanation is in
[design.md §8](design.md#8-ui-driven-design-changes-with-repository-evidence).
Both files must be submitted in the same reviewed C03/C05 PR for #134/#136.

## 7. Backdrop UI, fallback, and stale detail protection

`MovieDetailPage` consumes the nullable additive `backdropUrl` from the public
detail DTO and keys `MovieBackdropHero` by movie ID and URL. The client accepts
only the reviewed `https://image.tmdb.org/t/p/w780/<file>` shape. Null, omitted,
unsafe, or failed images keep the permanent CSS gradient/overlay and readable
title; an image remains hidden until its load event succeeds. Detail cleanup
and the movie/URL key prevent old detail or image events from replacing or
poisoning the current movie.

The browser downloads image bytes from the public CDN only. It does not call
TMDb metadata/configuration APIs and receives no token. Evidence is in
`MovieBackdropHero.tsx`, `backdropUrl.ts`, `movie-backdrop.test.tsx`,
[T37 UI evidence](evidence/s3-t37-backdrop-ui/README.md), and
[T28 acceptance](evidence/s3-t28-backdrop-acceptance/README.md).
