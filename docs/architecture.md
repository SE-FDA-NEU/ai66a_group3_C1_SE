# Sprint 3 architecture and persistence contract

Contract revision: `S3-FINAL`, reconciled on 2026-10-18 against Sprint 3
`main` SHA `f9774cbe7248c29915086d29bf2b9f99c2aa528a`.

The HTTP contract is in [api.md](api.md). This document describes the final
Sprint 3 runtime and separately identifies genuinely unfinished scope. The
profile/reset UI, rating-adjusted ranking, and NLP product remain unfinished;
implemented rating, recommendation, preference, and backdrop work is not
labelled pending.

Post-M3 amendment (2026-10-19): the three movie-list routes count and slice
their complete eligible active-revision sets in SQLite. Home orders all active
movies by `lower(title)`, original title and internal ID; Popular and
recommendation fallback use finite popularity. Personal mode is selected from
the complete saved-genre match set before an optional view genre is applied.
The browser stores page and view genre in the list URL and sends the last
accepted catalogue revision on subsequent requests. Shared navigation uses
the existing AuthProvider for direct public-route session checks and sign-out.

## 1. Runtime evidence

The repository contains a FastAPI backend with these implemented areas:

- `GET /health`, which reports application, database, and Alembic migration
  state.
- Authentication through registration, login, current-session lookup, and
  logout under `/api/auth`.
- Public catalogue reads through `GET /api/movies` and
  `GET /api/movies/{movieId}`.
- Authenticated `GET /api/me/recommendations`, which uses the session account's
  saved genres when matches exist and otherwise serves the reviewed popular
  cold-start/no-match states.
- Authenticated genre/preference reads (S3-T01) and validated, atomic
  `PUT /api/me/preferences` (S3-T02), scoped only by the server-side session.

The dedicated public popular-movie route `GET /api/movies/popular` is an
implemented S09/T19 Sprint 3 route. It returns the finite-popularity subset
and is distinct from the existing general catalogue route.

The backend uses the local SQLite catalogue selected by
`catalogue_state.active_revision_id`. Movie and recommendation reads do not
call TMDb. The server-side TMDb importer writes catalogue revisions outside
browser requests. From Sprint 3 this import is required for development,
staging and demo catalogue acceptance; it is verified under T29/C04 in the
[runbook](tmdb-sprint3-runbook.md). M2 seed evidence remains historical/test
support, while CI uses synthetic provider fixtures without a real token/network.

Preference storage, reads, and atomic replacement are implemented under
T01/T02. The genre/popularity-only personalised recommendation backend is
implemented under T08. Account-owned rating storage and its repository are
implemented under T30, the protected rating API under T31, and the atomic
authenticated reset backend under T35. T33 adds the separate typed rating client
and account/movie-keyed widget on public details, using the existing AuthProvider
and protected rating API. Public details remain accessible during session checks
or private rating failures. T34 supplies browser/API/database acceptance for the
rating UI and its stale-response protection. Profile/reset UI remains separate
work. Rating/reset session isolation supports Story #45 / S13.
Rating-adjusted ranking remains Story #22 / S05b planned for Sprint 4.

The Sprint 3 backdrop chain is also complete: T26 stores nullable
`backdrop_path`; T27 imports/maps it and returns nullable `backdropUrl`; T37
renders the responsive detail hero with safe fallback; and T28/#131 verifies
storage, importer, API, UI, rollback, account preservation, and live public-CDN
delivery. Trailer work remains Sprint 4 and provider availability remains an
optional Sprint 5 concern.

## 2. Selected stack

| Layer | Technology | Boundary |
|---|---|---|
| Browser frontend | React, TypeScript, Vite | Renders screens and calls the backend API. |
| Backend API | FastAPI, Pydantic, Python 3.12 | Owns HTTP validation, authentication, catalogue reads, and genre/popularity recommendations. |
| Persistence | SQLAlchemy, Alembic, SQLite | Owns the migrated account/session, preference, rating, and catalogue tables. |
| Password storage | Argon2id | Stores only encoded password hashes. |
| Provider integration | Server-side `httpx` adapter | Keeps the TMDb credential out of the browser. |
| Tests | pytest; Vitest and React Testing Library | Verifies backend and frontend behaviour. |

The intended deployment is same-origin: FastAPI serves `/api` and the built
frontend, while Vite proxies `/api` during development. The browser uses an
opaque `HttpOnly` session cookie and never stores a bearer token.

## 3. C4 container diagram

![C4 container diagram](images/architecture.png)

