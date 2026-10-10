# S3-T02 atomic genre replacement evidence

Issue: [#104](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/104)

Parent Story: [#17 / S01](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/17)

Dependency: merged S3-T01 preference storage/read implementation (PR #147)

Branch: `s3-t02-atomic-genre-preferences`

Base: `upstream/main` at `5251a88ab40daa46dcc12decfab56f01d30417d7`

Tested implementation commit: [`1fabe4ca19873ac04ae895d0421e8f62059b99c4`](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/commit/1fabe4ca19873ac04ae895d0421e8f62059b99c4)

Verification date: 2026-10-10; Windows, Python 3.12.6

## Delivery and transaction boundary

`PUT /api/me/preferences` accepts exactly `{"genreIds": [...]}` with 1-5
distinct strict integer IDs. Strings, floats, booleans, null, duplicate IDs,
extra fields, and missing/malformed bodies are rejected. Every ID must exist
in local canonical `genres`; it need not currently occur in the active
catalogue. Unknown IDs are rejected before any preference deletion.

The account comes only from the valid `ams_session` cookie. A query/header
cannot select another account. Browser writes reuse the existing same-origin
Fetch Metadata/Origin policy; the Vite same-origin proxy remains supported.

The repository prepares one replacement in the request's database transaction:

1. Validate all canonical IDs before deletion.
2. Delete only the authenticated user's old rows.
3. Insert the complete new set and flush.
4. Prepare the response sorted by genre name, then ID.
5. Commit once in the route; return `200` only after commit succeeds.

An insert or commit error triggers rollback and a safe `503`. Preparing the
response before commit avoids a new database read failing after a successful
write. No new T02 migration is needed: T01's existing migration head is
`9d2f5a1c3b84`. Preferences remain account-owned SQLite rows and requests do
not call TMDb or expose its credentials.

## Automated acceptance matrix

All cases below passed in `backend/tests/test_preferences_api.py`:

| Case | Verified result |
|---|---|
| One / five existing distinct IDs | `200`; exact sorted DTO; a fresh database Session reads the committed complete set |
| Zero / six IDs, duplicates, wrong types, malformed/missing body, extra fields | `400 VALIDATION_ERROR`; previous set unchanged |
| Unknown ID or a mixture of valid and unknown IDs | `404 GENRE_NOT_FOUND`; previous set unchanged |
| Integer outside SQLite's signed 64-bit range | Safe `404 GENRE_NOT_FOUND`, not an uncaught driver overflow |
| Replace `[28,35]` with `[18]`, then repeat | Exactly `[18]`, not an append and no duplicates |
| Missing, invalid, expired, revoked session | `401 AUTHENTICATION_REQUIRED`; no preference mutation |
| Forged account query/header | Only the session account changes; the second account retains its selection |
| Cross-origin, null Origin, cross-site/same-site Fetch Metadata | `403 ORIGIN_NOT_ALLOWED`; previous set unchanged |
| Same-origin browser metadata through Vite proxy | `200` |
| Insert fault after DELETE has executed | `503 SERVICE_UNAVAILABLE`; rollback restores old selection and preserves the second account |
| Commit fault after DELETE and INSERT have executed | Same rollback guarantees, verified through a fresh database Session and subsequent GET |
| Canonical genre unused in the active revision | Accepted; PUT/GET remain local-only even when provider access is forbidden in the test |

Error assertions verify the exact public message and `req_<32 hexadecimal
characters>` request ID. Database exception details are not returned.

## Reproducible checks

Run from the repository root in PowerShell. These automated tests use synthetic
fixtures/mocks, not live provider responses or a real TMDb token.

```powershell
$env:PYTHONUTF8 = "1"
$env:PYTHONPATH = (Resolve-Path backend).Path
$taskT02TestDatabase = Join-Path $env:TEMP ("s3-t02-" + [guid]::NewGuid().ToString("N") + ".db")
$env:DATABASE_URL = "sqlite:///" + $taskT02TestDatabase.Replace('\', '/')

.\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini upgrade head
.\.venv\Scripts\python.exe -m pytest backend/tests/test_preferences_api.py backend/tests/test_preference_migration.py -q
.\.venv\Scripts\python.exe -m pytest backend/tests -q
.\.venv\Scripts\python.exe -m ruff check backend
git diff --check
```

Recorded results on the tested implementation commit:

- Focused API/migration suite: **56 passed**, 1 warning, 11.90 seconds.
- Full backend regression: **176 passed, 2 skipped**, 1 warning, 26.26 seconds.
- Whole-backend Ruff: **All checks passed!**
- `git diff --check`: no whitespace errors.
- Existing migration upgrade completed successfully; one head,
  `9d2f5a1c3b84`.

The two skips are pre-existing future rating-write/personalised-recommendation
handoff placeholders, not skipped T02 cases. The warning is the existing
Starlette TestClient/httpx deprecation. Neither is an observed T02 failure.

For just the failure-after-delete checks:

```powershell
.\.venv\Scripts\python.exe -m pytest backend/tests/test_preferences_api.py -k failed_replacement -v
```

The full suite needs a migrated file-backed test database because the existing
health test checks `alembic_version`. A trial using an unmigrated in-memory
database produced `175 passed, 2 skipped, 1 failed` (`test_health_reads_database`
returned `503`); this was a test-setup failure, not a preference-route failure.
The commands above create and migrate an isolated test database instead of
changing the real application database.

Do not leave the test `DATABASE_URL` above set when starting the real
application. Open a new terminal or remove this process-only override first:

```powershell
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
```

The application then loads its configured database from `.env`. No synthetic
seed or test database should replace the mandatory TMDb demo catalogue.

## Manual API reviewer steps

Use the configured local database and the README setup. This checklist is
reproducible guidance, not a claim that a reviewer has already performed it.

```powershell
$env:PYTHONUTF8 = "1"
.\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --reload
```

1. Open `http://127.0.0.1:8000/docs`. Register a disposable account if needed,
   then execute `POST /api/auth/login` on this same host. The browser stores
   the HttpOnly session cookie; do not paste it into evidence.
2. Execute `GET /api/genres`. Select IDs actually returned by this local
   catalogue; do not assume a hard-coded demo ID exists. No active catalogue
   must be addressed with the documented TMDb import, not an invented list.
3. Execute `PUT /api/me/preferences` with one valid ID. Expect `200` and one
   genre in `data.genres`. Execute GET preferences and verify the same result.
4. Save a different valid set of up to five distinct IDs. GET must contain
   only that new set, sorted by name then ID. Repeating the save must not
   create duplicates.
5. Try an empty list, a duplicate ID, a string ID, and six IDs. Each must
   return `400`; GET must still show the last successful set. An ID confirmed
   absent from canonical genres must return `404` without modifying it.
6. Sign out and try a valid PUT again. Expect `401`. After signing back in,
   GET must retain the last successful selection. Use a separate browser
   profile/account to verify that the second account's selection is unchanged.
7. Run the automated rollback and cross-origin cases above. Do not deliberately
   corrupt the real database to reproduce an injected test failure.

## Scope and closure gates

The backend implementation and local checks are complete. CI on the final PR
and independent review are still required before closing #104.

| Evidence field | Current state |
|---|---|
| Tested implementation commit SHA | `1fabe4ca19873ac04ae895d0421e8f62059b99c4`; the following evidence-only commit does not change implementation |
| Implementation PR | Pending manual creation from `s3-t02-atomic-genre-preferences` into `main` |
| Independent review URL | Pending review by someone other than the author |
| Remote CI result | Pending publication |

Record the PR and independent review URLs after publication. Do not label the
base SHA as the tested implementation commit. Rerun the checks if
implementation changes after this verification.

T02 does **not** close Story #17. Remaining ownership includes T03's broader
persistence/isolation acceptance, T04/T05's genre controls and save/restore UI,
and the later integrated S01 acceptance journey. Personalised recommendations
and ratings are separate tasks; saving genres alone does not yet change the
current popular/cold-start recommendation response.
