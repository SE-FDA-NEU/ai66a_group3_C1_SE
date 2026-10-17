# S3-T26 backdrop storage handoff

Related task: [#129](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/129).
Parent reference: [S03 #19](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/19).

## Implemented boundary

T26 adds storage only. Migration `c6f8a2d4e901` extends rating migration
`b7e4c2d91f30` and adds **nullable TEXT** `catalog_movies.backdrop_path` to
the existing `CatalogMovie` model/table. No new application table is created.
Existing/new movies have SQL `NULL` until an explicit media update. Paths are
stored as text, never image bytes, files, blobs or base64 data.

No TMDb mapping, image URL construction, API response field, poster, trailer,
watch-provider feature or frontend backdrop is implemented in T26. The current
public DTOs remain unchanged; `backdropUrl` is the additive consumer contract
for T27, not an implemented T26 endpoint field.

## Repository contract

```python
set_movie_backdrop_path(
    session,
    movie_id=existing_internal_movie_id,
    backdrop_path="/validated-provider-path.jpg",  # or None to clear
)
```

- Use the existing stable **internal** movie ID, not a TMDb ID.
- An explicit string is stored verbatim; explicit `None` clears the value.
- A missing/unfetched field or failed enrichment must **skip** this call so a
  previous successful value survives. The existing core upsert does not touch
  `backdrop_path`, so a core refresh alone preserves it.
- Non-string/non-null values and an unknown movie ID raise `ValueError`.
  This function never inserts a new movie to satisfy an unknown ID.
- Only the path changes. Catalogue revision/pointer, provider identity, title,
  overview, genres, popularity, vote fields, source-fetch time, accounts,
  preferences and ratings are not changed.
- The helper flushes but **never commits**. The caller owns the transaction;
  a later exception rolls back the path update with the rest of the import.
- T27 owns provider-path/host/traversal validation before this storage call,
  bounded fetch/enrichment, HTTPS URL construction and `backdropUrl` DTO tests.
  Type validation here is not a promise that an arbitrary string is a safe URL.

## Rollout and migration ownership

Before starting application code with this model, apply the migration from the
repository root. Keep the existing `.env`; no new dependency/token is needed
for this storage migration.

```powershell
.\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini heads
.\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini upgrade head
.\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini current
```

At T26 delivery there is one head: `c6f8a2d4e901`. A developer starting T27
must fetch/merge current `main`, inspect the actual head and coordinate any
later revision; do not fork from the older rating head or edit applied
migrations. No migration is run automatically at application startup.

Take a consistent backup before upgrading a valuable local database. The tests
exercise fresh and populated databases, with existing identities and all rows
preserved. Explicit operator downgrade removes **only** the new column but
loses any stored backdrop paths; it is tested on disposable databases, not run
automatically or recommended as a way to reset a live database.

## Consumers and Definition of Done

| Consumer | Output it owns |
|---|---|
| T27 / [#130](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/130) | Bounded TMDb mapping/enrichment, path validation and nullable safe `backdropUrl` on details |
| S3-T37 UI task | Movie-detail hero, readable gradient and missing/broken/stale-image fallback |
| T28 / [#131](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/131) | Independent storage/import/API/browser acceptance on the final candidate |

T26 completes only its own storage checks after independent review and merge.
It does not close S03, #130, #131 or the UI task, or prove the whole backdrop
feature is visible. Story AC/points, ranking and authentication stay unchanged.

## Reproduce the focused checks

```powershell
.\.venv\Scripts\python.exe -m pytest backend/tests/test_backdrop_storage.py -v
.\.venv\Scripts\python.exe -m ruff check backend
```

The focused tests migrate their own temporary SQLite databases and use only
synthetic records. They need neither a live TMDb token nor provider networking.
They cover one-head ancestry, fresh/populated upgrades, exact row/constraint
preservation (including 2 accounts / 3 preferences / 2 ratings), persisted
path/null updates, core reimport preservation, transaction rollback, unknown
movies, invalid types, repeated upgrades, unchanged public DTOs and explicit
disposable downgrade/re-upgrade.

See [T26 evidence](evidence/s3-t26-backdrop-storage.md) for actual results and
the distinction between synthetic tests and a local catalogue-copy smoke.
