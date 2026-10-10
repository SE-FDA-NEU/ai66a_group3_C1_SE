# Sprint 3 HTTP API contract

Contract revision: `S3-DRAFT`, reconciled with the current M2 runtime on
2026-10-09.

This document inventories the implemented M2 HTTP boundary and defines the
committed Sprint 3 contracts needed by implementation consumers. Every route
is labelled `Implemented in M2` or `Committed Sprint 3 contract;
implementation pending`. A committed contract is required Sprint scope, but
is not an availability or test-evidence claim until its implementation and
verification evidence exist.

Architecture and persistence rules are in
[architecture.md](architecture.md).

## 1. Conventions

- Product API base path: `/api`.
- JSON field names use `camelCase`.
- Success bodies use `{ "data": ... }`; list metadata uses `meta`.
- Errors use the stable envelope below.
- Account and movie IDs are opaque strings. Genre IDs are provider numeric
  IDs.
- Nullable provider fields are returned as JSON `null`. The UI renders
  `Information unavailable` when a movie year or overview is missing.
- Authentication uses the same-origin `ams_session` cookie. Browser bearer
  tokens and local-storage tokens are not part of this contract.
- Browser `POST /api/auth/login` and `POST /api/auth/logout` requests must pass
  the same-origin Fetch Metadata/`Origin` check. Cross-origin and same-site
  browser writes return `403 ORIGIN_NOT_ALLOWED` before session state changes.
- Committed Sprint 3 browser writes (`PUT /api/me/preferences`,
  `PUT /api/me/ratings/{movieId}`, and `POST /api/me/profile/reset`) must reuse
  that protection. The current middleware covers login/logout only, so this is
  an implementation requirement, not current runtime behaviour.
- Protected endpoints derive the account only from the authenticated session.
  A client-supplied `user_id`, account ID, email, username, or owner field
  cannot select or change the target account. Such fields are not part of a
  valid DTO and must never redirect a read or mutation to another account.
- Passwords, hashes, session digests, cookie values, and TMDb credentials never
  appear in a response.