PlantUML source: [architecture.puml](images/architecture.puml).

This is the current Sprint 3 diagram. The preserved historical M2 versions are
[architecture-m2.png](images/architecture-m2.png) and
[architecture-m2.puml](images/architecture-m2.puml).

The catalogue flow is:

```text
TMDb metadata API -> required server-side importer -> local SQLite
local SQLite -> backend API -> browser frontend
browser frontend -> public TMDb image CDN (backdrop bytes only)
```

The runtime boundaries are:

1. Browser frontend.
2. Backend API.
3. SQLite database.
4. Server-side TMDb importer; required catalogue preparation from Sprint 3.
5. Public TMDb image CDN; browser delivery of allowlisted backdrop bytes only.

| Component | Responsibility | Must not do |
|---|---|---|
| Browser frontend | Render auth, catalogue, preferences, recommendations, ratings, and movie-detail backdrops; call the matching application API contract. | Receive TMDb credentials, call the TMDb metadata API, or use `/api/movies` as evidence for `/api/movies/popular`. The only provider-origin browser request is an allowlisted public backdrop URL returned by the detail API. |
| Backend API | Validate input, resolve the session account, read the active catalogue, and return stable DTOs/errors. | Trust a client-supplied `user_id` or call the TMDb metadata API while serving a page request. |
| SQLite database | Persist all nine application tables, including account preferences/ratings and nullable movie backdrop paths. | Select an account independently of the authenticated session. |
| TMDb importer | Required Sprint 3 dev/staging/demo catalogue preparation: fetch bounded provider data, validate it and write one atomic revision. | Run in the browser, expose credentials or silently fall back to seed on failure. |
| Public image CDN | Return backdrop image bytes for the reviewed HTTPS `w780` URL. | Receive the TMDb API token or act as a metadata API. |

The application APIs never proxy a browser request to TMDb. Genres,
recommendations, public catalogue movies, dedicated popular movies, movie
details, preferences, and ratings all read local SQLite. The detail DTO may
contain a server-built public image-CDN URL derived from validated local
`backdrop_path`; loading those image bytes is not a TMDb metadata API call and
does not expose the server token. `catalog_movies.id` is the public opaque
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

The current ERD shows all nine application tables at the Sprint 3 migration
head. `alembic_version` is migration infrastructure and is intentionally not
counted:

- `users`
- `auth_sessions`
- `catalogue_revisions`
- `catalogue_state`
- `catalog_movies`
- `genres`
- `movie_genres`
- `user_genre_preferences`
- `user_movie_ratings`

`auth_sessions` stores `token_digest`, `created_at`, `expires_at`, and nullable
`revoked_at`. `catalogue_revisions` stores the inserted, updated, and rejected
movie counters. `catalogue_state.active_revision_id` is required and points to
the active revision. S3-T01 migration `9d2f5a1c3b84` added
`user_genre_preferences`; S3-T30 migration `b7e4c2d91f30` added
`user_movie_ratings`. S3-T26 migration `c6f8a2d4e901` extends that revision with
nullable `catalog_movies.backdrop_path` and is the single current head. The ERD
shows both account relations, the unique `(user_id, movie_id)` rating pair, the
strict integer `1..5` rating check, and nullable backdrop storage. No import-run
table has been migrated. The preserved seven-table M2 baseline is available as
[erd-m2.png](images/erd-m2.png) with [PlantUML source](images/erd-m2.puml).

### Sprint 3 personalisation storage

Both application-owned tables are implemented:
`user_genre_preferences` in migration `9d2f5a1c3b84` (S3-T01) and
`user_movie_ratings` in migration `b7e4c2d91f30` (S3-T30).

| Table | Columns | Keys and constraints | Ownership/delete rule |
|---|---|---|---|
| `user_genre_preferences` | `user_id` VARCHAR(36), `genre_id` INTEGER | Composite primary key/unique `(user_id, genre_id)`; FK `user_id -> users.id` ON DELETE CASCADE; FK `genre_id -> genres.id` ON DELETE RESTRICT | Rows belong to one user; deleting/resetting one account's preference rows cannot affect another account or the genre catalogue. |
| `user_movie_ratings` | `id` VARCHAR(36), `user_id` VARCHAR(36), `movie_id` VARCHAR(36), `rating` INTEGER, `created_at` DATETIME, `updated_at` DATETIME | Primary key `id`; unique `(user_id, movie_id)`; FK `user_id -> users.id` ON DELETE CASCADE; FK `movie_id -> catalog_movies.id` ON DELETE CASCADE; CHECK `typeof(rating) = 'integer' AND rating BETWEEN 1 AND 5` | One current rating per user/movie; deleting its account or catalogue movie removes the owned rating. |

