# S5-T01 local verification (2026-11-07)

This record covers the uncommitted working tree based on
`a88139e404474a9b80519c6b4f163b978a08af56` on `pr-190-head`.
The final tested commit and independent reviewer evidence must be added after
the owner commits and opens the PR. No review or merge is claimed here.

Environment: Windows PowerShell, Python 3.12.3, PostgreSQL 18.1 in an isolated
localhost cluster, `psycopg`/`psycopg-binary` 3.2.12. The test database used
`sslmode=disable` only for this isolated local cluster; the runtime default is
`verify-full`. The test fixture used one fresh random schema per test and
removed its own schema afterward. C01 selected PostgreSQL 17; this PostgreSQL
18 run is exploratory and does not satisfy the selected-major acceptance gate.
The full integration suite must be repeated on PostgreSQL 17 before review.
The results below predate the selected-major guard now present in the test
fixture; rerunning them on PostgreSQL 18 requires the explicit exploratory
override `TEST_POSTGRES_MAJOR=18`.

| Command | Result |
|---|---|
| `DATABASE_URL=<isolated PostgreSQL URL> python -m alembic -c backend/alembic.ini upgrade head` | Exit 0, all revisions through `a3d1f8b72c44` applied from an empty database. |
| `DATABASE_URL=<isolated PostgreSQL URL> python -m alembic -c backend/alembic.ini check` | Exit 0, no new upgrade operations detected. |
| `TEST_POSTGRES_URL=<isolated PostgreSQL URL> python -m pytest -q backend/tests/test_postgresql_t01.py` | 5 passed. Includes fresh migrations, downgrade/upgrade with a stored rating, account API/isolation/reset, constraints, catalogue reads, and concurrent account locks. |
| `python -m pytest -q tests/test_p0_acceptance.py` | 31 passed. |
| `python -m pytest -q backend/tests/test_account_migration.py backend/tests/test_rating_migration.py backend/tests/test_account_write_transactions.py backend/tests/test_profile_reset_api.py backend/tests/test_s4_t12_watchlist.py backend/tests/test_catalogue_pagination.py backend/tests/test_movie_search_api.py` | 128 passed. |
| `python -m ruff check` on changed Python files; `git diff --check` | Both passed. |

Commands above used `.venv/Scripts/python.exe` on this machine. The PostgreSQL
URL and application credentials are intentionally omitted. The PR should cite
this record with `Refs #248` until the independent review, C01 dependency,
and merge gates are complete.
