# S5-T04 provider verification

Issue [#251](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/251),
PR [#261](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/261).
Verified on 10 November 2026, Asia/Ho_Chi_Minh, with Python 3.12.6 and
PostgreSQL 18.6. Application source is `42b14bdfffe31f91c9fec7ad5f767722421c855a`,
including main's T03 changes. Structured results are in
[verification.json](verification.json).

## Environment and rollout boundary

The operator ran migration and the real TMDb enrichment against the existing
Neon `cineai_development` database. Its 989 movies, catalogue revision, genres
and movie identities matched the runtime public catalogue before migration.
The checks used the migration/import owner and the restricted
`cineai_runtime` role. Two dedicated synthetic development accounts were
created through guarded provisioning and seeded through authenticated API
calls. Runtime accounts were kept in `neondb`.

The public runtime rollout remains pending. T03 health requires the database
revision to match the running application's Alembic head. Applying T04's new
head to runtime ahead of its code deployment would fail the existing service's
health check. Coordinate the runtime migration with the reviewed green-main
deployment, then repeat the verification commands below on that confirmed
target. This record establishes real Neon development acceptance.

## Migration, permissions and backups

An operator created a private custom-format `pg_dump` before migration and
verified its archive listing. `alembic heads`, `current`, `upgrade head`,
`current` and `check` passed. Development moved from `a3d1f8b72c44` to the
single head `b8e4d2c96f10`, with fingerprints of every pre-existing table
identical across migration.

The runtime role can SELECT both `movie_provider_checks` and
`movie_watch_providers`, and cannot INSERT/UPDATE/DELETE either. Development
app-account writes retain their existing role permissions. The external client
connection used verified TLS with a certifi CA bundle and channel binding.

Private backups were taken before and after the run. The final archive listing
includes both provider tables and their data entries. File sizes, hashes and
verification results are recorded in the JSON. Dumps and connection values
stay outside Git. A PostgreSQL restore rehearsal is a T06 handoff item.

## Whole-catalogue results

With privately supplied operator `DATABASE_URL`, `TMDB_READ_ACCESS_TOKEN`
and CA settings, run from the repository root.

```powershell
.\.venv\Scripts\python.exe -m app.cli.import_tmdb_catalogue --enrich-providers --all --refresh --limit 300
```

The actual run took **423.07 seconds** and returned exit 0.

| Result | Count |
| --- | --- |
| Eligible / processed | 989 / 989 |
| Already checked / remaining | 0 / 0 |
| With VN provider data / no VN data / failed | 0 / 989 / 0 |
| Valid / missing / invalid VN watch links | 0 / 989 / 0 |

All reconciliation equations pass. Independent final SQL counts show 989
`no_data` checks, 989 `missing` links and zero provider memberships.

The actual TMDb `/watch/providers/regions` probe returned 139 regions and
did not list VN. The movie responses likewise supplied no VN availability.
These observations require truthful unknown-availability presentation in T05.
Keep all five group arrays empty and `watchOptionsUrl=null` for these records.
Do not substitute another country's result or generate a watch URL.
TMDb's [available-regions endpoint](https://developer.themoviedb.org/reference/watch-providers-available-regions)
describes the supported-country list. Its [movie-provider endpoint](https://developer.themoviedb.org/reference/movie-watch-providers)
requires JustWatch attribution.

## Resume, failure preservation and data ownership

Running again without `--refresh` returned exit 0 with `already_checked=989`,
`processed=0`, `remaining=0` and no additional TMDb movie requests.

A deliberately mocked authentication failure was then injected into one
development refresh. This was a controlled test, with no claim of an actual
TMDb outage. It committed one stale attempt and stopped with 988 remaining.
Details exposed `stale`, retaining the previous successful `checkedAt`, groups
and link. A subsequent real resume processed just that one movie, skipped
988 completed records and finished with zero failures/remaining.

Before authenticated verification could add new test sessions, a comparison
of all original catalogue/media/account/session tables against the seeded
baseline found identical counts and SHA-256 fingerprints. The NLP artifact
remained ready with 989 movie IDs and 988 usable documents. Corpus digest
and config fingerprint stayed identical.

An HTTPS ASGI TestClient used the restricted runtime role with the real Neon
development database. Details switched correctly between two real imported
movie IDs. A metadata-network guard verified zero request-time TMDb calls.
Both accounts retained their own genres, 3.5/4.5 ratings and separate Watchlist
items after enrichment and later login. Cross-account rating reads remained
empty. T05 owns the provider UI that consumes this verified backend contract.

## Retry correction and automated checks

Numeric and HTTP-date Retry-After values retain their full valid duration.
A delay above the 30-second per-retry wait budget stops the invocation and
prints `retry_after_seconds`, preserving progress for a later resume. An
exhausted 429 also stops before the next movie. Invalid/nonfinite values use
bounded exponential backoff. Operators wait for the reported delay before
resuming.

Five retry assertions failed on the former behavior and passed after the
correction. Coverage includes a 120-second numeric delay, a future HTTP-date,
exhausted 429, invalid/nonfinite headers, CLI output and stale-data resume.

| Check | Actual result |
| --- | --- |
| Eight affected importer/schema/API/media/recovery suites | 247 passed |
| PostgreSQL 18 integration in separate `cineai_test` schemas | 12 passed, zero skips |
| Default `python -m pytest -v` | 40 P0 passed |
| Production serving, health, auth and early bootstrap | 50 passed |
| Ruff and `git diff --check` | Passed |

An inherited Starlette/httpx deprecation warning remains. The completion
changes are backend/operator changes. CI validates the unchanged frontend
lint/build when the PR is pushed. New current-head CI links belong in the PR.

## Remaining acceptance and handoff

1. A teammate who did not contribute to this change gives a substantive formal
   review and approval on the final candidate. The earlier approval body was
   only `ok`. The new review must explain the checks performed.
2. Merge through protected main and confirm the green main run. Coordinate
   Render startup/health readiness with the public database migration. Capture
   the deployed SHA and runtime head before declaring rollout complete.
3. Back up the confirmed runtime target, migrate, verify SELECT grants and run
   the full enrichment there with the same reconciliation and resume checks.
   Record runtime account/media/NLP preservation and Details results separately.
4. T05 consumes the documented VN DTO, unknown/stale states and nullable link.
   T06 includes both tables, constraints and grants in PostgreSQL recovery.
   T08 records actual source coverage, commands, attribution and rollout results.

Retain `Refs #251` while public rollout and final review remain pending.
