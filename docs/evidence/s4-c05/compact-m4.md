# C05 compact M4 and recovery verification — 1 November 2026

PR [#243](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/243),
Refs [#219](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/219).
This record supersedes the default-test-scope statements in the historical
[C05 rehearsal](README.md), without changing its original logs or counts.

## Scope and findings

- Default `pytest` selects only the two P0 files (37 logical IDs, 40 items).
  Extended backend/frontend/browser/script regressions are retained as explicit
  opt-ins. CI still runs mandatory P0, traceability, lint/build and secrets.
- The case map now checks the actual default collection; bootstrap regressions
  prove unrelated tests are excluded and inherited real DB/index settings are
  untouched, including when collection fails.
- Restore formerly ignored a destination's hot `-journal`. SQLite could replay
  the old journal over a valid restored snapshot on its first open. The fix
  refuses DB/WAL/SHM/rollback-journal destinations before copying and again
  before publication; the destination must remain reserved from other writers.
- Two real crashed-writer regressions fail on the old executable `42a29d4`.
  Their control opens prove old data is replayed, and the corrected restore
  must fail without touching the source, saved old DB or journal.
  [Old-code red output](checks/compact-storage-red.log). This is bug reproduction,
  not a claim of test-before-feature TDD.

## Candidate and clean installation

Tester: Codex assisting implementation, Windows 11, Python 3.12.6, Node
24.19.0, 1 November 2026 (Asia/Saigon). This is author verification, not an
independent teammate approval. The [manifest](compact-manifest.json) records
source identity, commands, times, lockfiles and built artifact hashes.

A new local clone and new venv were installed from committed `21bd245` using
only SETUP's locked dependency commands. It had no .env, application database
or running server during its first plain/verbose pytest runs. A later review
strengthened assertions in three existing cases (real flushed-insert commit
failure, cookie flags/token exclusion, and refused expired/revoked writes),
keeping all 37 IDs and 40 items. The clean clone was fast-forwarded to final
executable **`132394c57a12b81bf889227f96370f39531bbb08`**, then both default
commands were rerun successfully. Backend/frontend/workflows/lockfiles were
unchanged between these two candidates. Later evidence changes do not alter
that executable/test selection.

| Check | Actual result | Output |
|---|---|---|
| New venv, locked backend/editable install, pip check and npm ci | Exit 0; fresh dependencies, no shared site-packages | [Install](checks/compact-install.log) |
| Literal `pytest` through the documented Windows batch activator | **40 passed, 0 skipped**, 15.25s | [Plain output](checks/compact-literal-pytest.log) |
| `python -m pytest -v` on the final executable | **40 passed, 0 skipped**, 15.28s | [Every test name](checks/compact-verbose-pytest.log), [full saved-output screenshot](checks/compact-verbose-output.png) |
| Explicit focused storage/bootstrap/setup-doc tests | **12 passed**: four storage, three bootstrap, five media setup checks | [Focused output](checks/compact-focused.log) |
| Default TC-ID trace, C03 structure and LF/CRLF exports | 37 IDs map to 40 default nodes; four sections; PASS | [Contract output](checks/compact-contracts.log) |
| Backend/P0 lint, frontend lint and production build | Exit 0 | [Lint/build](checks/compact-build.log) |
| Offline migrated/WAL/index/HTTP restart rehearsal | Two accounts, preferences, ratings and watchlists retained; two HTTP starts, expected Search/Similar results | [Startup output](checks/compact-startup.log) |

The plain/verbose/focused runs report one inherited Starlette/httpx
deprecation warning. It is not a failed or skipped case. The screenshot is a
browser capture displaying the complete saved real command output; it does
not fabricate a native terminal session. Full backend/Vitest/browser suites
were not rerun for this amendment; they remain explicit optional checks.

## Fresh live TMDb application provisioning and recovery

The prior author's loopback-DNS failure is historical. This machine resolved
TMDb normally. An operator token was read privately into importer environment
only; no token was printed, committed or put in frontend configuration.
The live import began on `21bd245`; its backend code and lockfiles are
byte-equivalent at final executable `132394c`.

- Fresh Alembic upgrade/current: single head `a3d1f8b72c44`.
- `--pages 50`: **951 inserted, 49 rejected**, 951 active TMDb movies and
  19 genres. This is up to 1,000 provider rows before validation/deduplication,
  not a guarantee that every machine receives exactly 1,000 valid movies.
- `--enrich-trailers --all`: **951 processed; 858 with trailer, 93 without;
  0 failed, 0 remaining**. Fresh metadata included 951 posters/947 backdrops.
- Explicit index rebuild/check and documented review-account creation passed.
- Three owned backends on ephemeral ports verified health, the 951-movie
  catalogue, details, description Search and Similar, then restart and restore.
  Runtime had a blank token and disabled TMDb networking.
- Two non-empty A/B accounts kept distinct preferences, 2.5/4.5 ratings and
  saved movies across restart. Online backup and restore preserved **all
  logical table rows**, stable IDs and foreign keys. Rebuilt restored index
  remained ready. Reset on the recovered copy cleared only A's genres/ratings;
  both watchlists, B's profile, catalogue and index remained.

Raw [live provisioning output](checks/compact-live-provision.log) and
[HTTP/storage results](checks/compact-live-recovery.json) record actual counts
and hashes without database dumps or account secrets. The initial manual
probe used guest access for authenticated `/api/genres`; correcting that
probe required no application change. The original user database and running
ports were not used or changed.

## Acceptance boundaries

Runtime catalogue provisioning is a manual networked operator step, separate
from token-free pytest and CI. Tokens and database/backups are excluded from
evidence; the owned disposable clone/data are removed after capture. Local
release rehearsal does not claim a cloud deployment. Independent teammate
review/approval and its own reproduction remain required before C05 closes.
C04 owns final board/verbose-output screenshots, report approval and manual PDF
submission; no generated PDF/export tool is added here.
