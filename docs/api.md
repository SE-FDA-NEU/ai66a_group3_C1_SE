# HTTP API contract: Sprint 3 baseline and Sprint 4 extensions

Contract revision: `S3-FINAL`, reconciled on 2026-10-18 against Sprint 3
`main` SHA `f9774cbe7248c29915086d29bf2b9f99c2aa528a`.

Sprint 4 C03 contract (merged in PR #222, main `37c2f66`, 2026-10-24):
section 13 specifies future routes and
additive fields for [#217](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/217).
It is a design contract, **not evidence that these routes or fields are live**.
Sections 1–12 remain the implemented Sprint 3/post-M3 baseline until the
respective feature owners implement and verify the section 13 changes.

S4-T03 implements the section 13.1 rating-aware protected recommendation
ranking on 2026-10-25, reusing S4-T02 (#197) signals and the finalized C03
(#217) field names. See [ranking evidence](evidence/s4-t03-rating-ranking/README.md)
for RED/GREEN and regression outputs. Other section 13 features retain their
own delivery status; score presentation UI is separate from this backend task.

T01's reconciled candidate implements the nullable `posterUrl` additions below
and the Home-first/explicit-intent navigation in section 13.5. It does not
implement the planned ranking, NLP, profile, watchlist or trailer features.
The auth DTOs, cookies, errors, ranking and pagination remain unchanged.

This document inventories the implemented M2 and Sprint 3 HTTP boundary. Every
route is labelled with its delivered milestone/task. Genuinely unfinished
product scope, including profile/reset UI and NLP
product endpoints, is called out separately and is not represented as complete.

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
- `PUT /api/me/preferences`, `PUT /api/me/ratings/{movieId}`, and
  `POST /api/me/profile/reset` reuse that protection under S3-T02, S3-T31
  ([#138](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/138)),
  and S3-T35
  ([#142](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/142)).
  The same-origin registry matches method and path; login/logout protection is
  preserved. Rating writes are matched by path prefix.
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

The current backend returns only `code`, `message`, and `requestId` in the error
object; it does not add a `fields` object. Errors must not echo a password,
cookie, credential, SQL text, or stack trace.

Every error response includes a generated `requestId` so a client can correlate
the failure with server-side logs. Persistence failures on implemented
authentication routes are returned as `503 SERVICE_UNAVAILABLE` with the same
safe envelope.

## 2. Endpoint inventory and delivery status

`Implemented in M2` and `Implemented in Sprint 3` both mean the callable route
and supporting behaviour exist at the reconciled SHA. The only intentionally
incomplete UI boundary in this inventory is profile reset; its backend route is
implemented and its UI is still absent.

| Story | Method | Endpoint | Access | Input | Success | Representative errors | Delivery status |
|---|---|---|---|---|---|---|---|
| Infrastructure | `GET` | `/health` | Public | None | `200` health and database/migration state | `503 SERVICE_UNAVAILABLE` | `Implemented in M2` |
| S12 | `POST` | `/api/auth/register` | Public | `RegisterRequest` | `201 RegisterResponse` | `400 VALIDATION_ERROR`, `409 EMAIL_ALREADY_REGISTERED`, `503 SERVICE_UNAVAILABLE` | `Implemented in M2` |
| S13 | `POST` | `/api/auth/login` | Public, same-origin write | `LoginRequest` | `200 AuthResponse` and opaque cookie | `400 VALIDATION_ERROR`, `401 INVALID_CREDENTIALS`, `403 ORIGIN_NOT_ALLOWED`, `503 SERVICE_UNAVAILABLE` | `Implemented in M2` |
| S13 | `POST` | `/api/auth/logout` | Cookie optional; idempotent same-origin write | None | `204`, session invalidated and cookie cleared | `403 ORIGIN_NOT_ALLOWED`, `503 SERVICE_UNAVAILABLE` | `Implemented in M2` |
| S13 | `GET` | `/api/auth/me` | Authenticated | None | `200 AuthResponse` | `401 AUTHENTICATION_REQUIRED`, `503 SERVICE_UNAVAILABLE` | `Implemented in M2` |
| S02, S04, S06 | `GET` | `/api/me/recommendations` | Authenticated | `page` 1-10000, `limit` 1-10, optional `genreId`, `catalogueRevision` | `200 RecommendationResponse`; whole-set mode/filter and page totals | `400 VALIDATION_ERROR`/`GENRE_NOT_FOUND`, `401 AUTHENTICATION_REQUIRED`, `409 CATALOGUE_CHANGED`, `503 CATALOGUE_UNAVAILABLE`/`SERVICE_UNAVAILABLE` | Sprint 3 route; post-M3 pagination amendment |
| S04 | `GET` | `/api/movies` | Public | `page` 1-10000, `limit` 1-10, optional `catalogueRevision`, `sort` = `title_asc` (default) or `title_desc` | `200 MovieListResponse`; all active movies in selected title order before paging | `400 VALIDATION_ERROR`, `409 CATALOGUE_CHANGED`, `503 CATALOGUE_UNAVAILABLE`/`SERVICE_UNAVAILABLE` | M2 route; post-M3 pagination and T01 title-sort amendments |
| S09 / T19 | `GET` | `/api/movies/popular` | Public | `page` 1-10000, `limit` 1-10, optional `catalogueRevision` | `200 MovieListResponse`; finite-popularity ranking across pages | `400 VALIDATION_ERROR`, `409 CATALOGUE_CHANGED`, `503 CATALOGUE_UNAVAILABLE`/`SERVICE_UNAVAILABLE` | Sprint 3 route; post-M3 pagination amendment |
| S03 | `GET` | `/api/movies/{movieId}` | Public | Opaque `movieId` | `200 MovieDetailResponse` | `404 MOVIE_NOT_FOUND`, `503 CATALOGUE_UNAVAILABLE`, `503 SERVICE_UNAVAILABLE` | `Implemented in M2` |
| S01 | `GET` | `/api/genres` | Authenticated | None | `200 GenreListResponse` | `401 AUTHENTICATION_REQUIRED`, `503 CATALOGUE_UNAVAILABLE`, `503 SERVICE_UNAVAILABLE` | `Implemented in Sprint 3 (S3-T01)` |
| S01 | `GET` | `/api/me/preferences` | Authenticated | None | `200 PreferenceResponse` | `401 AUTHENTICATION_REQUIRED`, `503 SERVICE_UNAVAILABLE` | `Implemented in Sprint 3 (S3-T01)` |
| S01 | `PUT` | `/api/me/preferences` | Authenticated, same-origin write | `PreferenceRequest` | `200 PreferenceResponse` after commit | `400 VALIDATION_ERROR`, `401 AUTHENTICATION_REQUIRED`, `403 ORIGIN_NOT_ALLOWED`, `404 GENRE_NOT_FOUND`, `503 SERVICE_UNAVAILABLE` | `Implemented in Sprint 3 (S3-T02)` |
| S05a | `GET` | `/api/me/ratings/{movieId}` | Authenticated | Opaque `movieId` | `200 RatingResponse` | `401 AUTHENTICATION_REQUIRED`, `404 MOVIE_NOT_FOUND`, `503 SERVICE_UNAVAILABLE` | `Implemented in Sprint 3 (S3-T31)` |
| S05a | `PUT` | `/api/me/ratings/{movieId}` | Authenticated, same-origin write | `RatingRequest` | `200 RatingResponse` after commit | `400 VALIDATION_ERROR`, `401 AUTHENTICATION_REQUIRED`, `403 ORIGIN_NOT_ALLOWED`, `404 MOVIE_NOT_FOUND`, `503 SERVICE_UNAVAILABLE` | `Implemented in Sprint 3 (S3-T31)` |
| S11 | `POST` | `/api/me/profile/reset` | Authenticated, same-origin write | `ProfileResetRequest` | `200 ProfileResetResponse` after commit | `400 VALIDATION_ERROR`, `401 AUTHENTICATION_REQUIRED`, `403 ORIGIN_NOT_ALLOWED`, `503 SERVICE_UNAVAILABLE` | `Implemented backend in Sprint 3 (S3-T35); UI pending` |

S3-T01 added the `user_genre_preferences` table and the two read routes
`GET /api/genres` and `GET /api/me/preferences`. S3-T02 implements validated,
atomic preference replacement through `PUT /api/me/preferences`. The dedicated
`GET /api/movies/popular` route is implemented in Sprint 3 under T19. T30 implements
rating storage, T31 [#138](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/138)
implements rating reads/writes, and T35
[#142](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/142)
implements the backend reset boundary. S3-T08 implements the genre/popularity
personalised recommendation baseline. The T15/T16 Sprint 3 current-list genre filter,
T33/T34 rating UI, and T26/T27/T37/T28 backdrop chain are also implemented.
Profile/reset UI, rating-adjusted ranking, similar movies, search, and NLP
product behaviour remain outside the delivered Sprint 3 boundary.


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
posterUrl: string | null
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
backdropUrl: string | null
posterUrl: string | null
```

The public movie `id` is the stable internal ID. A TMDb source ID is not part
of a public DTO. `backdropUrl` is a server-built HTTPS image URL from a
validated local TMDb path, or JSON `null` when absent or invalid. It appears
only on details. T01 adds `posterUrl` to summaries, recommendations and details:
either `https://image.tmdb.org/t/p/w500/<validated-filename>` or JSON `null`.
No raw `poster_path`, binary image, provider token or per-card detail fetch is
exposed. Only one flat jpg/jpeg/png/webp filename is allowed; arbitrary hosts,
queries and nested paths are rejected. Lists still rank/filter/page exactly as
before. See [reconciled T01 handoff](s4-t01-ui-contract.md).

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
rating: 0.5 | 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5 | null
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

## 6. Sprint 3 genres and account preferences

S3-T01 implements the account-owned preference migration and the read routes
`GET /api/genres` and `GET /api/me/preferences`. S3-T02 implements preference
replacement through `PUT /api/me/preferences`. S3-T08 implements the
personalised, cold-start, and no-match recommendation states described in
section 7.

Sprint 3 data-source decision (2026-10-06): development/staging/demo catalogue
must be imported from TMDb into SQLite and verified under T29/C04 in the
[runbook](tmdb-sprint3-runbook.md). This applies to genres, recommendations,
the public catalogue, the dedicated popular list, and details. Runtime
endpoints read the local active catalogue and never call TMDb API; account
preferences are stored by this application.
Public IDs/DTOs remain unchanged. Operator provenance uses database source IDs
and timestamps, not tokens or new public source-ID fields. Synthetic fixtures
and provider-boundary mocks remain the automated-test path; mandatory live
import/provenance smoke runs separately outside CI. Preference storage/reads
are implemented under T01, replacement under T02, and personalised
recommendation behaviour under T08.
The dedicated public popular movie route is implemented in Sprint 3 under T19. The existing
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

S3-T02 enforces strict integer items: strings, floats, booleans, and null are
not coerced into IDs. Extra body fields (including `userId`) are rejected.
Existence is checked against local canonical `genres`, not just the active
catalogue's selectable subset. Unknown IDs are rejected before deletion. The
server flushes all replacement rows and prepares the sorted response before
commit; a failed insert or commit rolls back deletion and insertion together.
It returns the prepared response only after commit succeeds, avoiding a new
database read after an already-successful write. Tests and reviewer steps are
in [T02 evidence](evidence/s3-t02-atomic-preferences.md).

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

## 7. Recommendation contract: Sprint 3 genre/popularity baseline

### `GET /api/me/recommendations?page=1&limit=10&genreId=28`

`page` defaults to 1 and accepts a positive integer through 10000. `limit`
defaults to 10 and accepts an integer from 1 through 10. Optional `genreId`
must be an integer from 1 through 2147483647 and an existing canonical genre ID;
an out-of-range ID returns `400 VALIDATION_ERROR`. A valid genre with no matches returns
a successful filtered-empty page. The account is
resolved only from the authenticated session.

The route reads the authenticated account's saved genres, current committed
ratings and the active local SQLite catalogue. It does not accept an account
identifier or call TMDb. S4-T03 extends only personalised ranking under section
13.1; the Sprint 3 cold-start/no-match popularity baseline is unchanged.

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
        "popularityScore": 90.0,
        "reason": {
          "matchedGenres": []
        }
      }
    ],
    "mode": "popular",
    "personalised": false,
    "noMatch": false
  },
  "meta": {
    "count": 1,
    "limit": 10,
    "page": 1,
    "total": 1,
    "totalPages": 1,
    "unfilteredTotal": 1,
    "catalogueRevision": "revision-example"
  }
}
```

An account without saved genres uses `mode=popular`, `personalised=false`, and
`noMatch=false`. A valid active catalogue with no usable popular movies returns
`200` with `movies: []`. No active catalogue returns
`503 CATALOGUE_UNAVAILABLE`.

Popular alternatives contain only movies with finite popularity, sorted by
popularity descending, title A-Z for ties, and internal movie ID as the final
deterministic tie.

### Personalised response

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
        "ratingAdjustment": 0,
        "adjustedScore": 90.0,
        "basis": "baseline",
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
    "page": 1,
    "total": 1,
    "totalPages": 1,
    "unfilteredTotal": 1,
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
response page contains at most ten distinct opaque movie IDs. The complete
eligible set is ranked and deduplicated before applying the optional view
genre and slicing into pages. `unfilteredTotal` counts the base mode before
the view filter; `total` counts after it. A zero view-filter total preserves
the base mode and does not trigger popular alternatives. Rating-adjusted
ranking was outside Sprint 3. S4-T03 now implements Story #22 / S05b's backend
ranking extension in section 13.1. Neutral/no rating preserves this baseline;
current committed non-neutral ratings may change personalised order.

Missing, expired, or revoked sessions return `401 AUTHENTICATION_REQUIRED`
before a private result is returned. Catalogue/database failures use the same
`503 CATALOGUE_UNAVAILABLE`/`503 SERVICE_UNAVAILABLE` distinction as the M2
route. The route never contacts TMDb during a request.

### Failure, valid empty results, and retry (S3-T09)

| Outcome | HTTP / code | Meaning |
|---|---|---|
| Active catalogue, successful reads, no usable movies | `200`, `data.movies=[]` | Valid empty success; preserve the state flags above. |
| No active catalogue revision | `503 CATALOGUE_UNAVAILABLE` | Catalogue setup/availability failure, not a no-match result. |
| Database query fails | `503 SERVICE_UNAVAILABLE` | Source failure, not cold-start, no-match, or empty success. |
| No valid session | `401 AUTHENTICATION_REQUIRED` | Authentication failure; do not treat it as a retryable empty catalogue. |

Errors use only the existing `error.code`, `error.message`, and `error.requestId`
envelope. Do not include a success `data` or `meta` object, raw SQL, account
details, provider credentials, or the underlying exception in the public error.
A zero-match fallback is allowed only after the matching query succeeds.

Recommendation reads do not clear, replace, or otherwise write either account's
saved preferences. Retrying while the source still fails returns another error.
After the source recovers, retrying the same endpoint, authenticated account,
and `limit` reads the current catalogue normally; no login or preference rewrite
is required while the session remains valid. If the catalogue, preferences and
committed ratings are unchanged, the successful body matches the pre-failure
body. Recovery does not promise an identical list if those inputs have changed.

T09 verifies this API boundary. T10 (#112) implements the typed client/cards,
T11 (#113) implements Error/Retry UI and stale-request protection, and T12
(#114) supplies integrated Story #18 acceptance evidence. Clients replace an
error only after a successful current-account response. Rating-adjusted ranking
is implemented under S4-T03 / Story #22 and does not change the envelope.

## 8. S03/S04 catalogue and S09/T19 popular movie reads

### Post-M3 shared pagination amendment (2026-10-19)

All three list routes accept `page` (default 1, integer 1-10000), `limit`
(default 10, integer 1-10) and an optional opaque `catalogueRevision`. Public
routes ignore account identity. A subsequent request supplying a revision that
no longer equals the active revision receives `409 CATALOGUE_CHANGED` in the
standard error envelope. The client clears old results and fetches page 1 of
the new revision. Recommendation requests also accept optional integer
`genreId` (integer 1 through 2147483647); an unknown ID returns
`400 GENRE_NOT_FOUND`, while an out-of-range ID returns `400 VALIDATION_ERROR`.

Each success `meta` contains `count` for the returned page, `page`, `limit`,
`total` after a view filter and before slicing, `totalPages=ceil(total/limit)`
(zero when total is zero), `unfilteredTotal` for the base mode before a view
filter, and `catalogueRevision`. Public routes have `unfilteredTotal=total`.
An out-of-range page is a `200` response with an empty `data.movies`, unchanged
mode, and accurate totals. For 255 eligible movies at limit 10, page 26 has 5
movies and page 27 has none while `totalPages` remains 26. The UI normalizes
that URL to page 26; zero-result URLs normalize to page 1. A list request only
reads local SQLite and never fetches TMDb metadata.

### `GET /api/movies?page=1&limit=10&sort=title_asc`

This is the implemented public catalogue endpoint for S04. `limit` defaults to
10 and accepts an integer from 1 through 10. Results read only the active local
catalogue; the endpoint never contacts TMDb. Every active movie is eligible,
including one without popularity. The optional `sort` is `title_asc` (default,
A–Z) or `title_desc` (Z–A); other values return `400 VALIDATION_ERROR`.
SQLite sorts the **complete active catalogue before LIMIT/OFFSET** by
`lower(title)`, then original title, both in the selected direction; the final
internal movie ID tie-breaker stays ascending in either direction.
Omitting `sort` retains the previous A–Z response. This Home-only option changes
neither the DTO/totals/revision checks nor Popular/recommendation ordering.

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
    "page": 1,
    "total": 2,
    "totalPages": 1,
    "unfilteredTotal": 2,
    "catalogueRevision": "revision-example"
  }
}
```

This alphabetical endpoint is separate from the finite-popularity ranking.

| Condition | Status/code | Public message |
|---|---|---|
| `limit` outside 1-10 or not an integer | `400 VALIDATION_ERROR` | `Please correct the highlighted fields` |
| No active catalogue | `503 CATALOGUE_UNAVAILABLE` | `Movie catalogue is unavailable` |
| Database read failure | `503 SERVICE_UNAVAILABLE` | `Service is temporarily unavailable` |

An empty active catalogue returns `200` with `movies: []`; the UI shows
guidance and never invents movies.

### `GET /api/movies/popular?page=1&limit=10` (Sprint 3 route, paginated post-M3)

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
    "page": 1,
    "total": 1,
    "totalPages": 1,
    "unfilteredTotal": 1,
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
      "voteCount": 1200,
      "backdropUrl": "https://image.tmdb.org/t/p/w780/example.jpg",
      "posterUrl": null
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
`Information unavailable` for that field. `backdropUrl` is either a server-built
allowlisted `https://image.tmdb.org/t/p/w780/<file>` URL or JSON `null`; raw
provider paths and tokens are never returned. Storage failure is never
translated to a false 404. Movie detail remains public; a guest opening it
does not cause the frontend to call a private rating endpoint.

## 9. Sprint 3 rating contract (implemented under S3-T31)

These two S05a routes are implemented under S3-T31
[#138](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/138).
Their session ownership and isolation rules support Story #45 / S13. A missing,
expired, or revoked session returns `401` before any private row is read or
written, and before the rating value is validated. The one exception is a
non-empty `application/json` body that is not syntactically valid JSON: it is
rejected with `400` during parsing, before the session is resolved, and still
reads and writes nothing.
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

`rating` is a strict JSON number from `0.5` through `5` in exact `0.5` steps
(including numeric whole values such as `4.0`). The server rejects `0`, `6`,
negatives, non-half-steps such as `3.25` or `3.500000000001`,
strings including `"5"`, booleans, `null`, a missing field, extra identity
fields, malformed JSON, and any malformed payload with
`400 VALIDATION_ERROR` / `Please correct the highlighted fields`. Rejection
does not replace a previously committed rating.

| Condition | Status/code | Public message and persistence rule |
|---|---|---|
| Missing, expired, revoked, or invalid session | `401 AUTHENTICATION_REQUIRED` | `Authentication required`; no private read/write |
| Browser write fails the existing same-origin policy | `403 ORIGIN_NOT_ALLOWED` | `Request origin is not allowed`; no mutation |
| Opaque movie ID is not in the active catalogue | `404 MOVIE_NOT_FOUND` | `Movie not found`; do not create a movie or orphan rating |
| Invalid JSON/body/rating value | `400 VALIDATION_ERROR` | `Please correct the highlighted fields`; preserve the prior committed rating. A wrong value with no valid session is `401`; a non-empty `application/json` body that is not valid JSON is `400` regardless of session |
| Read or commit fails | `503 SERVICE_UNAVAILABLE` | `Service is temporarily unavailable`; rollback and preserve the prior committed rating |

Neither route accepts `userId`, account ID, email, username, or owner ID. A
forged identity field cannot read, update, or retarget another account. The
database target is one row per `(user_id, movie_id)` with a numeric `0.5..5` / exact half-step check; the
storage contract is in [architecture.md](architecture.md).

## 10. Sprint 3 profile-reset backend contract (implemented under S3-T35)

### `POST /api/me/profile/reset`

This route implements the authenticated reset backend contract under S3-T35
[#142](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/142). It supports
Story #45 / S13 account isolation and does not claim completion of all Story
#33 / S11 profile UI behaviour.

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

FastAPI parses and validates the JSON body before the route resolves the
session. Therefore an invalid or unparsable confirmation body returns `400`
even if the request also lacks a valid session; it still performs no private
read or mutation. A syntactically valid `{ "confirm": true }` request without
a valid session returns `401`.

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
| `ORIGIN_NOT_ALLOWED` | 403 | A browser session, preference, rating, or profile-reset write failed the same-origin check. |
| `MOVIE_NOT_FOUND` | 404 | The internal movie ID does not exist in the active catalogue. |
| `GENRE_NOT_FOUND` | 404 | A requested genre ID does not exist. |
| `EMAIL_ALREADY_REGISTERED` | 409 | The normalized email is already stored. |
| `SERVICE_UNAVAILABLE` | 503 | Required persistence (account or catalogue) is unavailable. |
| `CATALOGUE_UNAVAILABLE` | 503 | No active catalogue is readable. |

`GENRE_NOT_FOUND` is returned by S3-T02 when any requested canonical genre does
not exist. Sprint 3 rating and reset validation deliberately
reuse `VALIDATION_ERROR`; this document does not invent rating/reset-specific
codes.

## 12. Scope boundary

The dedicated public popular movie endpoint (`GET /api/movies/popular`)
is implemented in Sprint 3 under T19, reusing the shared deterministic
popularity/title/ID ranker.

The preference storage and reads are implemented under S3-T01, preference
replacement under S3-T02, rating storage under S3-T30, rating reads/writes
under S3-T31, and the profile-reset backend under S3-T35. The account rating
widget and typed client are implemented under S3-T33 (#139) and independently
exercised under T34 (#141). The backdrop chain is complete in Sprint 3: T26
adds nullable storage, T27 maps/imports it and exposes the safe detail DTO,
T37 renders resilient UI, and T28/#131 verifies the storage-to-browser path.
Reset UI, personal-score presentation UI, and NLP endpoints remain separate work. The
backend reset evidence must not be used to close Story #33 / S11 UI acceptance.

The T33 widget checks the existing session on valid public movie details without
blocking public content. Guests do not issue private rating reads/writes, and a
rating action leads to `/login`. Authenticated GET/PUT requests include session
cookies and use opaque movie IDs; no account identifier is sent. Unrated is
`null`, draft selection is separate from the last confirmed committed value,
and save success appears only after a validated acknowledgement. Failed reads
and saves have separate retry actions. Account/movie changes or logout discard
private widget state and ignore old responses, including stale `401` errors.
The current protected `401` calls the central handler and navigates to login.
Saving a rating never writes preferences. Subsequent personalised recommendation
requests use the current committed rating under S4-T03; popular fallbacks retain
their original order.

Section 8 documents both the existing public catalogue endpoint and the
implemented dedicated popular movie endpoint.

Automated tests must use synthetic SQLite fixtures or provider mocks and run
offline without a TMDb token. Live TMDb catalogue import is a separate
server-side development/staging/Sprint 3 acceptance step; the token must never
appear in DTOs, frontend assets, logs, fixtures, or documentation evidence.

<a id="13-sprint-4-c03-implementation-contract-planned-not-delivered"></a>

## 13. Sprint 4 C03 implementation contract (delivery status below)

This section freezes the consumer contract for [#217](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/217).
It extends, rather than replaces, the Sprint 3 routes above. Feature owners
must update delivery status with their own tested evidence. All new endpoints
use the section 1 `{data}` success and `{error:{code,message,requestId}}`
failure envelopes, opaque internal movie IDs, and the active local SQLite
catalogue. A database fault is never a valid empty result. No endpoint invokes
the TMDb metadata API while serving a request.

| Owner | Method and route | Access | Success | Errors in addition to the established envelope |
|---|---|---|---|---|
| T02/T03 | `GET /api/me/recommendations` | Session | Existing paged DTO plus optional personal score fields below | Existing 400/401/409/503; rating read degradation is explicit |
| T06/T07/T08 | `GET /api/movies/{movieId}/similar` | Public | `{data:{movies: MovieSummaryDto[]}}`, at most five | 404 `MOVIE_NOT_FOUND`; 503 `INDEX_UNAVAILABLE`/`CATALOGUE_UNAVAILABLE`/`SERVICE_UNAVAILABLE` |
| T06/T09/T10 | `GET /api/movies/search?q=<text>` | Public | `{data:{movies: MovieSummaryDto[]}}`, at most ten | 400 `VALIDATION_ERROR`; 503 `INDEX_UNAVAILABLE`/`CATALOGUE_UNAVAILABLE`/`SERVICE_UNAVAILABLE` |
| T11/T12 | `GET /api/me/profile` | Session | Profile summary below | 401 `AUTHENTICATION_REQUIRED`; 503 `SERVICE_UNAVAILABLE` |
| T12 | `GET /api/me/watchlist?page=1&limit=10&catalogueRevision=<revision>` | Session | Paged watchlist below | 400/401/409 `CATALOGUE_CHANGED`/503 |
| T12 | `GET /api/me/watchlist/{movieId}` | Session | Membership status below | 401/404 `MOVIE_NOT_FOUND`/503 |
| T12 | `PUT /api/me/watchlist/{movieId}` | Session, same-origin write | 200 committed membership status | 401/403 `ORIGIN_NOT_ALLOWED`/404/503 |
| T12 | `DELETE /api/me/watchlist/{movieId}` | Session, same-origin write | 200 `{data:{movieId,inWatchlist:false}}` after commit | 401/403/404/503 |

Register the static `/api/movies/search` route **before**
`/api/movies/{movieId}`; the literal word `search` must not be interpreted
as a movie ID. The two existing rating routes and
`POST /api/me/profile/reset` keep their section 9/10 request, response, error,
authentication and transaction contracts. No duplicate ratings or reset API
is introduced. On writes the existing same-origin Fetch Metadata/`Origin`
middleware must also cover watchlist PUT/DELETE; requests cannot select a user
by body, query, header or path.

### 13.1 Recommendation score transparency

Backend delivery: S4-T03, verified with synthetic fixtures and an isolated real
SQLite database; [evidence](evidence/s4-t03-rating-ranking/README.md). The protected
personalised DTO requires `ratingAdjustment: integer`, `adjustedScore: number
| null`, and `basis: "rating_signals" | "baseline" | "rating_unavailable"`.
Popular recommendation entries omit all three fields. The public catalogue,
detail and shared Search/Similar movie DTOs remain unchanged.

Only `mode="personalised"` movie entries may add these fields; public
`MovieSummaryDto`, Popular, cold-start and no-match alternatives do not expose
private ranking or a synthetic `Your rating`:

```json
{
  "popularityScore": 80.0,
  "ratingAdjustment": 1,
  "adjustedScore": 81.0,
  "basis": "rating_signals",
  "reason": {"matchedGenres": [{"id": 28, "name": "Action"}]}
}
```

`popularityScore` is the raw TMDb value and never changes. For each
current-account rated movie that shares at least one canonical genre with an
eligible candidate, add exactly one sign: 1/2 → -1, 3 → 0, 4/5 → +1. The
candidate's own rating follows that same shared-genre rule; the account's
saved genres still select the eligible set. Updating a stored rating replaces its sign. A rated
movie with two shared genres contributes once. If raw popularity is finite,
`adjustedScore = popularityScore + ratingAdjustment`. Null popularity stays
null in both fields; it is never converted to zero. Finite adjusted scores rank
descending with title then internal ID ties; null-score candidates remain
after finite candidates in title/ID order. This preserves the current ranking
when adjustment is zero. Rank/deduplicate the full eligible set, then apply
the view genre to that base set, then slice pages of at most ten. Existing
`meta.count/total/unfilteredTotal/totalPages/catalogueRevision` and mode
selection retain their section 7/8 meaning.

`basis` is `rating_signals` only when a successful rating read supplies a
nonzero adjustment, `baseline` when it successfully supplies no effective
signal, and `rating_unavailable` only when a rating-only read fails while
catalogue/preferences remain safely readable. In that degraded state every
adjustment is 0, finite `adjustedScore` equals raw popularity, and the UI
states that personal rating signals are temporarily unavailable. It must not
claim an account has no ratings. A failed core catalogue/preference read
remains its actual 503; a bad session remains 401. `Your rating` is read
separately from `GET /api/me/ratings/{movieId}`; a related movie's signal
never manufactures a saved rating on the candidate.

Deterministic oracle: Action/Comedy candidates A and B each have raw 80.
With one +1 related rating for A, A=81 and B=80; with one -1 related rating
for A, A=79 and B=80. Both still display raw popularity 80; title/ID breaks
equal adjusted scores. Neutral/no signal keeps the Sprint 3 order. Public
Popular and both popular recommendation fallbacks keep raw finite-popularity
ordering and no personal fields.

Implementation reads the full genre-eligible set and its canonical genres
before the optional rating query, computes each score once in the shared
ranker, sorts, applies the view filter, and finally slices the requested page.
Only a database exception from that rating query degrades to baseline; no core
read or session validation is inside the fallback catch. No personal ranking
cache is retained: reset, logout and account switch are observed through the
existing authenticated-session ownership model on the next request. Query,
header or body identity hints cannot retarget ranking to another account.

### 13.2 Shared NLP search and similar reads

The versioned overview index and source/candidate mapping are owned by T06;
see [architecture.md](architecture.md#9-sprint-4-c03-runtime-and-storage-contract-planned).
`INDEX_UNAVAILABLE` means the shared index is absent, stale for the active
catalogue text/config revision, corrupt, or cannot be read. A changed overview
for the same `catalogueRevision` changes the corpus digest and makes the
index stale; a poster/backdrop-only update does not. It is not equivalent to
a movie with missing overview. An explicit empty-vocabulary, successfully
built index is ready and yields zero cosine scores.
Its public message is `Search index is temporarily unavailable`; it keeps
the standard generated `requestId` and exposes no artifact path or stack
trace.

`GET /api/movies/{movieId}/similar` first checks the source exists in the
active catalogue (404 otherwise). Candidates must share at least one genre,
exclude the source, and be unique. With a usable source vector, candidates
with usable vectors sort by cosine descending, finite popularity descending,
title ascending, ID ascending; cosine zero remains usable. Missing-text
candidates follow, ordered by popularity/title/ID. If the source has no usable
vector, all eligible candidates use the shared popularity/title/ID fallback.
Return at most five; no eligible candidates is `200 {data:{movies:[]}}`.
A failed index is 503 even if a source overview is absent.

T07 backend delivery ([#202](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/202)):
the route is public and read-only, returns `{data:{movies: MovieSummaryDto[]}}`
with no `meta`, and never calls TMDb or reads an account's genres or ratings.
The order of checks is: no active catalogue is 503 `CATALOGUE_UNAVAILABLE`; an
unknown or inactive-revision source is 404 `MOVIE_NOT_FOUND`; then
`load_active_index` runs before any ranking, so an absent, stale or corrupt
artifact is 503 `INDEX_UNAVAILABLE` and is never read as a missing overview.
Candidates come from `list_genre_matched_movies` over the source's genres and
are ranked by `rank_similar_movies` in
`backend/app/recommendations/similar.py`; the source is excluded and IDs are
de-duplicated before ranking. A source or candidate ID absent from the loaded
index mapping is also `INDEX_UNAVAILABLE`. Cosine, popularity, title and ID
ties use the shared `score_title_id_ordering` comparator. Focused synthetic
API/DB checks are in `backend/tests/test_similar_movies_api.py`. T08 adds the
public Similar movies section to `/movies/:movieId` through the shared typed
movies client. It keeps the server's order and at most five distinct movies
other than the source, never reads the account or rating APIs, and carries the
safe detail-return context to the selected movie. Its loading, empty, error and
Retry states leave the source details visible. The five Story #24 criteria and
their browser results are recorded in
[T08 acceptance evidence](evidence/s4-t08-similar-ui/README.md).

`GET /api/movies/search?q=<text>` trims the query and requires at least two
Unicode characters after trimming. Title search is a literal,
case-insensitive substring: escape SQL `%`, `_` and the escape character;
never interpret the query as a pattern. Any title matches take precedence;
sort them by title then ID and return at most ten. Only with zero title
matches does the shared index transform the query and return strictly
positive-cosine overview matches by cosine descending, title then ID.
Zero cosine and unrelated popular films are excluded. No match is
`200 {data:{movies:[]}}` and the UI displays `No movies found`.
The text route must distinguish 503 index failure from this valid empty result.
For the title-only branch, a usable local catalogue can answer without an
index; the description branch requires a ready index.

T09 backend delivery: `GET /api/movies/search?q=<text>` is public and returns
`{data:{movies: MovieSummaryDto[]}}` with no paging metadata. It trims `q`;
missing or fewer than two characters returns 400 `VALIDATION_ERROR` with
`Enter at least 2 characters`. It first searches active-catalogue titles via
literal escaped SQL LIKE with Unicode casefolding, ordered by folded title and
opaque ID, and
caps the result at ten. A title hit does not load the text index. Only
when there are no title hits does it load the shared fitted index and return
positive-cosine overview matches ordered by score, normalized title and ID.
An empty or zero-score corpus returns an empty movie list. An absent, stale or
corrupt artifact returns 503 `INDEX_UNAVAILABLE`; unavailable catalogue and
database faults retain their separate 503 errors. Focused synthetic API/DB
checks are in `backend/tests/test_movie_search_api.py`. T10 adds public `/search`
through the shared typed movies client, retaining API order, a ten-card cap,
URL-backed submitted queries, cancellation/stale-response guards and safe detail return.
Typing edits only a local draft; Enter/Search triggers a request. Valid direct
`q` links load immediately. This submit-only amendment retains title-first
ranking and positive-cosine fallback without changing the endpoint.
Its five Story #30 criteria and browser results are recorded in
[T10 acceptance evidence](evidence/s4-t10-search/README.md).

Named deterministic fixtures: a `ZEBRA` query finds the title
`Zebra Case` before any overview fallback; `astronaut rescue moon` with
no title hit gives positive cosine for `Moon Rescue` ahead of
`City Robot`; an unrelated `volcano jazz galaxy` query yields no
positive result. Keep the positive relative-order fixture separate from
the all-zero exclusion fixture. For Similar, usable text with cosine 0
still precedes a missing-text candidate, and a missing source vector
triggers the full popularity fallback.

### 13.3 Poster media on existing DTOs

T01 adds `posterUrl: string | null` to `MovieSummaryDto` and
`MovieDetailDto` and a nullable local `poster_path` column. The server
builds an HTTPS `image.tmdb.org/t/p/w500/<validated file>` URL from that
path; it never sends the raw path, token, or arbitrary provider URL. Null,
invalid path and failed image load all render the same accessible poster
fallback, while title, overview and existing `backdropUrl` remain available.
The importer stores the path without altering stable IDs or a valid active
catalogue on failed import. A public response never gains rating or
watchlist membership as a side effect of media work.

### 13.4 Profile and watchlist

**S4-T12 implementation status (2026-10-25):** the profile summary and all four
watchlist routes below are implemented on the local SQLite catalogue. The reset
route keeps the section 10 request/response contract. Watchlist PUT and DELETE
use the same SQLite writer reservation as reset/rating/preference writes and
acknowledge only after commit. An unexpected query parameter, duplicate query
key, account-selector header, or write body on the new watchlist routes returns
`400 VALIDATION_ERROR` without mutation. Browser writes also require same
origin. API consumers reread membership after a lost write response before
displaying a saved/removed state.

`GET /api/me/profile` returns only the session account and committed
summary, for example:

```json
{"data":{"genres":[{"id":28,"name":"Action"}],"ratingCount":2,"watchlistCount":1}}
```

Counts are nonnegative integers for current rows. This read does not mutate
preferences, ratings or watchlist. The UI uses the existing
`POST /api/me/profile/reset` confirmation contract. Cancel sends no request.
Show `Your personalisation profile was reset` only after a known committed
`200 {data:{reset:true}}`. An ambiguous timeout triggers fresh profile,
preferences and rating reads; it does not automatically repeat reset or show
success/failure as certain. Writes committed before reset are cleared;
deliberate later writes are retained by transaction order. Reset never
deletes watchlist memberships.

The T11 writer-reservation amendment retains the existing reset request
`{confirm:true}`, response `{data:{reset:true}}`, auth/origin checks and safe
error envelope. Reset, preference PUT and rating PUT reserve the SQLite
writer with `BEGIN IMMEDIATE` before session/decision reads and acknowledge
only after commit. A busy writer or persistence failure returns the existing
`503 SERVICE_UNAVAILABLE`; no automatic mutation replay or new message field
is introduced. GET routes remain read-only. The exact transaction and
rollback handoff is in [architecture.md](architecture.md#91-rating-reads-transactions-and-reset-order).

Watchlist uses one row per `(user_id,movie_id)` with immutable `addedAt`
set by the first successful PUT. Repeated PUT is 200 and returns the original
time for that membership. After DELETE, a later PUT creates a new membership
with a new time. Repeated DELETE for an active nonmember is 200 with the same
absence acknowledgement; neither DELETE response includes an `addedAt`.
GET/PUT membership status:

```json
{"data":{"movieId":"opaque-internal-id","inWatchlist":true,"addedAt":"2026-10-24T09:00:00Z"}}
```

DELETE success, including a repeated DELETE for a known active movie:

```json
{"data":{"movieId":"opaque-internal-id","inWatchlist":false}}
```

An active movie outside the watchlist has `inWatchlist:false,addedAt:null`
on GET; unknown
active-catalogue ID is 404. `WatchlistMovieDto` is exactly
`MovieSummaryDto` plus `addedAt: UTC ISO-8601 string`.
`GET /api/me/watchlist` returns
`{data:{movies:WatchlistMovieDto[]},meta:{count,limit,page,total,totalPages,unfilteredTotal,catalogueRevision}}`.
It sorts membership by `addedAt` descending, then internal movie ID
ascending, before slicing. Default page/limit are 1/10; valid bounds are
page 1–10000 and limit 1–10, matching section 8. Out-of-range pages are 200
empty with correct totals; `catalogueRevision` mismatch is
`409 CATALOGUE_CHANGED`. Membership does not change Popular, personalised
ranking, or raw popularity. Only active catalogue movie IDs are addressable;
membership for stable IDs survives catalogue refresh, while removal of a
movie follows its database foreign-key lifecycle. See the storage ownership
and ordering contract in [architecture.md](architecture.md#9-sprint-4-c03-runtime-and-storage-contract-planned).

### 13.5 Sprint 4 authentication navigation amendment

The backend auth DTO/cookie/error contract in section 5 is unchanged. Its
Sprint 3 statement that a normal login opens `/recommendations` is
historical UI behaviour; the Sprint 4 T01 handoff supersedes that navigation
once its UI is integrated. A normal successful login from Home or directly
from `/login` opens Home `/` with authenticated navigation and does not
automatically open, save or change preferences/recommendations. Start and
Preferences are explicit actions. A guest selecting Start reaches
`/preferences` through sign-in or registration and returns there after
successful login. The sole exception to Home landing is an explicit,
validated internal protected-route return destination; an absent, external
or unsafe destination falls back to Home. The single navbar
`My recommendations` link opens the existing recommendation flow, including
its cold-start state when no genres are saved.

The corresponding first S13 acceptance criterion is replaced locally in
[requirements.md](requirements.md#s13-sign-in-and-sign-out-securely-p0-5-points).
The GitHub Story #45 AC must be reconciled before merge so the old
`always /recommendations` and new Home outcomes are not both accepted.

### S4-T16 half-star consumer amendment

Rating DTO numeric values now include the five half steps. Ownership, commit,
401 handling, rollback, explicit Save and recommendation invalidation remain
unchanged. Schema head `f2c7e4a91b60` stores REAL ratings while preserving IDs
and timestamps. Existing <=2 / >=4 signal boundaries and integer
`ratingAdjustment` remain unchanged; raw TMDb popularity is never a user rating.
