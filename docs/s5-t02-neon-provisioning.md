# S5-T02 Neon provisioning and NLP startup handoff

This runbook supplies the operator sequence for [#249](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/249). Record live results only after executing each command against the named target. Never paste a connection string, password, TMDb token, database dump, email or session token into Git or a public issue.

## Targets and access

1. In Neon, create a project with PostgreSQL **18** in the available Singapore region. Record the actual region identifier and `server_version`. If a PostgreSQL 17 target already contains useful data, stop and arrange a verified backup/migration with its owner before changing connections.
2. Create separate development and test database targets. Keep the public runtime target separate from tests. Create a least-privilege runtime role and identify the primary and backup operators with migration/import and backup access. Configure TLS with certificate verification. Store each private URL in a secret manager; the app uses `DATABASE_URL` (`postgresql+psycopg://...?...sslmode=verify-full`). The operator's `psql` URL uses the normal `postgresql://` scheme and is supplied separately as `NEON_OPERATOR_PSQL_URL`.
3. On each intended target, run `psql "$env:NEON_OPERATOR_PSQL_URL" -v ON_ERROR_STOP=1 -f scripts/s5_t02_readiness.sql` in PowerShell. The first row identifies the effective role, database, server version and TLS status. Repeat the connection check with the backup operator's private URL. Confirm both actual identities and access in private operations records. Do not treat a role name in a document as proof of access.
4. Run the schema upgrade with the migration role and the **same** intended target selected as `DATABASE_URL`:

   ```powershell
   .\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini heads
   .\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini upgrade head
   .\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini current
   ```

   The single `current` revision must equal `heads`. T01's PostgreSQL 18 migration is in main at `70be2d2`. Supply no production credentials to the isolated pytest target.

## Explicit catalogue and account operations

Use a private `TMDB_READ_ACCESS_TOKEN` with `DATABASE_URL` set to the selected development/public target. Capture stdout in private operations evidence, excluding environment values and request headers. Import is deliberately an operator action; it is absent from app startup.

```powershell
.\.venv\Scripts\python.exe -m app.cli.import_tmdb_catalogue --pages 50
.\.venv\Scripts\python.exe -m app.cli.import_tmdb_catalogue --enrich-posters --all
.\.venv\Scripts\python.exe -m app.cli.import_tmdb_catalogue --enrich-backdrops --all
.\.venv\Scripts\python.exe -m app.cli.import_tmdb_catalogue --enrich-trailers --all
.\.venv\Scripts\python.exe -m app.cli.rebuild_overview_index rebuild
.\.venv\Scripts\python.exe -m app.cli.rebuild_overview_index check
psql "$env:NEON_OPERATOR_PSQL_URL" -v ON_ERROR_STOP=1 -f scripts/s5_t02_readiness.sql
```

Record `inserted`, `updated`, `rejected`, each `rejection_reason[...]`, `movies` and `active_revision` from the import. The import validates and deduplicates all 50 fetched pages before activation. A repeated import creates a new revision while preserving stable TMDb to app movie IDs; compare the SQL sample and account-owned row counts before/after. Each media `--all` traverses the active catalogue in batches of at most 300; the batch size is not a catalogue cap. Record eligible/processed/remaining and the final SQL availability counts. Trailer `--all` may resume earlier attempts; a legitimate movie may have no official trailer.

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

Confirm each account through app login against the imported target. Share only the intended demo login values with T08 through the approved private handoff. Do not publish the operator or database credentials.

## Render restart and handoff

Set `APP_ENV=production`, `DATABASE_URL` and optionally `NLP_INDEX_PATH` (for example `/tmp/ai66a-overview-tfidf-v1.json`) in the Render environment. With no explicit path, production uses the operating system temporary directory. The app checks the active PostgreSQL catalogue, corpus digest and NLP config fingerprint at startup; it reuses a matching artifact or atomically builds a missing/stale one. A fresh database with no active catalogue can start for T03's early baseline. A real preparation failure stops startup. Runtime requests never fetch TMDb metadata. An artifact deletion affects only derived data; database users, sessions, preferences, ratings and Watchlists remain in PostgreSQL.

After a restart, record the safe `NLP index ready` log's revision, digest, config, movie count and `elapsed_seconds`; use Render's observed process memory/CPU metrics for actual resource use. Run `check` and exercise a description Search and Similar on an actual movie. Compare the account row counts before/after restart and verify A/B saved preferences, half-star ratings and Watchlists through authenticated app requests. Delete **only** the disposable index file on a disposable instance to prove rebuild. T03 receives the environment names, health and readiness results; T04 receives the active revision, real TMDb IDs and PostgreSQL 18 connection interface for its later VN provider/link run; T08 receives these setup steps and the intended demo login values. T04 owns provider schema, enrichment and DTO, so its work does not block this catalogue setup.

## Evidence record (pending live execution)

| Item | Actual result |
| --- | --- |
| Neon region / server version / TLS | Pending operator access |
| Primary and backup effective access | Pending operator access |
| Development / test target names | Pending operator access |
| 50-page accepted / updated / rejected by reason / active revision | Pending live import |
| Whole-catalogue poster / backdrop / trailer counts | Pending live enrichment |
| Public review-account login | Pending live target |
| Index restart elapsed time / CPU / memory / Search / Similar | Pending live deployment |
| A/B personal data retention and repeated import identity | Pending live checks |

Local synthetic tests establish code behaviour only; they do not fill any live result above.
