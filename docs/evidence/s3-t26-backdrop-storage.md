# S3-T26 — nullable backdrop storage verification

Task: [#129](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/129).
Date: 17 October 2026 (Asia/Saigon).
Base: `1c44eacd75360aef4abc8b4f55fbab2b27f17c2f`, including merged T23 / PR #178.
Scope and handoff: [backdrop-storage-contract.md](../backdrop-storage-contract.md).

## Admission and evidence identity

The human PO confirmed in this chat that PO and Sprint 3 SM Huy had agreed to
open G3 and proceed. This records the PO's confirmation, not a fabricated
GitHub approval/comment on behalf of the SM. The task was reread on GitHub
before implementation; #125 was Closed and local `main` was fast-forwarded
before creating `feature/s3-t26-backdrop-storage`.

This record describes the tested working tree over the base above. Source
SHA-256 values below identify the UTF-8/LF implementation/test files without
inventing a future commit SHA or creating a self-referential evidence commit.
The PR supplies the final single-commit identity. Independent review/merge
are still required and are not claimed by local tests.

| Tested file | SHA-256 |
|---|---|
| `backend/app/db/models.py` | `592206f32dea31591f4fe0be80f82b10d78cbfc762e0ab93689531af6e0f28b3` |
| `backend/app/repositories/movies.py` | `fa75e5d3c9359b845c24d34d075707ffc7ea5080876b4577f13b4fef212e835c` |
| `backend/alembic/versions/c6f8a2d4e901_add_movie_backdrop_path.py` | `5267579c069f613890792ad06d24ffc47355eb2411e172bcef055f31484cc242` |
| `backend/tests/test_backdrop_storage.py` | `1ca2a2c4167344a7155edd87cf5f740d4b2dbee7ac020cfc9b99dc111f17a2cc` |

## Actual local results

Environment: Windows, Python 3.12.6, Node 24.19.0, npm 11.17.0; installed locked
dependencies. Backend tests used disposable migrated SQLite databases with
`TMDB_READ_ACCESS_TOKEN` blank, never the configured development DB.

| Check | Observed result |
|---|---|
| Initial missing-behaviour assertion, before implementation | 1 genuine failure: migrated `catalog_movies` lacked `backdrop_path` |
| Backend suite after T26 | **394 passed, 1 skipped**, 137.60 seconds |
| New focused checks | All **15** T26 cases passed as part of that full suite; 14 cases also passed in the earlier focused run before the DTO-compatibility case was added |
| Existing frontend suite (frontend source unchanged) | **222 passed**, 19 files |
| Backend Ruff / frontend ESLint / frontend build | Passed |
| Fresh migration graph | One head, `c6f8a2d4e901`, directly after `b7e4c2d91f30` |
| Alembic metadata consistency | `No new upgrade operations detected.` |
| Whitespace check | `git diff --check` passed |
| Real-browser S04/S13 regression on the new migrated synthetic DB | **10 passed, 1 intentionally skipped** live-provider case, 22.5 seconds; temporary DB removed |
| Independent clean checkout with a newly created Python 3.12 venv | Locked install, editable backend install, fresh migration, metadata check and Ruff passed; **16 passed** focused storage + health tests in 19.66 seconds |

The one existing backend skip is the historical rating placeholder in
`test_auth_catalogue_handoff.py`; T26 adds no skip. The existing
Starlette/httpx deprecation warning remains. Initial Windows-sandbox test runs
had TestClient/temporary-file restrictions; equivalent runs outside that
sandbox passed without changing production code to hide a test failure.

### Genuine initial failure

Before adding the production field/migration, this command failed on the
missing-column assertion, not an import/syntax error:

```powershell
.\.venv\Scripts\python.exe -m pytest backend/tests/test_backdrop_storage.py::test_fresh_migration_creates_nullable_backdrop_storage -q
```

```text
assert "backdrop_path" in columns
AssertionError: The migrated catalogue needs backdrop storage
1 failed in 2.04s
```

The final suite contains the same behavioural assertion. This was a local
test-first run over the base, not a claim that separate RED/GREEN commits exist;
the requested delivery contains one commit.

## Synthetic preservation and repository coverage

The migrated fixture contains two accounts, two sessions, three saved genre
associations, two ratings, active/inactive catalogue revisions and movie/genre
links. The tests compare every existing application row and all prior PK,
unique, FK, CHECK and index definitions before/after upgrade.

They also verify path/null durability, unchanged core fields and active order,
preservation across existing core reimport, caller-transaction rollback,
unknown ID rejection, four invalid input types, repeated upgrades, unchanged
public DTOs, uniqueness/FK enforcement and explicit disposable downgrade then
re-upgrade. Tests never fetch TMDb or require real image files.

## Local TMDb catalogue-copy upgrade smoke

An SQLite backup was taken through a **read-only** connection to `data/app.db`
into an operating-system temporary directory. Only the copy was migrated and
smoke-tested. Connections were explicitly closed/disposed; the temporary copy
was removed after verification. No DB dump is included in this PR.

| Property | Before / after |
|---|---|
| Migration on copy | `b7e4c2d91f30` → `c6f8a2d4e901` |
| Active provider | `tmdb` → `tmdb` |
| Active movie count | **255 → 255** |
| Existing application tables/rows | All 9 tables and every pre-existing row preserved |
| Prior constraints | Preserved |
| Foreign-key violations | 0 |
| Null backdrop rows after upgrade | **267** total stored movies, including inactive rows; not just 255 active movies |
| Local `/health`, `/api/movies`, movie details on upgraded copy | 200 / 200 / 200 |
| Public DTO | Unchanged; no `backdropUrl` yet |
| TMDb token/network import | Not used; this is an upgrade smoke, not a fresh live-import claim |

Original `data/app.db` SHA-256 before and after the smoke:
`798104c14653ea4ed4cd4c11681d71533ccc0045d59b52f4a2dfe9247f6adb94`.

The original development DB was **not** migrated or edited. Run the normal
upgrade before starting the app with the new model; existing paths remain null
until #130 imports them. Backdrop images will not appear from T26 alone.

## Reproduce

From the repository root, using the project's virtual environment:

```powershell
.\.venv\Scripts\python.exe -m pytest backend/tests/test_backdrop_storage.py -v
.\.venv\Scripts\python.exe -m ruff check backend
.\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini heads
```

For the full backend suite, configure a **separate** SQLite `DATABASE_URL`, blank
token and apply `alembic upgrade head` first; `test_health` reads that database's
migration table. Do not overwrite an existing `.env` or activate the M2 seed in
the development database to run these tests.

Frontend regression commands:

```powershell
npm.cmd --prefix frontend run test -- --run
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run build
npm.cmd --prefix frontend run test:s04:e2e
```

The browser runner migrates its own synthetic DB, starts its own loopback
servers and removes its temporary database. The live-provider S13 test is
intentionally skipped without its separate opt-in environment; it is not a
failed case or a claim of a new live import.

## Remaining boundaries

- Independent review, hosted CI and merge are separate completion conditions.
- T27 / #130 owns validated provider mapping/enrichment and nullable HTTPS URLs.
- The S3-T37 UI task owns visible backdrop, gradient and image-load fallback.
- T28 / #131 owns complete independent DB/import/API/browser acceptance.
- No Story AC/point change, UI/image screenshot claim, or completion of #19,
  #130, #131 or the UI task is made by this storage-only PR.
