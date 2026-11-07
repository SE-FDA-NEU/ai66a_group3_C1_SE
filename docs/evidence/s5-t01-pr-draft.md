# PR draft: [#248] Add PostgreSQL schema and account transaction support

## Linked issue

Refs #248

Keep `Refs #248` until PostgreSQL 18 acceptance, CI, independent review and
required merge gates are complete. Then change it to `Closes #248`.

## What changed

Added the pinned PostgreSQL driver, TLS and bounded connection pooling, and
made the Alembic schema path compatible with PostgreSQL 18. Account reset,
preferences, ratings and watchlist writes share a per-account transaction lock.
Added Unicode title search handling, an idempotent account-provisioning command,
integration tests and setup documentation. Provisioning refuses URL query
parameters that can redirect the confirmed target.

T02 must use PostgreSQL 18 for Neon. T03 must use PostgreSQL 18 for the isolated
CI service and deployment checks. This supersedes the earlier 17-major plan.

## How to test it

From a clean clone in Windows PowerShell, with Docker running:

1. Prepare Python and a disposable, password-authenticated PostgreSQL 18 database:

   ```powershell
   py -3.12 -m venv .venv
   .\.venv\Scripts\python.exe -m pip install -r backend/requirements.lock.txt
   # Inject POSTGRES_PASSWORD from a secret manager; use a URL-safe value.
   docker run --rm -d --name s5-t01-pg18 -p 127.0.0.1:55418:5432 -e POSTGRES_PASSWORD -e POSTGRES_DB=s5_t01_test postgres:18
   docker exec s5-t01-pg18 pg_isready -U postgres -d s5_t01_test
   ```

   Wait until `pg_isready` reports accepting connections. Bind the disposable
   container to localhost only.

2. Run migrations and tests:

   ```powershell
   $env:TEST_POSTGRES_URL = "postgresql+psycopg://postgres:$env:POSTGRES_PASSWORD@127.0.0.1:55418/s5_t01_test?sslmode=disable"
   $env:DATABASE_URL = $env:TEST_POSTGRES_URL
   .\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini upgrade head
   .\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini check
   .\.venv\Scripts\python.exe -m pytest -c pytest.ini -q backend/tests/test_postgresql_t01.py
   .\.venv\Scripts\python.exe -m pytest -c pytest.ini -q tests/test_p0_acceptance.py
   docker stop s5-t01-pg18
   ```

## Evidence

See [PostgreSQL 18 local verification](https://github.com/kietxuan/ai66a_group3_C1_SE/blob/feat/s5-t01-postgresql/docs/evidence/s5-t01-postgresql-local.md)
for the tested commit SHA, commands and results. The earlier PostgreSQL 18.1
run is retained there as historical evidence only.

## Definition of Done

- [ ] Every acceptance criterion on the linked issue passes; CI and independent review pending
- [ ] The code runs from a clean clone
- [x] At least one automated test covers the new behaviour
- [ ] CI is green
- [x] No secrets, API keys, `.env` files, or database dumps in the diff
- [x] No commented-out dead code left behind
- [x] README or `docs/` updated if the setup steps changed

## Author declaration

- [ ] I wrote this code, or I have named every other contributor below
- [ ] Where I used an AI assistant, I have said so and I can explain every line if asked

AI assistance used: OpenAI Codex helped implement and review the database
changes, tests, documentation and this PR draft. The author should verify the
diff and check the declarations.

## Reviewer

Request review from **@kietxuan** if they did not contribute implementation
changes; otherwise choose another non-contributing teammate. Final approval
must include at least one substantive review comment via Review changes before
merge.
