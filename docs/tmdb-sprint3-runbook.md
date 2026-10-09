# Sprint 3 required TMDb catalogue runbook

Decision date: 2026-10-06. From Sprint 3, TMDb is the required movie-catalogue
source for development, staging and milestone demos. This is an environment
readiness and Sprint Definition of Done requirement. It does not change the
acceptance criteria or points of Stories #17, #18, #19, #20, #23 or #31.

The existing importer is implemented; Sprint 3 task [#128](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/128) verifies and
completes this operational contract. This document records the required
workflow, not evidence that the task or a live import has passed.

## 1. Ownership and credentials

- Import/setup owner: @kietxuan ([#128](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/128)); independent reviewer: @hoang3003.
- Clean-clone and offline CI owner: @NguyenTuanAnh0608 ([#135](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/135));
  reviewer: @anotify-vie.
- API/data contract owner: @hoang3003 ([#134](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/134)).
- Each developer who runs an import configures their own valid
  `TMDB_READ_ACCESS_TOKEN` in the root, gitignored `.env` or server environment.
  A teammate who only consumes an already-imported backend does not need a
  token. Staging uses a credential configured by its operator.
- Never put a real token in a frontend/Vite variable, browser request,
  response, log, screenshot, issue, PR, CI fixture or group message. Commit
  only the empty placeholder in `.env.example`.

Runtime flow: TMDb API → server importer → SQLite → application API → UI.
The browser never calls TMDb API. When media features are implemented, public
image CDN requests and user-initiated YouTube trailer links need no TMDb token.

## 2. Clean-clone development/staging setup

Follow the root README for the Python virtual environment, locked backend
dependencies, editable backend install and frontend dependencies. Create the
root `.env` from `.env.example` once; do not overwrite an existing configured
file. Set `DATABASE_URL` and enter a valid `TMDB_READ_ACCESS_TOKEN` locally.
Commands below run from the repository root with the virtual environment active.

Create the SQLite parent directory if needed:

```powershell
New-Item -ItemType Directory -Force data
```

On macOS/Linux use `mkdir -p data`. For a custom database path, create its parent
directory instead. Migrate and import directly, without activating the M2 seed:

```text
python -m alembic -c backend/alembic.ini upgrade head
python -m app.cli.import_tmdb_catalogue
```

The current importer fetches one page of popular movies and the official genre
list, with detail lookups only when needed for missing genre IDs. Keep the import
finite. Any change to its page/request budget must be explicit and reviewed.
Success prints a safe provenance summary: `provider`, `active_revision`,
`inserted`, `updated`, `rejected`, `movies`, `associated_genres`,
`finite_popularity_movies`, `source_fetched_at`, and up to three provider
`sample_source_ids`, plus `imported_at` for the active revision. It never
prints the token or provider payload.

Missing/blank credentials must produce a nonzero exit and safe guidance naming
`TMDB_READ_ACCESS_TOKEN` and where to configure it. Rejected credentials,
network/provider failures, unusable payloads or persistence errors must produce
a nonzero exit without activating a partial catalogue or invoking the seed.
On a fresh database, a failed import leaves no accepted catalogue. On an
existing database, it preserves the last valid catalogue and account data.

The M2 bootstrap remains available for historical M2 reproduction, synthetic
tests and explicitly labelled offline work. Use a separate offline/test
database. It activates a seed revision, so do not run it on the accepted
Sprint 3 database after a successful TMDb import. Seed-only environments cannot
be used as Sprint 3 catalogue acceptance evidence.

## 3. Mandatory manual live smoke and provenance

Run once for each new demo/staging environment, and repeat affected checks when
the candidate, database, importer configuration or catalogue changes. This
smoke is outside CI. Record the result as Pending/Not run until actually run.

Using a local SQLite inspection tool, execute these read-only queries on the
configured database. These fields already exist; do not add public DTO fields
merely for provenance:

```sql
SELECT r.id, r.provider, r.created_at,
       r.inserted_movie_count, r.updated_movie_count, r.rejected_movie_count
FROM catalogue_state AS s
JOIN catalogue_revisions AS r ON r.id = s.active_revision_id
WHERE s.id = 1;

SELECT COUNT(*) AS movie_count,
       COUNT(DISTINCT m.source_id) AS distinct_source_ids,
       SUM(CASE WHEN m.source <> 'tmdb' THEN 1 ELSE 0 END) AS non_tmdb_movies,
       SUM(CASE WHEN abs(m.popularity_score) <= 1.7976931348623157e308
                THEN 1 ELSE 0 END) AS finite_popularity_movies,
       COUNT(m.source_fetched_at) AS movies_with_fetch_timestamp,
       MIN(m.source_fetched_at) AS first_fetched_at,
       MAX(m.source_fetched_at) AS last_fetched_at
FROM catalog_movies AS m
JOIN catalogue_state AS s ON s.active_revision_id = m.catalogue_revision_id;

SELECT COUNT(DISTINCT mg.genre_id) AS associated_genre_count
FROM movie_genres AS mg
JOIN catalog_movies AS m ON m.id = mg.movie_id
JOIN catalogue_state AS s ON s.active_revision_id = m.catalogue_revision_id;

SELECT m.id, m.source, m.source_id, m.source_fetched_at
FROM catalog_movies AS m
JOIN catalogue_state AS s ON s.active_revision_id = m.catalogue_revision_id
ORDER BY m.source_id
LIMIT 3;
```

Acceptance requires `provider=tmdb`, movie rows with `source=tmdb`, real source
IDs and fetch/import timestamps. Record counts of movies, associated genres and
usable finite-popularity movies. The demo catalogue must support the committed
flows, including at least ten distinct movies with finite popularity for #31.
Do not invent records or reset the database if the bounded import is inadequate;
report the shortfall to the PO for a reviewed budget/scope decision.

Smoke the two public list contracts separately:

```text
curl "http://localhost:8000/api/movies?limit=10"
```

Expected: `200` with public catalogue entries linked to the active revision.
Entries without a valid popularity value may be present and, when popularity
ordering is used, appear after entries with finite popularity. Also verify a
valid `GET /api/movies/{movieId}` response against that revision.

After the S09/T19 route is implemented, run:

```text
curl "http://localhost:8000/api/movies/popular?limit=10"
```

Expected: `200` with only movies whose popularity value is valid and finite,
in the committed popularity/title/ID order. Do not use the `/api/movies` smoke
result as evidence for the dedicated popular-movie contract. Until the route is
implemented, record this check as `Pending/Not run`, not as passed.

After the other Sprint 3 routes are implemented, also smoke `/api/genres` and
authenticated `/api/me/recommendations`. All these application routes read
SQLite only; preferences/accounts remain application-owned data. Keep source
IDs in the operator evidence; public movie IDs remain opaque internal IDs.
Start/restart the app and verify local reads still work without new provider
requests and without losing account data.

Reimport the same bounded dataset and verify stable IDs for retained movies and
no duplicate `(source, source_id)` rows. Live data can change between runs, so
do not demand identical titles/counts or hard-coded popularity ordering.
Deterministic rollback/failure cases belong to isolated tests, not deliberate
faults in the accepted shared environment.

Evidence must include candidate SHA, environment, tester/date, command and exit
status, actual counts, active revision/provider, sample source IDs, timestamps,
expected/actual results and any blocker. Record it with the tracked
[T29 evidence record](evidence/t29-tmdb-live-smoke.md). Do not attach `.env`,
credentials, database dumps or live provider payloads as automated test
fixtures.

If no successful TMDb import/provenance smoke exists, catalogue-dependent flows
cannot be accepted for Sprint 3. A failed attempted import cannot be recorded as
successful; the previous valid snapshot may continue serving users, but any new
readiness claim must identify that snapshot and have a successful smoke on the
candidate. No live call is required for each user click or test run.

## 4. Offline automated verification

CI and unit/integration suites use synthetic provider responses with mocks at
the TMDb boundary and isolated, migrated test databases. No real token or live
TMDb/CDN/YouTube request is needed. Do not copy live smoke data into fixtures.
Unset/blank the test token explicitly so the root developer `.env` cannot cause
an accidental provider request; never print the inherited token.

Existing focused checks from the root:

```text
python -m pytest backend/tests/test_tmdb_import.py backend/tests/test_m2_catalogue_bootstrap.py backend/tests/test_movies_api.py -v
python -m ruff check backend
```

T29/C04 must cover fresh migrated database import, missing/invalid token,
provider/validation/database failure rollback against a previous TMDb revision,
idempotent source IDs and account preservation. Existing coverage is reused;
add only missing checks. Automated Story cases for exact ordering, empty data,
missing fields and retry use controlled fixtures. They remain required alongside
the separate live smoke; neither evidence replaces the other.

## 5. Media scope and delivery

T29 is committed Sprint 3 infrastructure, independent of media gate G3.
T26–T28 remain stretch backdrop foundation after G3 and separate capacity.
Backdrop UI/trailer remain Sprint 4 enhancements; VN providers remain optional
Sprint 5 work. A Read Access Token permits reading these metadata endpoints but
does not implement import/storage/UI or guarantee that every film has media or
VN availability. Media null/fallback rules and attribution follow their own
feature contracts.

Share this tracked runbook with issue assignees. The local `sprint/` planning
folder is excluded from Git; paste the English task bodies into GitHub and link
this runbook through a reviewed documentation commit/PR. Do not rely on a local
planning-file link as the only instructions available to teammates.
