# M2 auth and movie HTTP contract

Contract revision: `C03-DRAFT-1`.

This document defines the DTO and error boundary required by
[#69](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/69), the auth tasks
[#52](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/52) and
[#54](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/54), and the movie
API task [#60](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/60).
Architecture and persistence policies are in [architecture.md](architecture.md).

This is a local draft until an independent review and merge occur. It does not
claim the endpoints are already implemented.

## 1. Conventions

- Base path: `/api`.
- JSON field names use `camelCase`.
- Success bodies use `{ "data": ... }`; list metadata uses `meta`.
- Error bodies use the stable error envelope below.
- IDs are opaque strings. Clients cannot derive a provider or account identity
  from an ID.
- Nullable source fields are returned as JSON `null`. The UI, not the API,
  renders `Information unavailable` for a missing year or overview.
- Authentication uses the same-origin `ams_session` cookie. There is no browser
  bearer-token or local-storage token contract.
- A protected endpoint obtains `user_id` only from the authenticated cookie and
  server-side session. Client-supplied `user_id` is rejected or ignored and
  never selects the account being read or changed.
- Passwords, password hashes, cookie values, session digests, and TMDb
  credentials never appear in response DTOs.

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

Field validation may add a safe `fields` object. It must not echo a password or
server implementation detail.

## 2. Complete endpoint table

| Method | Endpoint | Access | Input | Success output | Errors |
|---|---|---|---|---|---|
| `POST` | `/api/auth/register` | Public | `RegisterRequest` JSON | `201 RegisterResponse`; UI opens `/login` | `400 VALIDATION_ERROR`, `409 EMAIL_ALREADY_REGISTERED`, `500 INTERNAL_ERROR`, `503 SERVICE_UNAVAILABLE` |
| `POST` | `/api/auth/login` | Public | `LoginRequest` JSON | `200 AuthResponse` plus opaque cookie; UI opens `/recommendations` | `400 VALIDATION_ERROR`, `401 INVALID_CREDENTIALS`, `500 INTERNAL_ERROR`, `503 SERVICE_UNAVAILABLE` |
| `POST` | `/api/auth/logout` | Cookie optional; idempotent | No DTO fields | `204`, session invalidated if present, cookie cleared; UI opens `/` | `500 INTERNAL_ERROR`, `503 SERVICE_UNAVAILABLE` |
| `GET` | `/api/auth/me` | Authenticated cookie | No body/query | `200 AuthResponse` | `401 AUTHENTICATION_REQUIRED`, `500 INTERNAL_ERROR`, `503 SERVICE_UNAVAILABLE` |
| `GET` | `/api/movies` | Public | Optional integer query `limit`, default 10, range 1-10 | `200 MovieListResponse` from local DB | `400 VALIDATION_ERROR`, `500 INTERNAL_ERROR`, `503 CATALOGUE_UNAVAILABLE` |
| `GET` | `/api/movies/{movieId}` | Public | Non-empty opaque `movieId` path value | `200 MovieDetailResponse` from local DB | `404 MOVIE_NOT_FOUND`, `500 INTERNAL_ERROR`, `503 CATALOGUE_UNAVAILABLE` |

All runtime movie endpoints read the local database. They do not call TMDb.

## 3. Shared DTOs

### `UserDto`

```text
id: string
email: string
```

`email` is the normalized stored email. `UserDto` never includes `password`,
`passwordHash`, a cookie, or a session identifier.

Example:

```json
{
  "id": "8de52c49-54e0-4ad4-a39b-fc48db128330",
  "email": "viewer@example.com"
}
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

The movie `id` is the stable internal ID. A TMDb `sourceId` is intentionally not
part of these public DTOs.

## 4. Register

### `POST /api/auth/register`

`RegisterRequest`:

```json
{
  "email": "USER@example.com",
  "password": "movie123"
}
```

The server normalizes the email before validation/insertion and hashes the
password. It does not create a session.

`201 RegisterResponse`:

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

The UI opens `/login` only after the 201 response.

| Condition | Status/code | Public message |
|---|---|---|
| Invalid email or password shorter than 8 characters | `400 VALIDATION_ERROR` | `Please correct the highlighted fields` |
| Normalized email already exists | `409 EMAIL_ALREADY_REGISTERED` | `This email is already registered` |
| Persistence unavailable | `503 SERVICE_UNAVAILABLE` | `Service is temporarily unavailable` |
| Unexpected server failure | `500 INTERNAL_ERROR` | `Something went wrong` |

`This email is already registered` is exact Story copy from #44. Its
capitalization and wording must not change without updating the Story and this
contract together.

## 5. Login

### `POST /api/auth/login`

`LoginRequest`:

```json
{
  "email": "viewer@example.com",
  "password": "movie123"
}
```

`200 AuthResponse`:

```json
{
  "data": {
    "user": {
      "id": "8de52c49-54e0-4ad4-a39b-fc48db128330",
      "email": "viewer@example.com"
    }
  }
}
```

The response also sets an opaque cookie:

```http
Set-Cookie: ams_session=<opaque-random-value>; Path=/; HttpOnly; Secure; SameSite=Lax
```

`Secure` may be disabled only in the documented localhost development profile.
The UI stores no token and opens `/recommendations` after the 200 response.

| Condition | Status/code | Public message |
|---|---|---|
| Required input missing | `400 VALIDATION_ERROR` | `Email and password are required` |
| Unknown normalized email or wrong password | `401 INVALID_CREDENTIALS` | `Email or password is incorrect` |
| Persistence unavailable | `503 SERVICE_UNAVAILABLE` | `Service is temporarily unavailable` |
| Unexpected server failure | `500 INTERNAL_ERROR` | `Something went wrong` |

Unknown email and wrong password must produce the same status, code, message,
and response shape. `Email or password is incorrect` is exact Story copy from
#45.

## 6. Logout

### `POST /api/auth/logout`

The request has no body fields. If a valid cookie exists, the server invalidates
that session and clears the cookie. A missing, expired, or already invalidated
cookie produces the same idempotent client result.

Success: `204 No Content`, no JSON body. The UI clears account-scoped state and
opens `/`. Reusing the revoked cookie cannot authenticate `/api/auth/me`.

If persistence prevents revocation of an otherwise valid session, the server
returns `503 SERVICE_UNAVAILABLE` instead of falsely reporting success.

## 7. Current account

### `GET /api/auth/me`

The request contains no `user_id`. The server resolves the user only from the
authenticated cookie.

`200 AuthResponse` uses the same safe response shape as login.

Missing, expired, invalid, or revoked session:

```json
{
  "error": {
    "code": "AUTHENTICATION_REQUIRED",
    "message": "Authentication required",
    "requestId": "req_example"
  }
}
```

The response status is `401`. A protected UI route clears stale account state
and opens `/login`; it does not automatically replay a failed write.

## 8. Movie list

### `GET /api/movies?limit=10`

`limit` is optional, defaults to 10, and accepts an integer from 1 through 10.
The endpoint reads active records from the last valid local catalogue snapshot.
It sorts finite popularity descending, null popularity last, title A-Z for a
tie, and internal ID for a final deterministic tie.

`200 MovieListResponse`:

```json
{
  "data": {
    "movies": [
      {
        "id": "3ef5aa47-3ec6-41c8-9337-f5059d257988",
        "title": "Example Movie",
        "releaseYear": 2025,
        "genres": [
          {
            "id": 28,
            "name": "Action"
          }
        ],
        "popularityScore": 90.0
      }
    ]
  },
  "meta": {
    "count": 1,
    "limit": 10,
    "catalogueRevision": "import-example"
  }
}
```

The values above are schema examples, not evidence of a real imported movie or
import run.

| Condition | Status/code | Public message |
|---|---|---|
| Invalid `limit` | `400 VALIDATION_ERROR` | `limit must be an integer from 1 to 10` |
| No valid local snapshot or database unavailable | `503 CATALOGUE_UNAVAILABLE` | `Movie catalogue is unavailable` |
| Unexpected server failure | `500 INTERNAL_ERROR` | `Something went wrong` |

A valid but empty local catalogue result is `200` with `movies: []`; it is not a
provider call and must not be filled with synthetic test data.

## 9. Movie detail

### `GET /api/movies/{movieId}`

`movieId` is one opaque internal string used in a parameterized database lookup.
It is not interpreted as a TMDb ID.

`200 MovieDetailResponse`:

```json
{
  "data": {
    "movie": {
      "id": "3ef5aa47-3ec6-41c8-9337-f5059d257988",
      "title": "Example Movie",
      "releaseYear": null,
      "genres": [
        {
          "id": 28,
          "name": "Action"
        }
      ],
      "overview": null,
      "popularityScore": 90.0,
      "voteAverage": 7.2,
      "voteCount": 1200
    }
  },
  "meta": {
    "catalogueRevision": "import-example"
  }
}
```

The values are schema examples only. A null year or overview remains null in
the API; the UI displays `Information unavailable` for that field.

| Condition | Status/code | Public message |
|---|---|---|
| Internal movie ID not found | `404 MOVIE_NOT_FOUND` | `Movie not found` |
| No valid local snapshot or database unavailable | `503 CATALOGUE_UNAVAILABLE` | `Movie catalogue is unavailable` |
| Unexpected server failure | `500 INTERNAL_ERROR` | `Something went wrong` |

`Movie not found` and `Information unavailable` are exact Story copy from #19.
Storage failure is never translated to a false 404.

## 10. Exact targets and messages

| Event | Frozen result | Source |
|---|---|---|
| Registration succeeds | UI opens `/login` | #44 |
| Duplicate normalized email | `This email is already registered` | #44 |
| Login succeeds | UI opens `/recommendations` | #45 |
| Unknown email or wrong password | `Email or password is incorrect` | #45 |
| Logout succeeds | UI opens `/` | #45 |
| Protected route receives 401 | UI opens `/login` | #45 |
| Unknown movie ID | `Movie not found` | #19 |
| Missing movie year/overview | `Information unavailable` in the UI | #19 |

## 11. Consumer rule

Frontend, backend implementation, and automated test PRs are consumers of this
contract. They must link the reviewed contract PR/SHA and use revision
`C03-DRAFT-1` only after it has been approved. If this DTO changes, update this
document and every affected consumer in the same reviewed change.
