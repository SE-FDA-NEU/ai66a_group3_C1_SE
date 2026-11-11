# S5-T06 recovery verification, 10 November 2026

Issue #253, PR #262. Application source is
`37f065165caab6dee5e5ef178937d80f96dccf5c`, extending the original PR
`5ff39aa034722e6368265a33286475c52ab13308`. The run used Windows,
Python 3.12.6, PostgreSQL clients 18.1, local PostgreSQL 18.1 and Neon
PostgreSQL 18.6. Execution was Codex automation in the PO-authorized local
environment. Independent teammate reproduction remains pending.
[Structured verification](verification.json), [actual full-table comparison](comparison.txt)

## Comparator correction and regression

The original standalone CLI left ORM metadata empty and could return exit 0
without comparing any application table. The review reproduced success with
two source ratings versus one restored rating and with a wrong-movie watch URL.

Three regression cases failed before the correction, then passed afterward.
The CLI now registers all models, rejects empty/incomplete metadata before
connecting, opens read-only transactions and compares all 12 application tables.
The focused native recovery test independently changes a rating, watch URL,
check timestamp and provider name. Each change returns exit 1 and identifies the
affected table. Undoing each test change restores exit 0.

```powershell
.\.venv\Scripts\python.exe -m pytest -c pytest.ini backend/tests/test_s5_t06_postgres_recovery.py -v
.\.venv\Scripts\python.exe -m pytest -c pytest.ini backend/tests/test_postgresql_t01.py -q
.\.venv\Scripts\python.exe -m pytest -v
.\.venv\Scripts\python.exe -m ruff check backend
```

With two newly created local databases named `s5_t06_final_source` and
`s5_t06_final_target`, the focused suite passed **5 cases with zero skips**.
PostgreSQL integration passed **12 cases with zero skips** in isolated schemas.
The default milestone suite passed **40 P0 cases**. Ruff passed. The inherited
Starlette/httpx TestClient deprecation warning remains. CI provisions matching
PostgreSQL 18 clients and two empty databases, executes the focused recovery
suite and rejects skipped cases.

## Real Neon backup and restore

The source was `cineai_development`, containing the genuine imported T04
catalogue and exactly two controlled synthetic development accounts. The
operator role was `neondb_owner`, with `verify-full` TLS. An initial real restore
used `s5_t06_neon_restore_20261110`. The final API verification used the newly
created `s5_t06_neon_verified_20261110` target and the same consistent archive.
Both restores used empty databases and matched all 12 source tables before
application-flow probes.

The native operator commands used private `PG*` variables and an ignored private
archive path. The public record exposes counts and archive checksum only.

```powershell
pg_dump --format=custom --no-owner --no-privileges --file "$backupFile"
pg_restore --list "$backupFile"
# Set PG* to the independently confirmed new empty target.
pg_restore --exit-on-error --no-owner --no-privileges --dbname "$targetDatabase" "$backupFile"
# Load source/target application URLs privately.
.\.venv\Scripts\python.exe -m app.cli.compare_recovery `
  --source-database cineai_development `
  --target-database s5_t06_neon_verified_20261110
.\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini check
```

| Item | Actual restored result |
| --- | --- |
| Schema head | `d9a6f2c1e508` |
| Active revision | `1ee08003-bc00-4888-b35c-8c6cbe599062` |
| Active imported movies | 989 |
| US / GB / SG checks | 989 each, 2,967 total |
| Historical VN checks | 989 |
| Provider group memberships | 21,369 |
| Users / preferences / ratings / Watchlists | 2 / 2 / 2 / 2 |
| Session rows at the recovery point | 6 |
| Exact full-table comparison | All 12 equal, exit 0 |
| Archive size / format | 582,019 bytes, native custom format |

The archive SHA-256 is
`6fd2e356115b7c1b83fee93bb4d7b90edf591629a7cb1226a53a2c0f7c50b082`.
The source was unchanged during comparison and subsequent restored API probes.
The restricted `cineai_runtime` role received SELECT on catalogue/provider
tables and the existing account-owned DML grants. It has no provider-table DML.

Source and restored regional outcome counts matched exactly.

