# Sprint 3 architecture and persistence contract

Contract revision: `S3-DRAFT`, reconciled with current migrations on
2026-10-09.

The HTTP contract is in [api.md](api.md). This document describes the backend
that is present in the repository and separately labels committed Sprint 3
persistence contracts whose implementation is pending. Committed target
tables/routes are required Sprint scope, but are not runtime or test evidence.

## 1. Runtime evidence

The repository contains a FastAPI backend with these implemented areas:

- `GET /health`, which reports application, database, and Alembic migration
  state.
- Authentication through registration, login, current-session lookup, and
  logout under `/api/auth`.
- Public catalogue reads through `GET /api/movies` and
  `GET /api/movies/{movieId}`.
- Authenticated `GET /api/me/recommendations`, which currently serves the
  shared popular/cold-start recommendation list.

The dedicated public popular-movie route `GET /api/movies/popular` is a
committed S09/T19 Sprint 3 contract and is not implemented in the current
runtime. It must not be inferred from the existing catalogue route.

The backend uses the local SQLite catalogue selected by
`catalogue_state.active_revision_id`. Movie and recommendation reads do not
call TMDb. The server-side TMDb importer writes catalogue revisions outside
browser requests. From Sprint 3 this import is required for development,
staging and demo catalogue acceptance; it is verified under T29/C04 in the
[runbook](tmdb-sprint3-runbook.md). M2 seed evidence remains historical/test
support, while CI uses synthetic provider fixtures without a real token/network.

Preferences, rating storage/API/UI protection, genre/popularity-only
personalised recommendations, and the authenticated reset backend are
committed Sprint 3 scope. They are not implemented migrations or current
runtime capabilities. Rating/reset session isolation supports Story #45 / S13.
Rating-adjusted ranking remains Story #22 / S05b planned for Sprint 4.

## 2. Selected stack

| Layer | Technology | Boundary |
|---|---|---|
| Browser frontend | React, TypeScript, Vite | Renders screens and calls the backend API. |
| Backend API | FastAPI, Pydantic, Python 3.12 | Owns HTTP validation, authentication, catalogue reads, and popular recommendations. |
| Persistence | SQLAlchemy, Alembic, SQLite | Owns the migrated account/session and catalogue tables. |
| Password storage | Argon2id | Stores only encoded password hashes. |
| Provider integration | Server-side `httpx` adapter | Keeps the TMDb credential out of the browser. |
| Tests | pytest; Vitest and React Testing Library | Verifies backend and frontend behaviour. |

The intended deployment is same-origin: FastAPI serves `/api` and the built
frontend, while Vite proxies `/api` during development. The browser uses an
opaque `HttpOnly` session cookie and never stores a bearer token.

## 3. C4 container diagram

![C4 container diagram](images/architecture.png)

PlantUML source: [architecture.puml](images/architecture.puml).

This diagram preserves the historical M2 optional-import label; from Sprint 3
the same importer is required catalogue preparation under the updated decision.

The catalogue flow is:

```text
TMDb -> server-side import -> backend -> local SQLite -> API -> frontend
```

The runtime boundaries are:

1. Browser frontend.
2. Backend API.
3. SQLite database.
4. Server-side TMDb importer; required catalogue preparation from Sprint 3.

| Component | Responsibility | Must not do |
|---|---|---|
| Browser frontend | Render auth, catalogue, dedicated popular-list, and recommendation experiences; call the matching API contract. | Receive TMDb credentials, issue provider calls, or use `/api/movies` as evidence for `/api/movies/popular`. |
| Backend API | Validate input, resolve the session account, read the active catalogue, and return stable DTOs/errors. | Trust a client-supplied `user_id`. |
| SQLite database | Persist users, sessions, catalogue revisions, the active revision, movies, genres, and movie/genre links. | Select an account independently of the authenticated session. |
| TMDb importer | Required Sprint 3 dev/staging/demo catalogue preparation: fetch bounded provider data, validate it and write one atomic revision. | Run in the browser, expose credentials or silently fall back to seed on failure. |

The API never proxies a browser request to TMDb. Genres, recommendations,
public catalogue movies, dedicated popular movies, and movie details all read
the active local SQLite revision. `catalog_movies.id` is the public opaque
identity; `(source, source_id)` remains provider provenance and is not exposed
as the public ID.

The two public list flows are intentionally distinct:

```text
Public catalogue frontend
  -> GET /api/movies
  -> Backend API
  -> SQLite active catalogue (entries without popularity may be included)

Popular frontend
  -> GET /api/movies/popular
  -> Backend API
  -> SQLite active-catalogue movies with valid finite popularity only
```

`GET /api/movies` is the implemented S04 public catalogue route. The committed
S09/T19 `GET /api/movies/popular` route is the dedicated popular subset. The
frontend must use the latter when rendering the Sprint 3 public popular list.

## 4. ERD and current migrations

![Catalogue and account ERD](images/erd.png)

PlantUML source: [erd.puml](images/erd.puml).

