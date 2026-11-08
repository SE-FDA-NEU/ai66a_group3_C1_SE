# S5-T02 Neon provisioning and NLP startup handoff

This runbook supplies the operator sequence for [#249](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/249). Record live results only after executing each command against the named target. Never paste a connection string, password, TMDb token, database dump, email or session token into Git or a public issue.

## Targets and access

1. In Neon, create a project with PostgreSQL **18** in the available Singapore region. Record the actual region identifier and `server_version`. If a PostgreSQL 17 target already contains useful data, stop and arrange a verified backup/migration with its owner before changing connections.
2. Identify the public runtime, development and test targets separately; tests must not use the target holding public data. Give the runtime role only application access, and give migration/import privileges to the intended operator role. Identify the primary and backup operators and independently verify each can connect and exercise the privileges assigned to them. Record actual target/role names and results, never private URLs. Configure certificate verification (`sslmode=verify-full`); the query below proves that this session uses TLS, while the private connection configuration proves certificate verification. The app uses `DATABASE_URL` with the `postgresql+psycopg://` scheme; `psql` uses a separate `NEON_OPERATOR_PSQL_URL` with the `postgresql://` scheme.
3. **Before migration**, run only a connection/identity/TLS query, which does not depend on application tables. In PowerShell from the repository root, check that the private URL is present, then run this once for the primary operator and independently for the backup operator:

   ```powershell
   if (-not $env:NEON_OPERATOR_PSQL_URL) { throw "Set the intended Neon operator URL privately first" }
   psql "$env:NEON_OPERATOR_PSQL_URL" -v ON_ERROR_STOP=1 -c "SELECT current_user, current_database(), current_setting('server_version') AS server_version, (SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()) AS tls_active;"
   ```

   Confirm PostgreSQL major 18, the intended effective database/role and `tls_active = true`. Record the selected Singapore region from Neon separately. Do not run the full readiness script on a new, unmigrated database: its first application-table read would fail.
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

## Evidence record (pending live execution)

| Item | Actual result |
| --- | --- |
| Tested commit / date / machine / Neon-backed environment | Pending live checks |
| Runtime / development / test target and role names | Pending operator access |
| Neon region / server version / certificate verification / TLS | Pending operator access |
| Primary and backup effective access and privileges | Pending operator access |
| Migration head/current/check and pre-import readiness | Pending live migration |
| 50-page accepted / inserted / updated / rejected by reason / active revision / identity pairs | Pending live import |
| Whole-catalogue poster / backdrop / official trailer processed/missing/failed/remaining | Pending live enrichment |
| Corpus digest / config fingerprint / index ready | Pending Neon-backed check |
| Public review-account login and exact A/B data ownership | Pending live target |
| Repeat import: stable identity and A/B data | Pending live checks |
| Local/staging Neon-backed valid/missing/stale index; startup time / CPU / memory / Search / Similar / persistence | Pending Neon-backed restart |
| T03 Render recheck | Separate downstream T03 evidence |

Attach the actual commands and redacted output to the evidence record. Local synthetic tests and a local PostgreSQL 18 fixture establish code behaviour only; they do not fill the Neon-backed results above. T02 hands the results to T03/T04/T08, then checks CI and obtains substantive approval from an eligible non-contributing reviewer before closure.
