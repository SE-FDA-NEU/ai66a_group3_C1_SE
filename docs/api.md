# P0 HTTP API contract

Contract revision: `C03-DRAFT-2`.

This document inventories the HTTP boundary needed by the six P0 Stories:
S01, S02, S03, S04, S12, and S13. It separates runtime evidence from planned
contracts so a future endpoint is never presented as already running.

The account storage and S2-T07 authentication routes are implemented in the
backend. Other P0 routes remain target contracts until their route, service,
persistence, and tests are merged.

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
| Infrastructure | `GET` | `/health` | Public | None | `200` health and database/migration state | Unhandled database failure currently produces framework `500` | `Implemented in M2` |
| S12 | `POST` | `/api/auth/register` | Public | `RegisterRequest` | `201 RegisterResponse` | `400 VALIDATION_ERROR`, `409 EMAIL_ALREADY_REGISTERED` | `Planned for later sprint` |
| S13 | `POST` | `/api/auth/login` | Public | `LoginRequest` | `200 AuthResponse` and opaque cookie | `400 VALIDATION_ERROR`, `401 INVALID_CREDENTIALS` | `Implemented in M2` |
| S13 | `POST` | `/api/auth/logout` | Cookie optional; idempotent | None | `204`, session invalidated and cookie cleared | `500 INTERNAL_ERROR`, `503 SERVICE_UNAVAILABLE` | `Implemented in M2` |
| S13 | `GET` | `/api/auth/me` | Authenticated | None | `200 AuthResponse` | `401 AUTHENTICATION_REQUIRED`, `503 SERVICE_UNAVAILABLE` | `Implemented in M2` |
| S01 | `GET` | `/api/genres` | Authenticated | None | `200 GenreListResponse` | `401 AUTHENTICATION_REQUIRED`, `503 CATALOGUE_UNAVAILABLE` | `Planned for later sprint` |
| S01 | `GET` | `/api/me/preferences` | Authenticated | None | `200 PreferenceResponse` | `401 AUTHENTICATION_REQUIRED`, `503 SERVICE_UNAVAILABLE` | `Planned for later sprint` |
| S01 | `PUT` | `/api/me/preferences` | Authenticated | `SavePreferencesRequest` | `200 PreferenceResponse` | `400 INVALID_GENRE_SELECTION`, `401 AUTHENTICATION_REQUIRED`, `404 GENRE_NOT_FOUND` | `Planned for later sprint` |
| S02, S04 | `GET` | `/api/me/recommendations?limit=10` | Authenticated | Optional integer `limit`, 1-10 | `200 RecommendationResponse` | `400 VALIDATION_ERROR`, `401 AUTHENTICATION_REQUIRED`, `503 CATALOGUE_UNAVAILABLE` | `Planned for later sprint` |
| S03 | `GET` | `/api/movies/{movieId}` | Public | Opaque `movieId` | `200 MovieDetailResponse` | `404 MOVIE_NOT_FOUND`, `503 CATALOGUE_UNAVAILABLE` | `Planned for later sprint` |

Public popular browsing (`GET /api/movies`), rating mutation, rating-informed
ranking, genre filtering, similar movies, search, and profile reset are not P0
endpoint requirements in this revision. They must be added with their owning
Story and marked planned until code is merged.

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

## 6. S01 genres and account preferences

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

## 7. S02 and S04 recommendations

### `GET /api/me/recommendations?limit=10`

`limit` defaults to 10 and accepts an integer from 1 through 10. The account is
resolved only from the authenticated session.

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
          "code": "GENRE_MATCH",
          "matchedGenres": [
            { "id": 28, "name": "Action" }
          ]
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

The values are schema examples, not evidence of an import or live endpoint.

Behaviour by account state:

| State | Result |
|---|---|
| 1-5 saved genres and matches exist | Up to 10 distinct movies sharing at least one selected genre; `mode=personalised`, `personalised=true`, `noMatch=false`; every item names at least one matching genre. |
| Saved genres but no match exists | No-match state plus up to 10 popular alternatives; `mode=popular`, `personalised=false`, `noMatch=true`. |
| No saved genres | Up to 10 popular movies; `mode=popular`, `personalised=false`, `noMatch=false`, with guidance to enter preferences. |
| Valid active catalogue has no usable movies | `200` with `movies: []`; the UI shows guidance and never invents movies. |
| No active catalogue or database unavailable | `503 CATALOGUE_UNAVAILABLE`; saved preferences remain unchanged. |

Popular alternatives sort by finite popularity descending, null popularity
last, title A-Z for ties, and internal movie ID as the final deterministic tie.

## 8. S03 movie details

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
| No active catalogue or database unavailable | `503 CATALOGUE_UNAVAILABLE` | `Movie catalogue is unavailable` |
| Unexpected server failure | `500 INTERNAL_ERROR` | `Something went wrong` |

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
| `MOVIE_NOT_FOUND` | 404 | The internal movie ID does not exist in the active catalogue. |
| `GENRE_NOT_FOUND` | 404 | A requested genre ID does not exist. |
| `EMAIL_ALREADY_REGISTERED` | 409 | The normalized email is already stored. |
| `INTERNAL_ERROR` | 500 | An unexpected failure occurred. |
| `SERVICE_UNAVAILABLE` | 503 | Required account persistence is unavailable. |
| `CATALOGUE_UNAVAILABLE` | 503 | No active catalogue is readable. |

## 10. Scope boundary

This contract contains no NLP endpoint, DTO, preprocessing rule, or text
similarity contract. The NLP Spike is independent and is not a gate for C03.