### Error envelope

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email or password is incorrect",
    "requestId": "req_example"
  }
}
```

Validation errors may add a safe `fields` object. It must not echo a password,
cookie, credential, SQL text, or stack trace.

Every error response includes a generated `requestId` so a client can correlate
the failure with server-side logs. Persistence failures on implemented
authentication routes are returned as `503 SERVICE_UNAVAILABLE` with the same
safe envelope.

## 2. Endpoint inventory and delivery status

`Implemented in M2` means a callable route and its supporting behaviour exist
in the repository. `Committed Sprint 3 contract; implementation pending`
means consumers may build against the frozen contract, but the route is not
yet available in the current repository.

| Story | Method | Endpoint | Access | Input | Success | Representative errors | Delivery status |
|---|---|---|---|---|---|---|---|
| Infrastructure | `GET` | `/health` | Public | None | `200` health and database/migration state | `503 SERVICE_UNAVAILABLE` | `Implemented in M2` |
| S12 | `POST` | `/api/auth/register` | Public | `RegisterRequest` | `201 RegisterResponse` | `400 VALIDATION_ERROR`, `409 EMAIL_ALREADY_REGISTERED` | `Implemented in M2` |
| S13 | `POST` | `/api/auth/login` | Public, same-origin write | `LoginRequest` | `200 AuthResponse` and opaque cookie | `400 VALIDATION_ERROR`, `401 INVALID_CREDENTIALS`, `403 ORIGIN_NOT_ALLOWED` | `Implemented in M2` |
| S13 | `POST` | `/api/auth/logout` | Cookie optional; idempotent same-origin write | None | `204`, session invalidated and cookie cleared | `403 ORIGIN_NOT_ALLOWED`, `503 SERVICE_UNAVAILABLE` | `Implemented in M2` |
| S13 | `GET` | `/api/auth/me` | Authenticated | None | `200 AuthResponse` | `401 AUTHENTICATION_REQUIRED`, `503 SERVICE_UNAVAILABLE` | `Implemented in M2` |
| S02, S04 | `GET` | `/api/me/recommendations?limit=10` | Authenticated | Optional integer `limit`, 1-10 | `200 RecommendationResponse` with popular/cold-start results | `400 VALIDATION_ERROR`, `401 AUTHENTICATION_REQUIRED`, `503 CATALOGUE_UNAVAILABLE` | `Implemented in M2` |
| S04 | `GET` | `/api/movies?limit=10` | Public | Optional integer `limit`, 1-10, default 10 | `200 MovieListResponse`; catalogue entries without popularity may be included and sort last when popularity ordering is used | `400 VALIDATION_ERROR`, `503 CATALOGUE_UNAVAILABLE`, `503 SERVICE_UNAVAILABLE` | `Implemented in M2`; public catalogue route |
| S09 / T19 | `GET` | `/api/movies/popular?limit=10` | Public | Optional integer `limit`, 1-10, default 10 | `200 MovieListResponse`; only movies with valid popularity | `400 VALIDATION_ERROR`, `503 CATALOGUE_UNAVAILABLE`, `503 SERVICE_UNAVAILABLE` | `Implemented in M3`; dedicated popular-movie route |
| S03 | `GET` | `/api/movies/{movieId}` | Public | Opaque `movieId` | `200 MovieDetailResponse` | `404 MOVIE_NOT_FOUND`, `503 CATALOGUE_UNAVAILABLE`, `503 SERVICE_UNAVAILABLE` | `Implemented in M2` |
| S01 | `GET` | `/api/genres` | Authenticated | None | `200 GenreListResponse` | `401 AUTHENTICATION_REQUIRED`, `503 CATALOGUE_UNAVAILABLE`, `503 SERVICE_UNAVAILABLE` | `Implemented in Sprint 3 (S3-T01)` |
| S01 | `GET` | `/api/me/preferences` | Authenticated | None | `200 PreferenceResponse` | `401 AUTHENTICATION_REQUIRED`, `503 SERVICE_UNAVAILABLE` | `Implemented in Sprint 3 (S3-T01)` |
| S01 | `PUT` | `/api/me/preferences` | Authenticated, same-origin write | `PreferenceRequest` | `200 PreferenceResponse` after commit | `400 VALIDATION_ERROR`, `401 AUTHENTICATION_REQUIRED`, `403 ORIGIN_NOT_ALLOWED`, `404 GENRE_NOT_FOUND`, `503 SERVICE_UNAVAILABLE` | `Committed Sprint 3 contract; implementation pending` |
| S05a | `GET` | `/api/me/ratings/{movieId}` | Authenticated | Opaque `movieId` | `200 RatingResponse` | `401 AUTHENTICATION_REQUIRED`, `404 MOVIE_NOT_FOUND`, `503 SERVICE_UNAVAILABLE` | `Committed Sprint 3 contract; implementation pending` |
| S05a | `PUT` | `/api/me/ratings/{movieId}` | Authenticated, same-origin write | `RatingRequest` | `200 RatingResponse` after commit | `400 VALIDATION_ERROR`, `401 AUTHENTICATION_REQUIRED`, `403 ORIGIN_NOT_ALLOWED`, `404 MOVIE_NOT_FOUND`, `503 SERVICE_UNAVAILABLE` | `Committed Sprint 3 contract; implementation pending` |
| S11 | `POST` | `/api/me/profile/reset` | Authenticated, same-origin write | `ProfileResetRequest` | `200 ProfileResetResponse` after commit | `400 VALIDATION_ERROR`, `401 AUTHENTICATION_REQUIRED`, `403 ORIGIN_NOT_ALLOWED`, `503 SERVICE_UNAVAILABLE` | `Committed Sprint 3 backend contract; implementation pending` |

S3-T01 added the `user_genre_preferences` table and the two read routes
`GET /api/genres` and `GET /api/me/preferences`. The dedicated
`GET /api/movies/popular` route is implemented in M3 under T19. The current
repository has no `PUT /api/me/preferences`, ratings, or reset route, model,
migration, repository, or executable test. Personalised recommendations are
not yet implemented. Genre filtering, similar movies, and search remain outside
this contract update.


## 3. Shared DTOs

### `UserDto`

```text
id: string
email: string
```

### `GenreDto`

```text
id: number
name: string
```

### `MovieSummaryDto`

```text
id: string
title: string
releaseYear: number | null
genres: GenreDto[]
popularityScore: number | null
```

### `MovieDetailDto`

```text
id: string
title: string
releaseYear: number | null
genres: GenreDto[]
overview: string | null
popularityScore: number | null
voteAverage: number | null
voteCount: number | null
```

The public movie `id` is the stable internal ID. A TMDb source ID is not part
of a public DTO.

### Sprint 3 recommendation and account DTOs

`RecommendationMovieDto` keeps every `MovieSummaryDto` field and adds:

```text
reason:
  matchedGenres: GenreDto[]
