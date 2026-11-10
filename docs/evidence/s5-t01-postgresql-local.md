# S5-T01 PostgreSQL 18 local verification (2026-11-08)

Tested code commit: `89f0f9d33f21a24c05d4d9bf75b47bad357ed6fa`.
Environment: Windows PowerShell, Python 3.12.3, PostgreSQL **18.1** in an
isolated localhost cluster. The cluster was initialized with
`--auth-host=scram-sha-256 --auth-local=scram-sha-256` and a random password.
An attempted connection with a wrong password was rejected; the correct
password was used for Alembic and all PostgreSQL integration tests. The URL
and password were kept out of this record and the fixture's pytest display.
The temporary database cluster and test schemas were removed after the run.

| Command from repository root | Result |
|---|---|
| `psql -c 'SHOW server_version'` against the isolated cluster | `18.1` |
| `psql` with deliberately wrong password | Rejected by SCRAM authentication. |
| `.\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini upgrade head` with `DATABASE_URL` set to the empty password-authenticated database | Exit 0; all revisions through `a3d1f8b72c44` applied. |
| `.\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini check` | Exit 0; `No new upgrade operations detected.` |
| `.\.venv\Scripts\python.exe -m pytest -c pytest.ini -q backend/tests/test_postgresql_t01.py` | **11 passed, 1 warning.** Fresh-schema migrations, provisioning/idempotency and redirected-target refusal, authentication, half-star constraints, A/B isolation, reset preserving Watchlist, rating migration identity, catalogue reads and concurrent account locks. |
| `.\.venv\Scripts\python.exe -m pytest -c pytest.ini -q tests/test_p0_acceptance.py` | **31 passed, 1 warning.** |
| `.\.venv\Scripts\python.exe -m pytest -c pytest.ini -q backend/tests/test_account_migration.py backend/tests/test_rating_migration.py backend/tests/test_account_write_transactions.py backend/tests/test_profile_reset_api.py backend/tests/test_s4_t12_watchlist.py backend/tests/test_catalogue_pagination.py backend/tests/test_movie_search_api.py` | **128 passed, 1 warning.** Affected SQLite tests. |
| `.\.venv\Scripts\python.exe -m ruff check backend/app/cli/provision_account.py backend/tests/test_postgresql_t01.py` and `git diff --check` | Passed. |

The regression was also verified RED then GREEN on this commit. With only the
new target-override guard temporarily removed, the
`test_empty_postgresql_migration_schema_constraints_and_provisioning` test
failed (`DID NOT RAISE ProvisioningError`, exit 1): libpq's query `dbname`
sent an account insert to the migrated database despite a different database
name confirmed by the operator. The guard was restored byte-for-byte, the
PostgreSQL suite passed, and `git status --short` was clean before updating
this evidence. The RED run used a temporary worktree change; the GREEN run
used the committed code SHA above.

## Historical local run (2026-11-07)

The earlier uncommitted run based on
`a88139e404474a9b80519c6b4f163b978a08af56` reported PostgreSQL 18.1
**5 passed**, P0 **31 passed**, and related SQLite tests **128 passed**.
It used a trust-based cluster and predates the target guard, password-preserving
fixture and PostgreSQL 18 default. It is retained as history and is not the
acceptance evidence for the tested code commit above.