The ERD shows exactly the seven tables created by the current Alembic
migrations:

- `users`
- `auth_sessions`
- `catalogue_revisions`
- `catalogue_state`
- `catalog_movies`
- `genres`
- `movie_genres`

`auth_sessions` stores `token_digest`, `created_at`, `expires_at`, and nullable
`revoked_at`. `catalogue_revisions` stores the inserted, updated, and rejected
movie counters. `catalogue_state.active_revision_id` is required and points to
the active revision. No preferences, ratings, or import-run table has been
migrated.

### Committed Sprint 3 personalisation storage (implementation pending)

The committed contract requires two application-owned tables. Names below are
frozen for the future implementation migration; they do not exist in the
current Alembic head.

| Table | Columns | Keys and constraints | Ownership/delete rule |
|---|---|---|---|
| `user_genre_preferences` | `user_id` VARCHAR(36), `genre_id` INTEGER | Composite primary key/unique `(user_id, genre_id)`; FK `user_id -> users.id` ON DELETE CASCADE; FK `genre_id -> genres.id` ON DELETE RESTRICT | Rows belong to one user; deleting/resetting one account's preference rows cannot affect another account or the genre catalogue. |
| `viewer_ratings` | `user_id` VARCHAR(36), `movie_id` VARCHAR(36), `rating` INTEGER | Composite primary key/unique `(user_id, movie_id)`; FK `user_id -> users.id` ON DELETE CASCADE; FK `movie_id -> catalog_movies.id` ON DELETE RESTRICT; CHECK `rating BETWEEN 1 AND 5` | One committed rating per user/movie; deleting a catalogue movie cannot leave an orphan rating. |

Application validation must also enforce a strict integer: SQLite's check is
defence in depth and does not make JSON strings, booleans, or fractions valid.
The stable internal movie ID lets a rating continue to identify the same
provider movie across importer updates that preserve that ID.

## 5. Persistence and ownership rules

- `users.email_normalized` is unique. Plaintext passwords are never stored.
- `auth_sessions.user_id` identifies the authenticated account; protected
  operations derive it from the opaque cookie session.
- Each `catalog_movies` row belongs to one catalogue revision.
- Runtime catalogue reads filter through
  `catalogue_state.active_revision_id`.
- `movie_genres` de-duplicates each movie/genre relationship through its
  composite primary key.
- A failed import cannot replace the active revision.
- Sprint 3 private rows are always keyed by the session-resolved `users.id`;
  no client-supplied identity participates in a lookup or mutation.
- Sprint 3 preference replacement is one transaction and preserves the prior
  committed set on failure.
- Sprint 3 rating upsert is one transaction and returns success only after
  commit. Invalid input or a failed commit preserves the prior value.
- Sprint 3 profile reset deletes only the current user's preference and rating
  rows in one transaction. Failure of either delete or commit rolls back both;
  the user, current session, catalogue, movies, genres, and other accounts are
  preserved.

## 6. Authentication and provider flow

Registration normalizes the email and stores an Argon2id hash. Login creates a
cryptographically random opaque session cookie. Logout revokes the current
session and clears the cookie. Passwords, hashes, session digests, cookie
values, and provider credentials never appear in response DTOs or logs.

The importer reads `TMDB_READ_ACCESS_TOKEN` on the server, fetches bounded
provider data, validates it, records revision counters, and activates the
revision only after all required writes succeed. Provider failures retain the
previous active revision.

TMDb import is required preparation for development, staging, and M3
acceptance. Automated tests use synthetic catalogue fixtures or mocked
provider responses and run offline; CI needs no TMDb token. The token must not
appear in DTOs, frontend/Vite assets, logs, screenshots, fixtures, database
dumps used as evidence, or documentation evidence.

Committed Sprint 3 private writes must extend the existing same-origin Fetch
Metadata/`Origin` protection before mutation. Missing, expired, or revoked
sessions return `401 AUTHENTICATION_REQUIRED`; permitted-origin requests still
derive their account solely from the server-side session.

## 7. Delivery boundary

M2 includes health, authentication, catalogue reads, and popular/cold-start
recommendations. Sprint 3 contracts in this document cover the dedicated
S09/T19 public popular route, preferences, genre/popularity-only personalised
recommendations, rating persistence, and the authenticated profile-reset
backend. Each pending capability remains unimplemented until its route and
applicable query, migration, transaction handling, protection, and tests exist.

Rating-adjusted recommendation ranking is not part of Sprint 3. It belongs to
Story #22 / S05b and is planned Sprint 4 behaviour.

## 8. Backdrop reconciliation

The current model, catalogue migration, TMDb mapper, movie DTOs, detail route,
and frontend contain no `backdrop` field. There is no nullable-backdrop
migration or importer/detail compatibility implementation in this repository.
The repository also contains no evidence linking tasks/issues #129-#131 to
completed backdrop work. Backdrop remains pending/stretch work; this contract
must not be read as completion evidence.