The T30 repository also enforces a strict integer before persistence. The
implemented T31 API retains request validation because the SQLite check is
defence in depth and does not define the public JSON contract.
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
  committed set on failure (implemented under T02). Canonical existence is
  checked before deletion; scoped deletion, insertion, and flush run in the
  request's transaction. The route commits once or rolls back on database
  failure. Response DTOs are prepared before commit and returned after it.
- The T30 rating repository reads and upserts by `(user_id, movie_id)` inside
  the caller's transaction. The T31 rating API returns success only after
  commit; invalid input or a failed commit preserves the prior value.
- The T35 profile reset deletes only the session account's preference and
  rating rows in one transaction. Failure of either delete or commit rolls
  back both; the user, current session, catalogue, movies, genres, and other
  accounts are preserved.

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

T02 extends the existing same-origin Fetch Metadata/`Origin` protection to
preference PUT requests using a method/path registry; T31 extends it to rating
PUT requests and T35 to profile-reset POST requests. Missing, expired, or
revoked sessions return `401 AUTHENTICATION_REQUIRED`; permitted-origin
requests still derive their account solely from the server-side session.

## 7. Delivery boundary

M2 includes health, authentication, catalogue reads, and popular/cold-start
recommendations. Sprint 3 adds the dedicated S09/T19 public popular route,
preferences, and the implemented T08 genre/popularity-only personalised
recommendations. T30 adds account-owned rating storage and repository support.
T31 adds the protected rating API, and T35 adds the authenticated atomic reset
backend. T33/T34 deliver and verify the account/movie-keyed rating UI. The
profile/reset UI remains absent, so Story #33 / S11 is not complete from the
backend-only T35 evidence.

Rating-adjusted recommendation ranking is not part of Sprint 3. It belongs to
Story #22 / S05b and is planned Sprint 4 behaviour.

## 8. Backdrop reconciliation

The complete Sprint 3 chain is:

1. T26/#129 adds nullable TEXT `CatalogMovie.backdrop_path` through migration
   `c6f8a2d4e901`, the single current head, plus transaction-owned storage.
2. T27/#130 maps validated TMDb paths during bounded core import or media-only
   enrichment and builds nullable, allowlisted `backdropUrl` values for the
   public detail DTO. Application endpoints still read SQLite only.
3. T37/#179 renders the movie-detail hero. Null, omitted, unsafe, or failed
   images retain the permanent gradient/overlay and readable title.
4. T28/#131 verifies migrations, rollback, stable IDs, account preservation,
   API shape, stale movie/account responses, responsive fallback, and a live
   public-CDN image without metadata calls or credentials.

The browser may download the returned public image directly from
`image.tmdb.org`; this is distinct from calling the TMDb metadata API. See the
[storage handoff](backdrop-storage-contract.md), [enrichment runbook](backdrop-import-runbook.md),
[T37 UI evidence](evidence/s3-t37-backdrop-ui/README.md), and
[T28 acceptance](evidence/s3-t28-backdrop-acceptance/README.md).

## 9. T11 account-write boundary — early proposal pending C03

The T11 branch introduces `backend/app/db/account_writes.py` and a shared runtime
engine factory. Existing SQLite journal mode and foreign-key enforcement remain;
the busy timeout is explicitly 5000ms. Reset, preference replacement and rating
save reserve the DB writer before auth/decision reads; no process-local mutex or
new storage service is added. They use one request-local Session and one route
commit, with dependency rollback on every uncommitted exit. Read routes keep
their existing read-snapshot policy, not an IMMEDIATE write reservation.

SQLite has one file-wide writer, so different-account writes may queue, but a
reset cannot target or absorb another account's rows. Both serial reset/save
orders, mid-delete/commit rollback and a separate-process competing writer are
tested on migrated temporary file databases. Runtime does not force WAL; tests
exercise DELETE and WAL without touching a real application database.

No migration, provider request, index rebuild or new Profile/Watchlist UI is
introduced. Future watchlist/profile consumers reuse the reviewed policy and
retain their assigned acceptance. See the
[T11 proposal](reset-concurrency-contract.md) and
[actual evidence](evidence/s4-t11-reset-concurrency.md). This early implementation
must be reconciled after C03 #217 and independently reviewed before merge.
