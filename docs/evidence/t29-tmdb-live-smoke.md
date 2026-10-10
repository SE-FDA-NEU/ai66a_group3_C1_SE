# T29 — TMDb live import and provenance evidence

This record contains no token, `.env` content, database dump, or provider
payload. Automated tests use synthetic fixtures and do not replace the live
server-side import below.

## Status

**Passed — 2026-10-09.** A fresh disposable SQLite database was migrated and
imported from TMDb using the server-only token. The resulting active catalogue
was then queried for provenance and imported a second time to verify a
no-duplicate, stable-ID update. The disposable database was removed after the
checks; it was never committed.

## Record

| Field | Actual value |
|---|---|
| Candidate commit SHA | `76a5857` — final implementation/documentation commit before this evidence record |
| Environment / database path | Windows local; disposable SQLite `data/t29-live-<generated>.db`; removed after verification |
| Tester and date (UTC) | `@kietxuan`, 2026-10-09 |
| Reviewer | `@hoang3003` — pending independent PR review/reproduction |
| DNS check | `api.themoviedb.org` resolved before the live import |
| Migrate command and exit status | `python -m alembic -c backend/alembic.ini upgrade head` → exit 0 |
| First import command and exit status | `python -m app.cli.import_tmdb_catalogue` → exit 0 |
| First active revision / provider | `acb370b0-2592-4d15-be43-a9de84461bee` / `tmdb` |
| First inserted / updated / rejected | `20 / 0 / 0` |
| First movies / associated genres / finite-popularity movies | `20 / 49 / 20` database rows; all 20 movies had finite popularity |
| First source fetch/import timestamps | `2026-10-09T13:33:39.403783Z` / `2026-10-09T13:33:40.582052Z` |
| Sample provider source IDs | `969681`, `1423191`, `1368337` — provider IDs only, not credentials |
| Provenance query | 20 active `tmdb` rows; 0 non-TMDb rows; 0 duplicate `(source, source_id)` pairs |
| Second import command and exit status | `python -m app.cli.import_tmdb_catalogue` → exit 0 |
| Second active revision / counts | `48037f1e-ee8c-4241-b130-b5bccadd5677`; inserted `0`, updated `20`, rejected `0` |
| Reimport stability verification | 20 total catalogue rows and 0 duplicate source pairs. Retained source IDs `1368337` and `1423191` kept their original internal IDs; source ID `969681` was retained in the active revision. |
| Runtime endpoint/restart check | The application was run manually by the tester. This automated evidence session could not bind or reach a loopback Uvicorn port, so it does not claim a second automated browser/API result. C04 must reproduce the documented API checks from a clean clone on an ordinary local environment. |
| Blockers or deviations | None for the live TMDb import. Loopback socket binding in the automated Windows sandbox is a verification-environment limitation only; it did not affect migration, import, provenance, or reimport checks. |

## Offline checks recorded by this task

- `python -m pytest backend/tests/test_tmdb_import.py backend/tests/test_tmdb_import_cli.py -k "not public_movie_routes" -q --basetemp .\\data\\t29-pytest` → **16 passed, 1 deselected**.
- `python -m pytest backend/tests/test_m2_catalogue_bootstrap.py -q --basetemp .\\data\\t29-bootstrap-pytest` → **3 passed**.
- `python -m ruff check backend` → **passed**.
- Synthetic provider-boundary tests cover missing/invalid credentials,
  provider/payload/database failure, rollback on fresh and existing databases,
  stable internal IDs on reimport, and no browser/runtime TMDb import.
- The CLI prints only safe operator provenance. The token is never printed,
  placed in a DTO, committed to a fixture, or used by CI.
