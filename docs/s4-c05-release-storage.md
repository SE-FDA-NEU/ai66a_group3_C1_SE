# S4-C05 build, startup and SQLite recovery runbook

Issue [#219](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/219).
The [root pytest setup](SETUP.md#direct-pytest--early_test_setup-219) supplies
isolated migrations. The user-approved 2026-11-01 amendment limits default
pytest to 40 P0 cases; broader regressions remain explicit/manual. This runbook
covers the final candidate. Use the actual selected SHA and migration head in the
[C05 evidence](evidence/s4-c05/README.md); older S3/T18 records are baselines.

## Release inventory and boundaries

Record the real release-local or deployed value for each row before declaring
the candidate ready. Do not infer a deployed service from a passing local test.

| Item | Required record and rule |
|---|---|
| Executable | Git commit, Python 3.12, Node 24, lockfile hashes and built `frontend/dist` hashes. Rebuild after any source/config/schema change. |
| Persistent SQLite | Absolute `DATABASE_URL` path retained across process restarts, writable by the backend and migration operator, outside the served frontend. Keep the database and its `-wal`/`-shm`/`-journal` sidecars on the same storage. A deployment needs a durable volume, not an ephemeral container layer for account data. |
| Overview index | Absolute `NLP_INDEX_PATH` on persistent storage, generated from the *same* active DB. It is derived data: rebuild and check it after restore/import/corpus or preprocessing changes. Do not silently serve a stale mapping. |
| Secret | `TMDB_READ_ACCESS_TOKEN` only in the backend/importer environment or private root `.env`; blank for CI. Never place it in the frontend build, backup logs or manifest. |
| Service/process | Record local backend start/stop/restart commands, port and health URL; include a deployed service name only if one exists. Health reports the installed migration revision; it does not itself certify catalogue/index readiness. |
| Backup | Explicit, restricted destination outside Git and the public web root. Retention and encryption are operator decisions. Test restoring a disposable copy before relying on it. |

Local build, startup, storage and restart validation is valid release evidence;
record its actual local paths and process commands. This repository provides
application code and local rehearsal. Record deployment-specific values only
for a deployment that actually exists; local results do not establish one.

## Build and start from a fresh folder

Follow [SETUP.md](SETUP.md) for Python 3.12 virtualenv and locked installs.
From the repository root, use one `DATABASE_URL` for migration, import,
index building and the backend process. On Windows without activating the venv,
replace `python` below with `.\.venv\Scripts\python.exe` and `npm` with
`npm.cmd`. Before the importer, configure a private TMDb token on the server.

```text
npm --prefix frontend ci
npm --prefix frontend run lint
npm --prefix frontend run build
python -m alembic -c backend/alembic.ini heads
python -m alembic -c backend/alembic.ini upgrade head
python -m alembic -c backend/alembic.ini current
python -m app.cli.import_tmdb_catalogue --pages 50
python -m app.cli.import_tmdb_catalogue --enrich-trailers --all
python -m app.cli.rebuild_overview_index rebuild
python -m app.cli.rebuild_overview_index check
python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

Run `GET http://127.0.0.1:8000/health`, `GET /api/movies`, one detail request,
Search description mode and Similar against that same backend. Health must
return `status=ok`, `database=connected`, and a `migrationVersion` equal to the
single `alembic heads` result. Record the actual distinct active TMDb movie
count (target: about 1,000; `--pages 50` returns up to 1,000 raw rows before
deduplication/validation) and confirm the unfiltered list's `meta.total` agrees
with that active count.
Search/Similar need an index built for the active catalogue.
The runtime never imports TMDb metadata or fits TF-IDF per request. CI/tests
use synthetic provider fixtures and no token/network; they are separate from
this mandatory live-catalogue provisioning step. Never use the M2 seed to
claim live acceptance.

For an existing imported catalogue, make a consistent backup first, run
`upgrade head`, and keep the existing active snapshot. Do not run a default
import just to add media. See [SETUP.md](SETUP.md#existing-catalogues-migrate-and-enrich-every-movie)
for the current `--enrich-posters --all`, `--enrich-backdrops --all` and
`--enrich-trailers --all` commands. Each mode is a separate invocation; 300 is
a batch limit, not a catalogue limit with `--all`. Media-only updates preserve
account data, catalogue IDs and overview-index corpus inputs. Rebuild/check the
index after core import or any overview, active-ID or preprocessing change;
`check` must fail if the artifact is missing, corrupt or mismatched.

## Consistent backup and non-destructive restore

`storage_snapshot` accepts explicit file paths and uses SQLite's online backup
API. It includes committed WAL pages, checks integrity, foreign keys and a
single Alembic revision, then publishes an exclusive destination. Both backup
and restore must reject an existing destination DB **or any destination
`-wal`, `-shm` or `-journal` sidecar**, even if the DB file is absent. A leftover
hot rollback journal can replay unrelated data into a new file. Choose another
unused destination; do not delete sidecars to bypass the refusal. Keep that
destination unused by other processes throughout the operation, since file
checks cannot prevent a concurrent process creating a sidecar afterward.
The tool does not read `.env`, send data over a network,
log account values or replace the live database. Use a restricted backup
directory; a backup contains account records and password hashes.

With `DATABASE_URL=sqlite:///./data/app.db` on Windows, for example:

```powershell
$backup = 'data/backups/release-before-upgrade.db'
.\.venv\Scripts\python.exe -m app.cli.storage_snapshot inspect data/app.db
.\.venv\Scripts\python.exe -m app.cli.storage_snapshot backup data/app.db $backup
.\.venv\Scripts\python.exe -m app.cli.storage_snapshot inspect $backup
```

For restore, **stop all app/importer writers**. Restore into a new path on the
persistent storage, not over the old file or any of its sidecars. The old database
remains available for investigation or a controlled rollback.

```powershell
$recovered = 'data/recovered/app.db'
# Create the directory first; the DB and its -wal/-shm/-journal must not exist.
.\.venv\Scripts\python.exe -m app.cli.storage_snapshot restore $backup $recovered
$env:DATABASE_URL = 'sqlite:///./data/recovered/app.db'
$env:NLP_INDEX_PATH = 'data/recovered/overview-tfidf-v1.json'
.\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini upgrade head
.\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini current
.\.venv\Scripts\python.exe -m app.cli.rebuild_overview_index rebuild
.\.venv\Scripts\python.exe -m app.cli.rebuild_overview_index check
```

Confirm the recovered account/preference/rating/watchlist counts, active
revision and stable movie IDs against the pre-failure record. `PRAGMA
foreign_key_check` must be empty (the tool enforces it). Restart the backend
with the recovered `DATABASE_URL` and `NLP_INDEX_PATH`, check `/health`, list,
detail, Search and Similar, then sign in as two non-empty test accounts and
verify their own saved preferences, ratings and watchlists remain separate.
Use the existing reset endpoint only as an explicit account action; reset
deletes that account's preferences/ratings while retaining catalogue, media,
index and both watchlists. Reimporting the same provider movie preserves its
opaque ID and saved memberships. Avoid Alembic downgrade on populated data:
some downgrade paths drop account tables. For schema rollback, promote an
earlier consistent backup to another new path, then run the compatible code
and migration/index checks before switching service configuration.

If backup/restore inspection fails, keep the current service/DB untouched.
If migration fails, do not start the new code against the old schema; inspect
the error and restore a verified snapshot to a new path. If index `check`
fails, rebuild from that exact DB; a failed rebuild keeps index-dependent
endpoints unavailable rather than serving a mismatched mapping.

## Offline release checks and review

From a newly cloned folder, only the Python 3.12 virtualenv, locked Python
dependencies and editable backend install in [SETUP.md](SETUP.md#verify) are
needed for the fast P0 check. Both root `pytest` and `python -m pytest -v`
select **40 Section 2 P0 cases only**, in `tests/test_p0_acceptance.py` and
`tests/test_s03_details.py`. Temporary migrations are automatic; no npm install,
`.env`, server, real DB, TMDb token or live network is needed to execute them.
Keep actual verbose output, elapsed time, platform/tool versions and SHA.

Main CI's `Python tests`, `Node build and tests` and secrets jobs remain
automatic: 40 P0 cases plus a few affected storage/bootstrap tests, lint,
frontend build and secrets checks. The effective main-branch rules require
teammate approval only, with no required status contexts. Existing
feature/browser workflows retain their names and are manual-only
`workflow_dispatch` workflows. `Optional extended regression` has `run_python`
and `run_vitest` boolean inputs. Broad backend/frontend/browser/script and
volume regressions remain available explicitly; running every tier is not
mandatory on every push or for local release validation. See
[Optional regressions](SETUP.md#optional-regressions).

Focused C05 acceptance still includes the build/startup, migration, health,
catalogue/index and restart checks above, plus the storage rehearsal below.

Run the storage rehearsal with
`python -m pytest -c pytest.ini backend/tests/test_storage_snapshot.py -v`. It seeds a
migrated SQLite file with non-empty A/B accounts, preferences, ratings,
watchlists, posters, backdrops and trailer metadata; backs up uncheckpointed
WAL data; restores into a new file; validates rows/FKs/IDs; rebuilds and reads
the index; checks reset/reimport boundaries; and imports the restored DB in a
new API process. Confirm destination-file and `-wal`/`-shm`/`-journal` refusal
without altering the existing files. Record only checks actually run for the
selected candidate in the [C05 evidence](evidence/s4-c05/README.md), including
the candidate handed to C02/C04 and S5-C02; historical records are not fresh
results. Independent non-author rehearsal on a fresh clone is still required
before closing #219.
