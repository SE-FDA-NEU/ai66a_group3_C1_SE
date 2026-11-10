# S5-T06 PostgreSQL 18 recovery and code rollback

Issue #253. This runbook supersedes the SQLite file-copy section of
[S4-C05](s4-c05-release-storage.md) for PostgreSQL. It applies to the T04
regional head `d9a6f2c1e508` (after `b8e4d2c96f10`), with historical VN rows.
The dated local rehearsal is in [the evidence](evidence/s5-t06-recovery/README.md).
T03's `/health` requires the **exact** Alembic head embedded in the running
code. A database at a newer head cannot be served by older code.

## Ownership, schedule and protected storage

The primary backup/restore operator is **@hoang3003**; the backup operator and
independent reproduction coordinator is **@NguyenTuanAnh0608**. If the latter
contributes to this implementation, choose another non-contributing teammate
for final review. T03 owns the public deployment gate; T04 owns provider data;
T07/T08/C02 receive this runbook and the dated results.

The selected operating policy from [S5 planning](sprint5-backlog-refinement.md)
is a **daily consistent logical backup after public writes**, plus a backup
**before every schema or provider-data change**. Retain the latest **seven
successful** archives, including a known good pre-change archive until its
replacement has passed restore verification. The primary operator's private
directory must be outside the repo and Render, replicated to storage controlled
by the backup operator. Limit directory/archive read access to those operators,
encrypt the storage and transfer, and test access from the backup operator's
own identity. Record both actual absolute paths, ACLs, replication result and
restore date in private operations records; the public evidence may name the
storage class and access owners without revealing credentials or account rows.
Do not count Render's ephemeral filesystem or this repo as the durable copy.

The local rehearsal used a temporary PostgreSQL 18 cluster and temporary custom
archives. It does **not** establish the private durable production destination,
replication, schedule or access. Those items require the named operators and
their private Neon/backup credentials before #253 can be closed.

## Preflight and backup

1. Obtain the source **operator/read role**, target restore role and backup
   directory through the private secret manager. Independently confirm source
   host, database, role and intended target database. Refuse URL query target
   overrides (`host`, `hostaddr`, `dbname`, etc.). Record versions with `psql`
   `SHOW server_version_num`, `SELECT current_database(), current_user`, and
   `pg_dump --version`, `pg_restore --version`. Use PostgreSQL 18 clients for a
   PostgreSQL 18 server. Enable `verify-full` and a trusted root certificate
   for Neon. The local test is the only documented `sslmode=disable` use.
2. Check the selected source Git SHA, `alembic heads/current/check`, active
   revision/movie count, and T04 country aggregates. Check `/health` and index
   readiness. Stop importer/migration jobs and coordinate a quiet comparison
   window for account writes; `pg_dump` itself takes a transactionally
   consistent snapshot even if the service remains online. If writes continue,
   a later source-versus-restore comparison can legitimately diverge.
3. Use a newly named `.dump` archive in the restricted private directory. The
   command must finish successfully before retention counts it. Inject `PG*`
   variables from the private secret manager, never a connection URL or password
   in the command line, shell history, shared logs or Git.

```powershell
# PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD, PGSSLMODE=verify-full,
# PGSSLROOTCERT and $backupFile are supplied privately by the operator.
pg_dump --version
pg_dump --format=custom --no-owner --no-privileges --file "$backupFile"
if ($LASTEXITCODE -ne 0) { throw 'Backup failed; keep the previous archive' }
pg_restore --list "$backupFile" | Select-String 'movie_provider_checks|movie_watch_providers|auth_sessions|user_movie_watchlist'
```

The custom archive includes schema, Alembic revision, active catalogue,
providers, link/check provenance, credentials hashes, sessions, genres, exact
half-star ratings and Watchlists. `--no-owner --no-privileges` omits role ACLs;
reapply the reviewed runtime SELECT grants on the restore target. Keep an
archive checksum and source/target identity in the **private** manifest. The
archive is sensitive even though `pg_restore --list` shows no personal rows.

## Restore to a separate PostgreSQL target

1. Provision a **new, empty** PostgreSQL 18 database with a different effective
   database identity. Never use the public database or a previously populated
   target for a failure experiment. Confirm `current_database()` and that no
   application/Alembic tables exist. Point `PG*` at this target only after
   source backup finishes. Do not use `--clean`, `--if-exists` or `--create`.
2. Restore with `pg_restore --exit-on-error --no-owner --no-privileges
   --dbname <confirmed-empty-target> "$backupFile"`. A failed restore leaves
   the target untrusted; provision another empty target. Never retry over a
   partly restored target. Apply only target-specific role grants afterward.
3. Set `DATABASE_URL` privately to the **restore target** and run `alembic
   current`, `alembic heads`, `alembic check`. They must all resolve to
   `d9a6f2c1e508` for T04 code. Verify PostgreSQL validated foreign keys and
   check constraints (`pg_constraint.convalidated`); `pg_restore --exit-on-error`
   also fails if FK validation fails. Verify active revision/movie identity,
   media fields and A/B ownership. Do not run a new TMDb import to repair a
   missing row during recovery inspection.
4. From `backend`, set `RECOVERY_SOURCE_URL` and `RECOVERY_TARGET_URL` through the
   private secret manager and compare the quiet source with the restore:

```powershell
..\.venv\Scripts\python.exe -m app.cli.compare_recovery `
  --source-database '<confirmed-source-db>' `
  --target-database '<confirmed-restore-db>'
```

The comparator refuses identical targets, redirected URL targets, non-18
servers, unvalidated constraints and unknown/multiple revisions. It checks
every mapped application table, including all provider membership keys,
country/status/timestamps/link URL and null states, active movie/media IDs,
session ownership, genres, ratings and Watchlists. It prints only counts and
equality flags, never rows, URLs, password hashes or tokens. If live writes
continued after the dump, use a quiet window or compare against a contemporaneous
private manifest; do not call an expected timing difference corruption.

Rebuild/check the derived NLP artifact from the restored DB, using an **isolated
index path**. This artifact is not a substitute for the database backup:

```powershell
$env:NLP_INDEX_PATH = '<private-disposable-restore-index-path>'
..\.venv\Scripts\python.exe -m app.cli.rebuild_overview_index rebuild
..\.venv\Scripts\python.exe -m app.cli.rebuild_overview_index check
```

Start only a staging/local backend against that restored target. Verify health
200 and exact head, catalogue count, a poster/backdrop/trailer identity, Details
for `country=US`, `GB`, `SG` and default US, valid selected-country watch URL or
the recorded null, and no other country's provider groups. `VN`, `CA`, lowercase
and empty country must return safe 400. Block runtime TMDb access during probes.
Check description Search and Similar after index readiness. Check A/B sessions,
later login, distinct genres, 3.5/4.5 ratings and Watchlists. Reset only the
disposable A account: A genres/ratings clear while both Watchlists and all B
data remain. Restart the staging backend and repeat health, index, login and
account checks. Preserve the original archive for investigation.

## Code rollback, migration ordering and escalation

Identify an approved **green main** commit from the CI and review records and
capture its full SHA, its code Alembic head and deployment gate result. The
isolated local rehearsal used T03 merge `f24ef54` at code head
`a3d1f8b72c44`; confirm its actual green main CI status before selecting it for
a public rollback. Keep branch protection, required approval and CI/deploy gate
active. A reviewed revert follows the same gate; do not use a manual deploy to
bypass it.

The current regional database at `d9a6f2c1e508` cannot be served by T03 code
at `a3d1f8b72c44`: health returns 503. Downgrading populated regional data to
VN-only is explicitly refused. Downgrading past `b8e4d2c96f10` drops provider
tables, so a code rollback that needs the old head requires a **pre-provider,
consistent archive** restored to another new database. That archive may omit
later provider links, status/timestamps and account writes. Declare the recovery
point and resolve the data-loss window with the incident owner before switching
traffic. Prefer a reviewed forward fix if preserving those later writes is
mandatory. Never delete provider rows or run destructive Alembic downgrade on
the public DB to force compatibility.

The safe order is: (1) retain the current source and capture a fresh private
archive; (2) restore the compatible pre-change archive to a new target; (3)
check its exact head, A/B data, catalogue/media, index and old-code health/API;
(4) pass review/CI; (5) switch code and database configuration together; (6)
recheck public health and product flows; (7) retain both archives for escalation.
For a forward deployment, first capture a pre-migration archive, then migrate
with the operator role, deploy matching code and check health before enabling
regional UI. Public runtime and development evidence must be recorded
separately.

If backup fails, retain the prior good archive and stop migration. If target
identity, versions, archive listing, restore, Alembic head, FK validation,
comparison or index check fails, **do not promote the target**. Preserve logs
with request IDs and exit codes only; quarantine the failed target. Contact the
primary backup operator, then backup operator, T03 deployment owner and T04
provider owner as appropriate. Record incident time, source/recovered SHA/head,
archive ID, target identity, last good backup and the observed safe failure.
Retry from a newly provisioned target after root cause is resolved. A public
503/head mismatch means hold traffic/deployment, not bypass health.

## Reproducible focused check and handoff

Set `RECOVERY_TEST_SOURCE_URL` and `RECOVERY_TEST_TARGET_URL` to two **empty,
disposable** PostgreSQL 18 databases named `s5_t06_*`, with `pg_dump` and
`pg_restore` 18 on `PATH`. The test refuses nonempty targets and uses synthetic
TMDb/account rows. Run:

```powershell
.\.venv\Scripts\python.exe -m pytest -c pytest.ini `
  backend/tests/test_s5_t06_postgres_recovery.py -q
```

It covers native custom dump/restore, full-table exact comparison, legacy VN,
independent US/GB/SG valid/null/stale/error states, provider groups, migration
refusal, duplicate restore refusal, health head refusal/recovery, index startup,
Search/Similar, country APIs, zero runtime TMDb calls, sessions, A/B reset and
later login. T04's [full real catalogue result](evidence/s5-t04-providers/regional-2026-11-10.md)
is reused at its recorded development source; the focused test is synthetic.
T07 checks the country selector/button on its selected public candidate. T08
receives this operational procedure; C02 receives the release compatibility
and outstanding acceptance status. A non-contributing teammate must actually
repeat the procedure and formally review the resulting PR before #253 closes.