```

For `mode="personalised"`, `matchedGenres` is the non-empty intersection of
that movie's canonical genres and the current account's saved genres. For a
popular result or popular no-match alternative it is an empty list. Provider
IDs and TMDb credentials are never included.

`RatingResponse` uses an opaque movie ID and represents unrated with JSON
`null`, never `0`:

```text
movieId: string
rating: 1 | 2 | 3 | 4 | 5 | null
```

## 4. S12 registration

### `POST /api/auth/register`

Request:

```json
{
  "email": "USER@example.com",
  "password": "movie123"
}
```

The server trims and lowercases the email, validates the input, and stores only
an Argon2id password hash. Registration does not create a session.

Success (`201`):

```json
{
  "data": {
    "user": {
      "id": "8de52c49-54e0-4ad4-a39b-fc48db128330",
      "email": "user@example.com"
    }
  }
}
```

| Condition | Status/code | Public message |
|---|---|---|
| Invalid email or password shorter than 8 characters | `400 VALIDATION_ERROR` | `Please correct the highlighted fields` |
| Normalized email already exists | `409 EMAIL_ALREADY_REGISTERED` | `This email is already registered` |
| Persistence unavailable | `503 SERVICE_UNAVAILABLE` | `Service is temporarily unavailable` |

The UI opens `/login` only after a `201` response.

## 5. S13 authentication

### `POST /api/auth/login`

Request:

```json
{
  "email": "viewer@example.com",
  "password": "movie123"
}
```

Success (`200`) returns the safe `UserDto` shape used by registration and sets
an opaque cookie:

```http
Set-Cookie: ams_session=<opaque-random-value>; Path=/; HttpOnly; Secure; SameSite=Lax
```

`Secure` may be disabled only in documented localhost development. Unknown
email and incorrect password return the same response:

| Condition | Status/code | Public message |
|---|---|---|
| Required input missing | `400 VALIDATION_ERROR` | `Email and password are required` |
| Unknown email or wrong password | `401 INVALID_CREDENTIALS` | `Email or password is incorrect` |
| Cross-origin or same-site browser write | `403 ORIGIN_NOT_ALLOWED` | `Request origin is not allowed` |
| Persistence unavailable | `503 SERVICE_UNAVAILABLE` | `Service is temporarily unavailable` |

The UI opens `/recommendations` only after successful login.

### `GET /api/auth/me`

The request has no account identifier. A valid cookie returns `200` with the
same safe `AuthResponse` as login. A missing, expired, invalid, or revoked
session returns `401 AUTHENTICATION_REQUIRED` with message
`Authentication required`.

### `POST /api/auth/logout`

The operation is idempotent and has no request DTO. It invalidates a valid
session, clears the cookie, and returns `204 No Content`. The UI then opens
`/`. Reusing the revoked cookie cannot authenticate a protected endpoint.
The same-origin check runs before revocation, so a rejected browser request
cannot terminate the current session.

## 6. Committed Sprint 3: genres and account preferences

The following contracts are committed Sprint 3 scope, not optional future
work. S3-T01 implements the account-owned preference migration and the read
routes `GET /api/genres` and `GET /api/me/preferences`. Preference replacement
through `PUT /api/me/preferences` and personalised recommendations remain
pending, so those parts are not runtime or completion evidence.

Sprint 3 data-source decision (2026-10-06): development/staging/demo catalogue
must be imported from TMDb into SQLite and verified under T29/C04 in the
[runbook](tmdb-sprint3-runbook.md). This applies to genres, recommendations,
the public catalogue, the dedicated popular list, and details. Runtime
endpoints read the local active catalogue and never call TMDb API; account
preferences are stored by this application.
Public IDs/DTOs remain unchanged. Operator provenance uses database source IDs
and timestamps, not tokens or new public source-ID fields. Synthetic fixtures
and provider-boundary mocks remain the automated-test path; mandatory live
import/provenance smoke runs separately outside CI. S3-T01 implements preference storage
and the preference reads, but this policy does not claim that preference
replacement or personalised recommendation behaviour is implemented.
The dedicated public popular movie route is implemented in M3 under T19. The existing
`/api/movies` route is the public catalogue route and is a separate contract.

All three routes require a valid, unexpired, unrevoked session. The account is
resolved from `ams_session`; no request contains an account identity. Genres,
preferences, and later recommendation requests read local SQLite only.

### `GET /api/genres`

Returns the canonical genres carried by at least one movie of the active
catalogue revision, sorted by name then ID. A genre that no active movie uses
could never match a recommendation, so it is not offered:

```json
{
  "data": {
    "genres": [
      { "id": 28, "name": "Action" },
      { "id": 35, "name": "Comedy" }
    ]
  }
}
```

A missing session returns `401 AUTHENTICATION_REQUIRED`; no active catalogue
returns `503 CATALOGUE_UNAVAILABLE`; a database failure returns
`503 SERVICE_UNAVAILABLE`.

### `GET /api/me/preferences`

Returns only the authenticated account's saved selection. An account with no
preferences receives `200` and an empty list, not a 404.

```json
{
  "data": {
    "genres": [
      { "id": 28, "name": "Action" }
    ]
  }
}
```

### `PUT /api/me/preferences`

Request:

```json
{
  "genreIds": [28, 35]
}
```

The list must contain 1-5 distinct, existing canonical genre IDs. The server
replaces only the authenticated account's preference rows in one transaction
and returns the `PreferenceResponse` above only after commit. An invalid or
failed replacement leaves the previously committed selection unchanged.

| Condition | Status/code | Public message |
|---|---|---|
| Empty, duplicate, non-integer, or more than five IDs; missing/malformed body | `400 VALIDATION_ERROR` | `Please correct the highlighted fields` |
| Any genre does not exist | `404 GENRE_NOT_FOUND` | `Genre not found` |
| Missing or invalid session | `401 AUTHENTICATION_REQUIRED` | `Authentication required` |
| Browser write fails the existing same-origin policy | `403 ORIGIN_NOT_ALLOWED` | `Request origin is not allowed` |
| Transaction unavailable | `503 SERVICE_UNAVAILABLE` | `Service is temporarily unavailable` |

No request or response accepts a `userId` field. After a successful save the
client invalidates the current account's preference and recommendation state;
it must not reuse another account's cached response.

## 7. Recommendation contract: current M2 and Sprint 3 target

### `GET /api/me/recommendations?limit=10`

`limit` defaults to 10 and accepts an integer from 1 through 10. The account is
resolved only from the authenticated session.

The route is implemented, but it currently returns the shared popular
catalogue ordering for every authenticated account. It does not read saved
preferences or ratings and is not personalised.

Response shape:

```json
{
  "data": {
    "movies": [
      {
        "id": "3ef5aa47-3ec6-41c8-9337-f5059d257988",
        "title": "Example Movie",
        "releaseYear": 2025,
        "genres": [
          { "id": 28, "name": "Action" }
        ],
        "popularityScore": 90.0
      }
    ],
    "mode": "popular",
    "personalised": false,
    "noMatch": false
  },
  "meta": {
    "count": 1,
    "limit": 10,
    "catalogueRevision": "revision-example"
  }
}
```

The response always uses `mode=popular`, `personalised=false`, and
`noMatch=false`. A valid active catalogue with no usable movies returns
`200` with `movies: []`. No active catalogue returns
`503 CATALOGUE_UNAVAILABLE`.

Popular alternatives contain only movies with finite popularity, sorted by
popularity descending, title A-Z for ties, and internal movie ID as the final
deterministic tie.

### Committed Sprint 3 personalised response (implementation pending)

Sprint 3 keeps `data.movies`, `mode`, `personalised`, and `noMatch` and adds the
recommendation explanation field `reason.matchedGenres` to each result. It
does not rename or move those fields.

```json
{
  "data": {
    "movies": [
      {
        "id": "3ef5aa47-3ec6-41c8-9337-f5059d257988",
        "title": "Example Movie",
        "releaseYear": 2025,
        "genres": [{ "id": 28, "name": "Action" }],
        "popularityScore": 90.0,
        "reason": {
          "matchedGenres": [{ "id": 28, "name": "Action" }]
        }
      }
    ],
    "mode": "personalised",
    "personalised": true,
    "noMatch": false
  },
  "meta": {
    "count": 1,
    "limit": 10,
    "catalogueRevision": "revision-example"
  }
}
```

The three valid state combinations are:

| Account/catalogue state | `mode` | `personalised` | `noMatch` | `reason.matchedGenres` |
|---|---|---:|---:|---|
| No saved preferences | `popular` | `false` | `false` | Empty for every popular movie |
| Preferences and at least one match | `personalised` | `true` | `false` | Non-empty intersection for every movie |
| Preferences but zero matches | `popular` | `false` | `true` | Empty for every popular alternative |

Sprint 3 ranking uses only the current account's saved genres and local
`popularityScore`: candidates must share at least one selected genre, then use
the existing popularity-descending, title-ascending, ID-ascending order. The
response contains at most ten distinct opaque movie IDs. Rating-adjusted
ranking is explicitly outside Sprint 3; it belongs to Story #22, S05b, and is
planned Sprint 4 behaviour. Saving a rating in Sprint 3 must not change this
ordering.

Missing, expired, or revoked sessions return `401 AUTHENTICATION_REQUIRED`
before a private result is returned. Catalogue/database failures use the same
`503 CATALOGUE_UNAVAILABLE`/`503 SERVICE_UNAVAILABLE` distinction as the M2
route. The route never contacts TMDb during a request.

## 8. S03/S04 catalogue and S09/T19 popular movie reads

### `GET /api/movies?limit=10`

This is the implemented public catalogue endpoint for S04. `limit` defaults to
10 and accepts an integer from 1 through 10. Results read only the active local
catalogue; the endpoint never contacts TMDb. Movies without a valid popularity
value may still be returned. When popularity ordering is used, those entries
appear after movies with finite popularity.

Success (`200`):

```json
{
  "data": {
    "movies": [
      {
        "id": "3ef5aa47-3ec6-41c8-9337-f5059d257988",
        "title": "Example Movie",
        "releaseYear": 2025,
        "genres": [
          { "id": 28, "name": "Action" }
        ],
        "popularityScore": 90.0
      },
      {
        "id": "33da16a6-c912-4e46-9b8a-a5063a0d87b2",
        "title": "Catalogue Movie Without Popularity",
        "releaseYear": null,
        "genres": [],
        "popularityScore": null
      }
    ]
  },
  "meta": {
    "count": 2,
    "limit": 10,
    "catalogueRevision": "revision-example"
  }
}
```

Sort order is finite popularity descending, missing/null popularity last,
title A-Z for ties, and internal movie ID as the final deterministic
tie-breaker. This endpoint must not be treated as the dedicated popular-movie
endpoint.

| Condition | Status/code | Public message |
|---|---|---|
| `limit` outside 1-10 or not an integer | `400 VALIDATION_ERROR` | `Please correct the highlighted fields` |
| No active catalogue | `503 CATALOGUE_UNAVAILABLE` | `Movie catalogue is unavailable` |
| Database read failure | `503 SERVICE_UNAVAILABLE` | `Service is temporarily unavailable` |

An empty active catalogue returns `200` with `movies: []`; the UI shows
guidance and never invents movies.

### `GET /api/movies/popular?limit=10` (implementation in M3)

This is the dedicated public popular-movie endpoint introduced for S09/T19.
`limit` defaults to 10 and accepts an integer from 1 through 10. It returns only
movies whose `popularityScore` is a valid finite number. Null, missing, NaN, and
infinite popularity values are not eligible. Results sort by popularity
descending, title A-Z for ties, and internal movie ID as the final deterministic
tie-breaker.

Consumers rendering the Sprint 3 public popular list must call this endpoint,
not `GET /api/movies`. The two routes intentionally share the response envelope
but have different filtering semantics.

Success (`200`):

```json
{
  "data": {
    "movies": [
      {
        "id": "3ef5aa47-3ec6-41c8-9337-f5059d257988",
        "title": "Example Movie",
        "releaseYear": 2025,
        "genres": [
          { "id": 28, "name": "Action" }
        ],
        "popularityScore": 90.0
      }
    ]
  },
  "meta": {
    "count": 1,
    "limit": 10,
    "catalogueRevision": "revision-example"
  }
}
```

| Condition | Status/code | Public message |
|---|---|---|
| `limit` outside 1-10 or not an integer | `400 VALIDATION_ERROR` | `Please correct the highlighted fields` |
| No active catalogue | `503 CATALOGUE_UNAVAILABLE` | `Movie catalogue is unavailable` |
| Database read failure | `503 SERVICE_UNAVAILABLE` | `Service is temporarily unavailable` |

An active catalogue with no valid finite popularity values returns `200` with
`movies: []`. That empty result is valid popular-list data; the UI shows its
no-data state and never substitutes unranked catalogue entries.

### `GET /api/movies/{movieId}`

`movieId` is an opaque internal ID used in a parameterized lookup. It is not
interpreted as a TMDb ID.

Success (`200`):

```json
{
  "data": {
    "movie": {
      "id": "3ef5aa47-3ec6-41c8-9337-f5059d257988",
      "title": "Example Movie",
      "releaseYear": null,
      "genres": [
        { "id": 28, "name": "Action" }
      ],
      "overview": null,
      "popularityScore": 90.0,
      "voteAverage": 7.2,
      "voteCount": 1200
    }
  },
  "meta": {
    "catalogueRevision": "revision-example"
  }
}
```

| Condition | Status/code | Public message |
|---|---|---|
| Internal movie ID not found | `404 MOVIE_NOT_FOUND` | `Movie not found` |
| No active catalogue | `503 CATALOGUE_UNAVAILABLE` | `Movie catalogue is unavailable` |
| Database read failure | `503 SERVICE_UNAVAILABLE` | `Service is temporarily unavailable` |

A missing year or overview remains JSON `null`; the UI displays
`Information unavailable` for that field. Storage failure is never translated
to a false 404. Movie detail remains public; a guest opening it must not cause
the frontend to call a private rating endpoint.

## 9. Committed Sprint 3 rating contract (implementation pending)

These two S05a routes are committed Sprint 3 scope and frozen for consumers;
they are not implemented routes in the current working tree. Their session
ownership and isolation rules support Story #45 / S13.
Both use the current authenticated session as the only account identity and
address a movie by its opaque active-catalogue ID.

### `GET /api/me/ratings/{movieId}`

The request has no body and returns only the committed rating owned by the
current session account. Unrated is represented by `null`, not `0`.

Success (`200`, rated):

```json
{
  "data": {
    "movieId": "3ef5aa47-3ec6-41c8-9337-f5059d257988",
    "rating": 4
  }
}
```

Success (`200`, unrated):

```json
{
  "data": {
    "movieId": "3ef5aa47-3ec6-41c8-9337-f5059d257988",
    "rating": null
  }
}
```

### `PUT /api/me/ratings/{movieId}`

Exact request:

```json
{
  "rating": 4
}
```

Exact success (`200`, only after commit):

```json
{
  "data": {
    "movieId": "3ef5aa47-3ec6-41c8-9337-f5059d257988",
    "rating": 4
  }
}
```

`rating` is a strict JSON integer and only `1`, `2`, `3`, `4`, or `5` is
valid. The server must reject `0`, `6`, negatives, fractions such as `3.5`,
strings including `"5"`, booleans, `null`, a missing field, extra identity
fields, malformed JSON, and any malformed payload with
`400 VALIDATION_ERROR` / `Please correct the highlighted fields`. Rejection
does not replace a previously committed rating.

| Condition | Status/code | Public message and persistence rule |
|---|---|---|
| Missing, expired, revoked, or invalid session | `401 AUTHENTICATION_REQUIRED` | `Authentication required`; no private read/write |
| Browser write fails the existing same-origin policy | `403 ORIGIN_NOT_ALLOWED` | `Request origin is not allowed`; no mutation |
| Opaque movie ID is not in the active catalogue | `404 MOVIE_NOT_FOUND` | `Movie not found`; do not create a movie or orphan rating |
| Invalid JSON/body/rating value | `400 VALIDATION_ERROR` | `Please correct the highlighted fields`; preserve the prior committed rating |
| Read or commit fails | `503 SERVICE_UNAVAILABLE` | `Service is temporarily unavailable`; rollback and preserve the prior committed rating |

Neither route accepts `userId`, account ID, email, username, or owner ID. A
forged identity field cannot read, update, or retarget another account. The
database target is one row per `(user_id, movie_id)` with a `1..5` check; the
storage contract is in [architecture.md](architecture.md).

## 10. Committed Sprint 3 profile-reset backend contract (implementation pending)

### `POST /api/me/profile/reset`

This route freezes only the authenticated reset backend contract for Sprint 3;
it supports Story #45 / S13 account isolation and does not claim completion of
all Story #33 / S11 profile UI behaviour.

Exact confirmation request:

```json
{
  "confirm": true
}
```

Exact success (`200`, only after the transaction commits):

```json
{
  "data": {
    "reset": true
  }
}
```

The server deletes the current account's preference rows and rating rows in
one transaction. It does not delete the user, session, catalogue, movies,
genres, another account's rows, or any provider data. The current session is
preserved. If either delete or the commit fails, the whole transaction rolls
back and returns `503 SERVICE_UNAVAILABLE`; partial reset and false success are
forbidden.

Missing `confirm`, `false`, non-boolean values, extra identity fields,
malformed JSON, and malformed payloads return `400 VALIDATION_ERROR` /
`Please correct the highlighted fields` with no mutation. Missing, expired,
or revoked sessions return `401 AUTHENTICATION_REQUIRED`; a rejected browser
origin returns `403 ORIGIN_NOT_ALLOWED`. The account always comes from
`ams_session`, never from request data.

After success, the next recommendation request observes no saved preferences
and therefore returns the popular cold-start state (`mode="popular"`,
`personalised=false`, `noMatch=false`). The client invalidates current-account
preferences, ratings, recommendation results, in-flight private requests, and
profile state only after the reset success response.

## 11. Error code registry

| Code | HTTP status | Meaning |
|---|---:|---|
| `VALIDATION_ERROR` | 400 | Request fields or query values are invalid. |
| `AUTHENTICATION_REQUIRED` | 401 | A protected route has no valid session. |
| `INVALID_CREDENTIALS` | 401 | Login credentials are invalid without revealing which field failed. |
| `ORIGIN_NOT_ALLOWED` | 403 | A browser session write failed the same-origin check. |
| `MOVIE_NOT_FOUND` | 404 | The internal movie ID does not exist in the active catalogue. |
| `GENRE_NOT_FOUND` | 404 | A requested genre ID does not exist. |
| `EMAIL_ALREADY_REGISTERED` | 409 | The normalized email is already stored. |
| `SERVICE_UNAVAILABLE` | 503 | Required persistence (account or catalogue) is unavailable. |
| `CATALOGUE_UNAVAILABLE` | 503 | No active catalogue is readable. |

`GENRE_NOT_FOUND` is a committed preference-contract code and is not returned by
the current router. All other codes in this table are present in the M2 backend
or existing API contract. Sprint 3 rating and reset validation deliberately
reuse `VALIDATION_ERROR`; this document does not invent rating/reset-specific
codes.

## 12. Scope boundary

The dedicated public popular movie endpoint (`GET /api/movies/popular`)
is implemented in M3 under T19, reusing the shared deterministic
popularity/title/ID ranker.

The preference storage and the preference reads (`GET /api/genres`,
`GET /api/me/preferences`) are implemented in Sprint 3 under S3-T01.
Preference replacement (`PUT /api/me/preferences`), ratings, profile reset,
personalised recommendations, and NLP endpoints remain unimplemented. Sections
6 (preference write), 7 (committed personalised response), 9, and 10 remain
committed Sprint 3 delivery contracts, not optional future work, while their
implementation status remains pending.

Section 8 documents both the existing public catalogue endpoint and the
implemented dedicated popular movie endpoint.

Automated tests must use synthetic SQLite fixtures or provider mocks and run
offline without a TMDb token. Live TMDb catalogue import is a separate
server-side development/staging/M3 acceptance step; the token must never
appear in DTOs, frontend assets, logs, fixtures, or documentation evidence.
