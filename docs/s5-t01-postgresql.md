# S5-T01 PostgreSQL 17 connection and account provisioning

The synchronous backend targets PostgreSQL 17 through the pinned `psycopg`
driver. Install `backend/requirements.lock.txt` and set `DATABASE_URL` to a
`postgresql+psycopg://` URL. Run migrations from the repository root:

```powershell
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.lock.txt
$env:DATABASE_URL = '<PostgreSQL URL supplied by the secret manager>'
.\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini upgrade head
```

The runtime engine defaults to `sslmode=verify-full`; supply a trusted server
certificate through libpq's standard `sslrootcert` URL option or `PGSSLROOTCERT`.
Production mode (`APP_ENV=production`) requires `verify-full`. Only isolated
local test instances should explicitly use `sslmode=disable`.
The engine checks pooled connections before reuse, recycles them after 30
minutes, and limits the pool to five regular plus five overflow connections
with a five-second wait. API database failures return a generic 503 without
database credentials or SQL text.

Catalogue and multi-query account reads use PostgreSQL `REPEATABLE READ` to
keep revision, count and page results on one snapshot. Account writes switch
to `READ COMMITTED`, then lock the account's `users` row before reading or
changing preferences, ratings or watchlist entries. Reset uses the same lock
and clears only that account's preferences and ratings. Lock waits are capped
at five seconds, after which the API returns its generic 503. The caller
commits or rolls back the full transaction. SQLite retains its `BEGIN IMMEDIATE`
policy.

## Provision one application account for T02

Provisioning requires the operator to name the exact host and database, and
to provide the application password in a separate environment variable. Use
an application password from a secret manager; this command never creates a
PostgreSQL role or stores a plaintext password. Run from `backend` after the
target has reached Alembic head:

```powershell
$env:DATABASE_URL = '<PostgreSQL URL supplied by the secret manager>'
# APP_ACCOUNT_PASSWORD is injected by the secret manager.
..\.venv\Scripts\python.exe -m app.cli.provision_account `
  --expected-host db.example.com --expected-database movie_app `
  --operator '<operator identifier>' --email 'reviewer@example.com' `
  --password-env APP_ACCOUNT_PASSWORD
```

The command prints `created` or `already_exists` when the supplied password
matches the existing hash. If an existing account has different credentials,
it refuses without changing that account. It never prints the URL or password.
Keep the URL and password out of shell history and logs.

## PostgreSQL integration proof

Set `TEST_POSTGRES_URL` to a disposable PostgreSQL 17 database where the test
role may create schemas. The test fixture creates and drops only its own random
schema; it runs the full Alembic path in that schema. It expects PostgreSQL 17
by default so the selected-major gate cannot pass accidentally on another
version.

```powershell
$env:TEST_POSTGRES_URL = '<disposable PostgreSQL 17 URL>'
.\.venv\Scripts\python.exe -m pytest -q backend/tests/test_postgresql_t01.py
```

The local acceptance path remains SQLite and does not need PostgreSQL:

```powershell
.\.venv\Scripts\python.exe -m pytest -q tests/test_p0_acceptance.py
```
