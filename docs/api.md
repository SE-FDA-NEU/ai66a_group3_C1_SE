# M2 HTTP API contract

Contract revision: `M2-CURRENT`.

This document inventories the implemented M2 HTTP boundary and clearly
separates Sprint 3 targets from runtime evidence. A planned endpoint is not an
availability claim.

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
- Protected endpoints derive the account only from the authenticated session.
  A client-supplied `user_id` cannot select an account.
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
in the repository. `Planned for later sprint` is a reviewed target only and is
not an availability claim.

| Story | Method | Endpoint | Access | Input | Success | Representative errors | Delivery status |
|---|---|---|---|---|---|---|---|
| Infrastructure | `GET` | `/health` | Public | None | `200` health and database/migration state | `503 SERVICE_UNAVAILABLE` | `Implemented in M2` |
| S12 | `POST` | `/api/auth/register` | Public | `RegisterRequest` | `201 RegisterResponse` | `400 VALIDATION_ERROR`, `409 EMAIL_ALREADY_REGISTERED` | `Implemented in M2` |
| S13 | `POST` | `/api/auth/login` | Public, same-origin write | `LoginRequest` | `200 AuthResponse` and opaque cookie | `400 VALIDATION_ERROR`, `401 INVALID_CREDENTIALS`, `403 ORIGIN_NOT_ALLOWED` | `Implemented in M2` |
| S13 | `POST` | `/api/auth/logout` | Cookie optional; idempotent same-origin write | None | `204`, session invalidated and cookie cleared | `403 ORIGIN_NOT_ALLOWED`, `503 SERVICE_UNAVAILABLE` | `Implemented in M2` |
| S13 | `GET` | `/api/auth/me` | Authenticated | None | `200 AuthResponse` | `401 AUTHENTICATION_REQUIRED`, `503 SERVICE_UNAVAILABLE` | `Implemented in M2` |
| S02, S04 | `GET` | `/api/me/recommendations?limit=10` | Authenticated | Optional integer `limit`, 1-10 | `200 RecommendationResponse` with popular/cold-start results | `400 VALIDATION_ERROR`, `401 AUTHENTICATION_REQUIRED`, `503 CATALOGUE_UNAVAILABLE` | `Implemented in M2` |
| S04 | `GET` | `/api/movies?limit=10` | Public | Optional integer `limit`, 1-10, default 10 | `200 MovieListResponse` | `400 VALIDATION_ERROR`, `503 CATALOGUE_UNAVAILABLE`, `503 SERVICE_UNAVAILABLE` | `Implemented in M2` |
| S03 | `GET` | `/api/movies/{movieId}` | Public | Opaque `movieId` | `200 MovieDetailResponse` | `404 MOVIE_NOT_FOUND`, `503 CATALOGUE_UNAVAILABLE`, `503 SERVICE_UNAVAILABLE` | `Implemented in M2` |

Preferences, ratings, personalized ranking, genre filtering, similar movies,
search, and profile reset are Sprint 3 targets. They are not implemented in
the current router or migrations.

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

## 6. Planned Sprint 3: genres and account preferences

The following endpoints are planned only. No current backend route or
migration provides them, so they are not M2 completion evidence.

### `GET /api/genres`

Returns the active catalogue's available genres:

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

The list must contain 1-5 distinct, existing genre IDs. The server replaces
only the authenticated account's preference rows in one transaction and
returns the `PreferenceResponse` above.

| Condition | Status/code | Public message |
|---|---|---|
| Empty, duplicate, or more than five IDs | `400 INVALID_GENRE_SELECTION` | `Select 1 to 5 distinct genres` |
| Any genre does not exist | `404 GENRE_NOT_FOUND` | `Genre not found` |
| Missing or invalid session | `401 AUTHENTICATION_REQUIRED` | `Authentication required` |
| Transaction unavailable | `503 SERVICE_UNAVAILABLE` | `Service is temporarily unavailable` |

No request or response accepts a `userId` field.

## 7. M2 popular/cold-start recommendations

### `GET /api/me/recommendations?limit=10`

`limit` defaults to 10 and accepts an integer from 1 through 10. The account is
resolved only from the authenticated session.

The route is implemented, but it currently returns the shared popular
catalogue ordering for every authenticated account. It does not read saved
preferences or ratings and is not personalized.

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

Popular alternatives sort by finite popularity descending, null popularity
last, title A-Z for ties, and internal movie ID as the final deterministic tie.

## 8. S03/S04 movie catalogue

### `GET /api/movies?limit=10`

`limit` defaults to 10 and accepts an integer from 1 through 10. Results are
public and read only the active local catalogue; the endpoint never contacts
TMDb.

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

Sort order is finite popularity descending, null popularity last, title A-Z
for ties, and internal movie ID as the final deterministic tie-breaker.

| Condition | Status/code | Public message |
|---|---|---|
| `limit` outside 1-10 or not an integer | `400 VALIDATION_ERROR` | `Please correct the highlighted fields` |
| No active catalogue | `503 CATALOGUE_UNAVAILABLE` | `Movie catalogue is unavailable` |
| Database read failure | `503 SERVICE_UNAVAILABLE` | `Service is temporarily unavailable` |

An empty active catalogue returns `200` with `movies: []`; the UI shows
guidance and never invents movies.

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
| Database read failure | `503 SERVICE_UNAVAILABLE` | `Service is temporarily unavailable` |

A missing year or overview remains JSON `null`; the UI displays
`Information unavailable` for that field. Storage failure is never translated
to a false 404.

## 9. Error code registry

| Code | HTTP status | Meaning |
|---|---:|---|
| `VALIDATION_ERROR` | 400 | Request fields or query values are invalid. |
| `INVALID_GENRE_SELECTION` | 400 | The preference set is not 1-5 distinct genres. |
| `AUTHENTICATION_REQUIRED` | 401 | A protected route has no valid session. |
| `INVALID_CREDENTIALS` | 401 | Login credentials are invalid without revealing which field failed. |
| `ORIGIN_NOT_ALLOWED` | 403 | A browser session write failed the same-origin check. |
| `MOVIE_NOT_FOUND` | 404 | The internal movie ID does not exist in the active catalogue. |
| `GENRE_NOT_FOUND` | 404 | A requested genre ID does not exist. |
| `EMAIL_ALREADY_REGISTERED` | 409 | The normalized email is already stored. |
| `SERVICE_UNAVAILABLE` | 503 | Required persistence (account or catalogue) is unavailable. |
| `CATALOGUE_UNAVAILABLE` | 503 | No active catalogue is readable. |

## 10. Scope boundary

This contract contains no implemented preferences, ratings, personalized
recommendation, or NLP endpoint. Those are Planned Sprint 3 work and are not
M2 completion criteria.