| Country | Success | No data | Error/stale |
| --- | --- | --- | --- |
| US | 900 | 89 | 0 |
| GB | 855 | 134 | 0 |
| SG | 706 | 283 | 0 |
| VN history | 0 | 989 | 0 |

Valid, missing, stale and error supplementary states are also covered by the
separately labelled two-movie synthetic native dump/restore test. Genuine source
provider data remains documented at its original T04 verification.
[T04 regional source record](../s5-t04-providers/regional-2026-11-10.md)

## Recovered application checks

FastAPI TestClient probes used an HTTPS base URL and the restricted runtime
role connected to the verified Neon restore. Runtime TMDb calls were blocked.

- Health returned 200 with the exact schema head and catalogue total 989.
- Details switched US/GB/SG/default US across two real imported movies. Groups,
  selected-country links and genuine null states matched the stored source.
- VN, CA, lowercase and empty country values returned safe 400 validation errors.
- Description Search and Similar succeeded after explicit index rebuild/check.
- A/B logins retained their separate genres, exact 3.5/4.5 ratings and movie IDs
  in each Watchlist. Cross-account rating checks remained empty as expected.
- Reset on the disposable A account cleared its genres/rating, retained both
  Watchlists and preserved B genres/rating/Watchlist identity.
- Authenticated cookies survived a new application lifespan. Logout invalidated
  the session and later login restored B's values. Cookie transfer in the private
  verifier was corrected to preserve domain/path and the final run passed.
- Deleting only the derived restore index and starting another lifespan rebuilt
  it from Neon. It remained ready for 989 movies and 988 usable documents.
- All restored catalogue/media/provider tables remained unchanged during these
  account-flow checks. The development source was untouched. Runtime TMDb calls
  were zero. Account/session writes occurred only on the isolated restore.

Corpus digest is
`714148f40f7c7788af159a2707804e23a5de47fc7b44e187a9aaa183a4ad2ec4`.
Config fingerprint is
`41785781f34ba44091ac64f3b1c0503402ee760c518af1429d0acb94bbc31c99`.

On that isolated target, a controlled duplicate native restore and downgrade to
VN-only both failed. Full before/after inspection verified all 12 tables were
unchanged after each refusal, retaining head `d9a6f2c1e508`.

## Actual code rollback

The reviewed T03 source
`f24ef54699efb2fa26f363107bd31401f9b12e58` was extracted privately and imported
in a separate Python process. Its push-to-main CI succeeded.
[Verified green CI](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/42756095162)

That actual old code returned health 503 against the real regional Neon restore,
confirming the exact-head compatibility limit. A separate local synthetic source
was migrated with the old code to `a3d1f8b72c44`, populated with two movies and
A/B data, and backed up before provider migration. After upgrading the source
and adding regional data, its pre-provider archive was restored into the separate
empty `s5_t06_roll_restored_20261110` database.

All ten pre-provider tables matched before old-code application probes. The
actual T03 code returned health 200, catalogue total 2, successful A/B logins,
the exact separate genres, 3.5/4.5 ratings and Watchlists, description Search
and Similar. Writes after the older recovery point require an explicit incident
decision. This rehearsal left public routing and deployment settings untouched.

## Remaining closure work

On 10 November the PO confirmed that shared durable backup storage and a genuine
independent reproduction were not yet available. The current archive is a local
private rehearsal asset in an ignored operator directory. The selected policy is
daily backup plus pre-change backup, retaining seven successful copies. Operational
execution, durable replication and independent backup-operator access remain pending.

| Requirement | Status |
| --- | --- |
| Comparator, refusals and focused tests | Verified |
| Genuine full-catalogue Neon restore and API/account/index checks | Verified |
| Actual compatible/incompatible reviewed-code rollback | Verified |
| Durable private destination, daily execution and seven-copy retention | Pending |
| Primary/backup operators' actual artifact access | Pending |
| Named non-contributing teammate reproduction | Pending |
| Substantive formal review and protected merge | Pending |

Git stores the runbook, code and redacted evidence. The sensitive archive needs
private durable storage and tested access by both operators. T07 receives the
recovered regional/API results for its public-product acceptance. T08 receives
the runbook and remaining storage/operator actions. C02 receives the exact-head
rollback limit, green source and final review/merge status. Keep `Refs #253`
until the remaining issue conditions are fulfilled.
