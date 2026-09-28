# M2 architecture and persistence contract

Contract revision: `C03-DRAFT-2`.

This follow-up contract extends the baseline merged in PR #72. It does not
change that merged pull request or its history. The HTTP contract is in
[api.md](api.md).

## 1. Evidence boundary

The current repository contains the C04 runtime bootstrap:

- a React, TypeScript, and Vite frontend manifest;
- a Python 3.12 FastAPI backend manifest;
- a database-backed `GET /health` route; and
- Alembic configuration with one bootstrap revision.

The bootstrap revision
`backend/alembic/versions/2d8a3f83d517_bootstrap_database.py` has empty
`upgrade()` and `downgrade()` functions. It does not create catalogue or
account tables. No auth, catalogue, preference, or recommendation HTTP route
is present at this revision. Target components, entities, and endpoints below
are contracts for later implementation unless linked to runtime evidence.

This distinction prevents a planned endpoint or table from being described as
already running.

## 2. Selected stack

| Layer | Technology | Boundary |
|---|---|---|
| Browser frontend | React, TypeScript, Vite | Renders screens and calls only the backend API. |
| Backend API | FastAPI, Pydantic, Python 3.12 | Owns HTTP validation, authentication, and business rules. |
| Persistence | SQLAlchemy, Alembic, SQLite | Owns parameterized queries and local/demo persistence. |
| Password storage | Argon2id | Stores only encoded password hashes. |
| Provider integration | Server-side `httpx` adapter | Keeps the TMDb credential out of the browser. |
| Tests | pytest; Vitest and React Testing Library | Verifies backend and frontend behaviour. |

The intended integrated deployment is same-origin: FastAPI serves `/api` and
the built frontend, while Vite proxies `/api` during development. The browser
uses an opaque `HttpOnly` session cookie and never stores a bearer token.

## 3. C4 container diagram

![C4 container diagram](images/architecture.png)

PlantUML source: [architecture.puml](images/architecture.puml).

The diagram contains these required runtime boundaries:

1. Browser frontend.
2. Backend API.
3. SQLite database.
4. Optional server-side TMDb importer.

TMDb is shown as an external system. Every relationship is labelled with the
data carried across the boundary. Runtime movie and recommendation requests
read the local SQLite catalogue; they do not call TMDb.

### Component responsibilities

| Component | Responsibility | Must not do |
|---|---|---|
| Browser frontend | Render account, preference, catalogue, and recommendation experiences; send JSON requests. | Receive TMDb credentials or issue provider calls. |
| Backend API | Validate HTTP input, resolve the session account, apply business rules, and return stable DTOs/errors. | Trust a client-supplied `user_id`. |
| SQLite database | Persist accounts, sessions, catalogue revisions, movies, genres, preferences, ratings, and import state. | Select an account independently of the authenticated session. |
| Optional TMDb importer | Fetch bounded provider data, validate it, and write one atomic catalogue revision. | Run in the browser or expose provider credentials. |

## 4. ERD and migration status

![Catalogue and account ERD](images/erd.png)

PlantUML source: [erd.puml](images/erd.puml).

The ERD records the C03 catalogue/account migration contract, including PKs,
FKs, unique/check constraints, and relationship multiplicities. The catalogue
tables and `users` are implemented by Alembic revisions; the remaining account
relations stay planned until their owning tasks are merged. Compare the ERD to
each new revision and update it in the same change if any table, column, key,
constraint, or multiplicity differs.

### Required persistence rules

- `users.email_normalized` is unique. Password plaintext is never
  stored; only an Argon2id hash is persisted.
- `auth_sessions.user_id` identifies the authenticated account. Protected
  operations never accept a client-selected account identity.
- `viewer_genre_preferences` has a composite key `(user_id, genre_id)`.
  Saving preferences replaces only the current account's 1-5 distinct genres
  in one transaction.
- `viewer_ratings` has a composite key `(user_id, movie_id)` and a rating
  constraint from 1 through 5.
- Each `catalog_movies` row belongs to one catalogue revision. Runtime reads
  filter by `catalogue_state.active_revision_id`.
- `movie_genres` de-duplicates each movie/genre relationship through its
  composite primary key.
- A failed import cannot update the active revision. Import records never
  contain the TMDb credential.

## 5. Authentication and data ownership

- Registration trims and lowercases the email before validation and insertion.
- Login creates a cryptographically random opaque session. The cookie uses
  `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` outside documented
  localhost development.
- Every protected request resolves `user_id` from the cookie and server-side
  session. Body, query, path, or custom-header account IDs are not
  authoritative.
- Logout invalidates the current server session and clears the cookie without
  deleting account-owned preferences or ratings.
- Preference, rating, reset, and personal recommendation operations can read
  or modify only the authenticated account's rows.
- Passwords, password hashes, session digests, cookie values, and provider
  credentials never appear in response DTOs or logs.

## 6. Optional TMDb import flow

The importer is an explicit server-side operation, not part of a browser movie
request:

1. Read `TMDB_READ_ACCESS_TOKEN` from the server environment.
2. Request provider genres and a bounded set of popular-movie pages.
3. Request details only for required missing fields.
4. Map provider field names to provider-neutral records and reject invalid
   records.
5. In one database transaction, create a candidate catalogue revision, upsert
   movies and genres, replace movie/genre links, record counts, and activate
   the revision only after all required writes succeed.
6. On provider or transaction failure, retain the previous active revision and
   record only a sanitized failure.

The importer transmits movie and genre provider JSON; it never transmits a
password, account session, preference, or rating to TMDb.

## 7. C03 completion gate

C03 is complete when the new documentation PR demonstrates all of the
following:

- the C4 diagram has at least the four required components;
- every architecture arrow names the transmitted data;
- the PNGs are rendered from the committed PlantUML sources;
- the ERD identifies PKs, FKs, and multiplicities and is reconciled with the
  actual catalogue/account migrations once those migrations exist;
- the API inventory covers every P0 Story and exposes stable error codes;
- every endpoint is classified as `Implemented in M2` or
  `Planned for later sprint` using repository evidence; and
- no planned endpoint is described as currently available.

The NLP Spike and an NLP API contract are outside C03. C03 does not wait for
the Spike, and NLP is not a C03 completion criterion.
