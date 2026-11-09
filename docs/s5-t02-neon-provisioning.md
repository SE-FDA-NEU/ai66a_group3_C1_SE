# S5-T02 Neon provisioning and NLP startup handoff

This runbook supplies the operator sequence for [#249](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/249). Record live results after executing each command against the named target. Keep database credentials, TMDb/session tokens, dumps and personal user details in private storage. Public documentation may include app-only review logins approved by the PO.

## Targets and access

1. In Neon, create a project with PostgreSQL **18** in the available Singapore region. Record the actual region identifier and `server_version`. If a PostgreSQL 17 target already contains useful data, stop and arrange a verified backup/migration with its owner before changing connections.
2. Identify the public runtime, development and test targets separately. Give the runtime role application access, and give migration/import privileges to the intended operator role. Identify the primary and backup operators and independently verify their assigned access. Record actual target/role names and results, with connection values kept in private configuration. Configure certificate verification with `sslmode=verify-full` and a trusted CA bundle. The app uses `DATABASE_URL` with the `postgresql+psycopg://` scheme. `psql` uses `NEON_OPERATOR_PSQL_URL` with the `postgresql://` scheme. On Windows, the locked Python dependencies supply a CA bundle for both clients.

   ```powershell
   $env:PGSSLROOTCERT = (.\.venv\Scripts\python.exe -c "import certifi; print(certifi.where())").Trim()
   ```
3. **Before migration**, run only a connection/identity/TLS query, which does not depend on application tables. In PowerShell from the repository root, check that the private URL is present, then run this once for the primary operator and independently for the backup operator:

   ```powershell
   if (-not $env:NEON_OPERATOR_PSQL_URL) { throw "Set the intended Neon operator URL privately first" }
   psql "$env:NEON_OPERATOR_PSQL_URL" -X -v ON_ERROR_STOP=1 -c '\conninfo'
   psql "$env:NEON_OPERATOR_PSQL_URL" -X -v ON_ERROR_STOP=1 -c "SELECT current_user, current_database(), current_setting('server_version') AS server_version, (SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()) AS backend_tls_active;"
   ```

   Confirm PostgreSQL major 18, the intended effective database/role, and the client's SSL connection/protocol/cipher in `\conninfo`. Record the private configuration's `verify-full` setting and selected Singapore region. `pg_stat_ssl` describes the PostgreSQL backend connection. On the live Neon endpoint, that value was false while libpq reported a verified TLS 1.3 client connection. Keep the backend statistic as diagnostic evidence and use client TLS information for the external connection. Run the full readiness script after migration, when its application tables exist. [PostgreSQL client connection information](https://www.postgresql.org/docs/18/app-psql.html), [PostgreSQL backend SSL statistics](https://www.postgresql.org/docs/18/monitoring-stats.html#MONITORING-PG-STAT-SSL-VIEW)
4. Set `DATABASE_URL` privately to the **same confirmed target**, using the migration role, then run the schema upgrade from the repository root:

   ```powershell
   .\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini heads
   .\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini upgrade head
   .\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini current
   .\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini check
   ```

   The single `current` revision must equal the repository's current `heads` result, and `check` must pass. Only now run the full, read-only readiness script; it reads `alembic_version` and application tables:

   ```powershell
   psql "$env:NEON_OPERATOR_PSQL_URL" -v ON_ERROR_STOP=1 -f scripts/s5_t02_readiness.psql
   ```

   Before import, zero active movies or no active revision is expected on a fresh target. T01's PostgreSQL 18 migration is in main at `70be2d2`. Supply no production credentials to the isolated pytest target.

### Runtime permissions and separate databases

The live target uses `neondb` for the public runtime candidate, `cineai_development` for development, and `cineai_test` for integration tests on the same endpoint. Set the database component of each private URL explicitly. The PostgreSQL integration fixture creates and removes isolated schemas inside `cineai_test`.

On a new project, an operator can create the development and test databases with `CREATE DATABASE cineai_development` and `CREATE DATABASE cineai_test`. Apply migrations to development, then populate its catalogue using the explicit import commands with that database's operator URL. The 9 November handoff populated the empty development target by copying the five public catalogue tables, with account tables checked empty before and after the operation. The copied tables were `catalogue_revisions`, `genres`, `catalog_movies`, `movie_genres`, and `catalogue_state`. Create development app accounts through their normal provisioning or registration entry points.

Create the runtime role through SQL and set its password using the hidden `psql` prompt. Check existing roles before executing the creation step on a populated project.

```sql
CREATE ROLE cineai_runtime LOGIN;
\password cineai_runtime
GRANT CONNECT ON DATABASE neondb TO cineai_runtime;
GRANT USAGE ON SCHEMA public TO cineai_runtime;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO cineai_runtime;
GRANT INSERT, UPDATE, DELETE ON TABLE
    users, auth_sessions, user_genre_preferences,
    user_movie_ratings, user_movie_watchlist
TO cineai_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT ON TABLES TO cineai_runtime;
```

Run the schema/table grants in the development database after migration. Future migrations should verify the privileges required by newly created tables. Default privileges apply to objects subsequently created by the operator executing that statement. The runtime process receives its own private `DATABASE_URL`. Migration, account provisioning and TMDb import commands receive the operator URL.

## Explicit catalogue and account operations

Use a private `TMDB_READ_ACCESS_TOKEN` with `DATABASE_URL` confirmed as the intended Neon development/public target. Capture stdout in private operations evidence, excluding environment values and request headers. Import is deliberately an operator action; it is absent from app startup. Target about 1,000 valid movies, but record the actual count rather than treating 1,000 as an exact requirement.

```powershell
.\.venv\Scripts\python.exe -m app.cli.import_tmdb_catalogue --pages 50
.\.venv\Scripts\python.exe -m app.cli.import_tmdb_catalogue --enrich-posters --all
.\.venv\Scripts\python.exe -m app.cli.import_tmdb_catalogue --enrich-backdrops --all
.\.venv\Scripts\python.exe -m app.cli.import_tmdb_catalogue --enrich-trailers --all
.\.venv\Scripts\python.exe -m app.cli.rebuild_overview_index rebuild
.\.venv\Scripts\python.exe -m app.cli.rebuild_overview_index check
psql "$env:NEON_OPERATOR_PSQL_URL" -v ON_ERROR_STOP=1 -f scripts/s5_t02_readiness.psql
```

Record `inserted`, `updated`, `rejected`, each `rejection_reason[...]`, `movies`, `active_revision`, sampled app movie ID ↔ TMDb ID pairs, corpus digest, config fingerprint and index readiness. The import validates and deduplicates all 50 fetched pages before activation. Each media `--all` traverses the active catalogue in batches of at most 300; the batch size is not a catalogue cap. Reconcile eligible/processed/missing/failed/remaining counts and the final SQL availability counts. Trailer `--all` may resume earlier attempts; missing legitimate media is allowed. Resolve or explicitly record failed/incomplete requests before acceptance.

Provision only intended public app-only review accounts via T01's guarded operator command. Supply the password through a distinct secret environment variable and confirm the host/database values independently of the URL. The command refuses a mismatched or redirected target and will not overwrite an existing credential:

```powershell
.\.venv\Scripts\python.exe -m app.cli.provision_account `
  --database-url-env DATABASE_URL `
  --expected-host <confirmed-neon-host> `
  --expected-database <confirmed-database> `
  --operator <primary-operator-name> `
  --email <intended-demo-email> `
  --password-env REVIEW_ACCOUNT_PASSWORD
```

Confirm each account through the backend connected to that same imported Neon target. Prepare two accounts, A and B, with different genres, half-star ratings and Watchlists. Reload, sign out/in, and verify each account's actual saved values and ownership, including sessions. Record a baseline of movie identity and A/B data; explicitly import again with `--pages 50`, then compare the same TMDb IDs to app movie IDs and each account's rows and values. A new active revision is normal; losing an app movie ID or account-owned value is not. Share only approved demo login values with T08 through the approved private handoff. Do not publish operator or database credentials.

## Neon-backed restart and handoff

T02 runs the backend locally or on staging against the **real Neon target** and records that environment explicitly. Set `APP_ENV=production`, `DATABASE_URL` and a writable disposable `NLP_INDEX_PATH` for that process (for example a file under the operating system temporary directory). With no explicit path, production uses the operating system temporary directory. Start from the repository root with `python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000` (or `./.venv/bin/python` on POSIX and `.\.venv\Scripts\python.exe` on Windows). The app checks the active catalogue, corpus digest and NLP config fingerprint at startup; it reuses a matching artifact or atomically builds a missing/stale one. A fresh database with no active catalogue can start for T03's early baseline. A real preparation failure stops startup. Runtime requests never fetch TMDb metadata.

Verify a valid index on one startup; delete **only** the derived index file on the test instance and restart to prove rebuilding from Neon; also verify a stale index is rebuilt, using the focused fixture plus an appropriate live check. After each restart, run `check`, description Search and Similar, and verify the exact A/B preferences, sessions, half-star ratings and Watchlists again. An artifact deletion affects only derived data; PostgreSQL account rows remain. The documented Uvicorn command emits the `NLP index ready` record through its INFO logger; confirm that record appears before relying on it. Record its revision, digest, config, movie/usable-document counts and `elapsed_seconds`, plus observed CPU/memory from a named tool on the actual machine/environment. Local/staging numbers are labelled local/staging; they are never reported as Render numbers.

T02 can complete after these Neon-backed checks and an eligible review; it does not wait for T03's Render deployment or T04's provider/link enrichment. T03 independently verifies startup/readiness on Render after handoff. Give T03 the environment variable names, startup command, index path and Neon-backed readiness/restart results; give T04 the active revision, real TMDb IDs and PostgreSQL 18 connection interface for VN providers and `watchOptionsUrl`; give T08 the actual setup/results and approved test-account handoff. T04 owns provider schema, enrichment and DTO; T05 owns the TMDb button.

## Evidence record

Actual results and the final-review status for this delivery are recorded in the acceptance record. Record a new run against its own commit and target when refreshing these results. [9 November 2026 Neon acceptance](evidence/s5-t02-neon/README.md)

| Item | Actual result |
| --- | --- |
| Tested commit / date / machine / Neon-backed environment | App source `96d4f3b`, 9 November 2026, Windows/Python 3.12.6, local backend connected to Neon |
| Runtime / development / test target and role names | `neondb`, `cineai_development`, `cineai_test`; `cineai_runtime` and operator `neondb_owner` |
| Neon region / server version / certificate verification / TLS | AWS `ap-southeast-1` Singapore, PostgreSQL 18.6, `verify-full`, client TLS 1.3 with channel binding |
| Primary and backup effective access and privileges | Kiệt primary, Nguyễn Tuấn Anh backup with self-connect confirmed by PO, same `neondb_owner`; effective DDL probe passed and rolled back |
| Migration head/current/check and pre-import readiness | `a3d1f8b72c44`, check passed, initially empty application tables |
| 50-page accepted / inserted / updated / rejected by reason / active revision / identity pairs | 989 accepted, 989 inserted initially, 989 updated on repeat, 11 duplicate IDs rejected each run; active `1ee08003-bc00-4888-b35c-8c6cbe599062`; real ID samples in checks log |
| Whole-catalogue poster / backdrop / official trailer processed/missing/failed/remaining | Each processed 989 with 0 remaining; availability 989 posters, 986 backdrops, 882 official trailers; trailer requests had 0 failures |
| Corpus digest / config fingerprint / index ready | 989 movies, 988 usable docs, check ready; full digest/config values in acceptance record |
| Public review-account login and exact A/B data ownership | Guarded provisioning, real HTTP login/logout/later-login, distinct genres, 3.5/4.5 ratings and Watchlists passed |
| Repeated import and account data | All 989 common app movie IDs stable, exact fingerprints of all five account tables matched |
| Local/staging Neon-backed startup recovery and resources | Valid/missing/stale passed, health ready in 3.203–3.766 s, actual server working set 92.54–94.49 MiB; Search/Similar/session persistence passed |
| T03 Render recheck | Separate downstream T03 evidence |

Attach the actual commands and redacted output to the evidence record. Local synthetic tests and a local PostgreSQL 18 fixture establish code behaviour only; they do not fill the Neon-backed results above. T02 hands the results to T03/T04/T08, then checks CI and obtains substantive approval from an eligible non-contributing reviewer before closure.
