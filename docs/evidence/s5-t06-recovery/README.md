# S5-T06 recovery rehearsal evidence — 10 November 2026

Issue #253. Current source checkout: `406530eabf4fba19eeaffdd703c515059c0558f5`
(`feature/minhhoang`, containing T03/T04). An earlier local rehearsal used
`7a198ff3ce8a07a08318bf837f162fa7b907b81d` (`origin/main`, T04 merge).
The implementation and this record are uncommitted
working-tree changes as requested; no PR, approval or merge is claimed.

## Environment and actual commands

Windows, Python 3.12.6, PostgreSQL **server 18.1**, `pg_dump` **18.1** and
`pg_restore` **18.1**. A local cluster initialized for the earlier rehearsal in the user's temp
directory listened only on `127.0.0.1:55432`, with local test trust
authentication and `sslmode=disable`. It was not Neon or Render. The effective
source target in the final focused run was `s5_t06_r3_source` / role `postgres`; the separate effective
restore target was `s5_t06_r3_target` / role `postgres`. Both were empty before
the test. The test archive was a custom `.dump` in pytest's temporary folder,
never committed. The pre-provider rollback archive was also temporary. These
are disposable test assets, **not** durable production backups.

```text
pg_ctl -D <previously-initialized-private-temp-cluster> -o "-p 55432 -h 127.0.0.1" -w start
CREATE DATABASE s5_t06_r3_source ENCODING 'UTF8' TEMPLATE template0;
CREATE DATABASE s5_t06_r3_target ENCODING 'UTF8' TEMPLATE template0;
RECOVERY_TEST_SOURCE_URL=<local isolated PostgreSQL URL>
RECOVERY_TEST_TARGET_URL=<different local isolated PostgreSQL URL>
python -m pytest -c pytest.ini backend/tests/test_s5_t06_postgres_recovery.py -q
python -m ruff check backend/app/cli/compare_recovery.py backend/tests/test_s5_t06_postgres_recovery.py
```

Actual final focused result: **2 passed in 16.30 seconds**, one inherited Starlette/httpx deprecation warning;
Ruff passed. The test applied all Alembic migrations to source, seeded two
synthetic movies, A/B accounts, sessions, preferences, exact 3.5/4.5 ratings,
separate Watchlists, media and seven regional checks with five provider-group
memberships. It ran `pg_dump -Fc`, `pg_restore --exit-on-error` into the empty
target, and the new read-only comparator. Full row values in all mapped tables,
including provider country/status/attempt/checked/link/null fields, matched
exactly. Both targets reported `d9a6f2c1e508`, two movies, seven checks and
five memberships. PostgreSQL reported zero unvalidated FK/check constraints.
Read-only target identity queries returned
`18.1|s5_t06_r3_source|postgres|d9a6f2c1e508|2|7|5` and
`18.1|s5_t06_r3_target|postgres|d9a6f2c1e508|2|7|5`.

The comparator printed equality for all mapped tables and regional status/link
aggregates without printing rows. A second restore into the populated target
failed, and the full comparator still passed. Downgrade to VN-only
`b8e4d2c96f10` refused populated US/GB/SG data; the full comparator still
passed afterward.
Temporarily setting the isolated target's Alembic version to the previous head
made T03 health return 503; restoring the head returned 200. The recovered
index built at startup. Catalogue, description Search, Similar, Details for
US/GB/SG and default US, independent groups and valid/null/stale/error states
on both movies, null SG link, unsupported VN/CA/lowercase rejection, preserved
session cookies, A/B isolation, reset preserving both Watchlists, and a later
login after a new application lifespan passed. Runtime TMDb access was patched
to fail on any call; zero calls occurred.

## Code rollback rehearsal

An archive of reviewed T03 main merge `f24ef54` was extracted to a separate
temporary source directory during the earlier rehearsal and reused in this run.
It embedded Alembic head `a3d1f8b72c44`. Against
the recovered regional `d9a6f2c1e508` target, this **actual old code** returned
health **503**, as required by the exact-head rule. This confirms direct code
rollback alone is incompatible. Its green push-to-main CI status was not
independently retrieved in this local rehearsal and must be confirmed by T03
before using that commit for public rollback.

For the compatible path, the earlier rehearsal's isolated `s5_t06_rollsource` database was
migrated to `a3d1f8b72c44` and seeded with one synthetic catalogue movie,
poster/backdrop, two accounts, two preferences, 3.5/4.5 ratings and two
Watchlists. `pg_dump -Fc` captured this **pre-provider** state. That source
was then upgraded through `b8e4d2c96f10` to `d9a6f2c1e508`; the archive was
restored with `pg_restore --exit-on-error` into the separate empty
`s5_t06_rollback` database. The restore reported head `a3d1f8b72c44` and
two users, ratings and Watchlists. The extracted T03 code, pointed only at
this restored target again in the current run, returned health **200**, catalogue total **1**, login
**200**, rating **3.5**, Watchlist total **1**, description Search **200** and
Similar **200**. Its startup built an index from that target. This proves a
compatible code-plus-data rollback on synthetic data. It does not prove a
public rollback or preservation of writes after the older recovery point.

## Real T04 evidence reused and remaining acceptance

The [T04 real full-catalogue development result](../s5-t04-providers/regional-2026-11-10.md)
is reused at its recorded source: Neon PostgreSQL 18.6, 989 active movies,
2,967 US/GB/SG checks, preserved 989 legacy VN checks, real country links and
independent regional API probes. It is **not** a T06 restore result. T04's
record also says the public runtime was still at `a3d1f8b72c44` at its
observation; no fresh public check was made here.

The following cannot truthfully be marked done from this workspace: a durable
private backup of the real Neon source with verified primary/backup operator
access and seven-copy retention; a restore of that real 989-movie catalogue
into an isolated PostgreSQL 18 target; its A/B and per-country comparison; a
genuine reproduction by a named non-contributing teammate; formal review,
green PR/merge and public T07 acceptance. @hoang3003 and the eligible backup
reviewer must record those actual results, archive location/access, person,
date, source SHA, commands and target identity before closing #253. Give T07
the recovered regional/API evidence for public selector/button acceptance;
give T08 the backup/restore/escalation procedure; give C02 the exact-head
rollback limit and final review/merge status. No approval, submission receipt,
production backup or release result is inferred from this local rehearsal.
