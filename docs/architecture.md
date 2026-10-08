# M2 architecture and persistence contract

Contract revision: `M2-CURRENT`.

The HTTP contract is in [api.md](api.md). This document describes the
backend that is present in the repository, not planned Sprint 3 features.

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

The backend uses the local SQLite catalogue selected by
`catalogue_state.active_revision_id`. Movie and recommendation reads do not
call TMDb. The server-side TMDb importer writes catalogue revisions outside
browser requests. From Sprint 3 this import is required for development,
staging and demo catalogue acceptance; it is verified under T29/C04 in the
[runbook](tmdb-sprint3-runbook.md). M2 seed evidence remains historical/test
support, while CI uses synthetic provider fixtures without a real token/network.

Preferences, ratings, personalized recommendation ranking, and NLP are Sprint
3 work. They are not implemented migrations or M2 runtime capabilities.

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

The runtime boundaries are:

1. Browser frontend.
2. Backend API.
3. SQLite database.
4. Server-side TMDb importer; required catalogue preparation from Sprint 3.

| Component | Responsibility | Must not do |
|---|---|---|
| Browser frontend | Render auth, catalogue, and popular recommendation experiences; send JSON requests. | Receive TMDb credentials or issue provider calls. |
| Backend API | Validate input, resolve the session account, read the active catalogue, and return stable DTOs/errors. | Trust a client-supplied `user_id`. |
| SQLite database | Persist users, sessions, catalogue revisions, the active revision, movies, genres, and movie/genre links. | Select an account independently of the authenticated session. |
| TMDb importer | Required Sprint 3 dev/staging/demo catalogue preparation: fetch bounded provider data, validate it and write one atomic revision. | Run in the browser, expose credentials or silently fall back to seed on failure. |

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
- Preferences, ratings, personalized recommendation ranking, and NLP require
  future Sprint 3 migrations and routes; they are not part of this database
  contract.

## 6. Authentication and provider flow

Registration normalizes the email and stores an Argon2id hash. Login creates a
cryptographically random opaque session cookie. Logout revokes the current
session and clears the cookie. Passwords, hashes, session digests, cookie
values, and provider credentials never appear in response DTOs or logs.

The importer reads `TMDB_READ_ACCESS_TOKEN` on the server, fetches bounded
provider data, validates it, records revision counters, and activates the
revision only after all required writes succeed. Provider failures retain the
previous active revision.

## 7. Delivery boundary

M2 includes health, authentication, catalogue reads, and popular/cold-start
recommendations. Sprint 3 will add preferences, ratings, personalized
recommendations, and NLP after their migrations, routes, and tests exist.
