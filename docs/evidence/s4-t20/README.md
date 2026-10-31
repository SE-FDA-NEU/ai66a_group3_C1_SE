# S4-T20 trailer/backdrop verification

> This record is frozen to the external-link executable commit named below.
> The unpushed embedded-player revision is documented separately in
> [the local preview record](embedded-preview.md).

Issue [#215](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/215),
PR [#242](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/242),
branch `feature/s4-t20-trailer-ui`.

Tested executable commit: `2d030355ba13a2b089df50ec5767bc39964c090f`.
Base main: `4e5259004bd5b0add88fc1ce5d5b74aeed5e517a`, including merged T19.
The following evidence commit changes documentation/results/screenshots only.
Verification was performed on 2026-10-31 by **Codex, assisting the PR author**,
on Windows, Python 3.12.6, Node v24.19.0 and locked Playwright 1.64.1.
This is author verification, not a teammate's independent review.
G4 Go was confirmed by the Product Owner in the implementation request.

## Behaviour and preserved baselines

A valid official YouTube Trailer with a matching canonical HTTPS URL produces
exactly one `Watch trailer` link. It opens a separate tab, uses
`noopener noreferrer` and exposes the new-tab description to assistive technology.
Null, omitted, invalid, unofficial, teaser or mismatched data produces
`Trailer unavailable` without a link. Movie changes clear the former action;
an older response cannot restore another movie's trailer. No iframe, autoplay
or full-film viewing is introduced.

The production backend, database schema, ranking and existing backdrop component
remain unchanged by T20. The correct Sprint 3 baselines are
[S3-T37 #179](../s3-t37-backdrop-ui/README.md) and
[S3-T28 #131](../s3-t28-backdrop-acceptance/README.md).
[T19 live-catalogue evidence](../s4-t19-live-20261031.md) is prior evidence;
these new T20 runs do not claim another live TMDb import or YouTube playback.

## Real API/database/browser acceptance

The original browser suite returned mocked API payloads and failed every image
request. That could not prove the backdrop-present combinations. The replacement
suite starts the existing isolated FastAPI acceptance harness with migrated
SQLite, builds the real shared NLP index, and reads the production detail API.
Only external artwork and the external YouTube navigation destination are
intercepted. API responses are not mocked.

The `trailer-media` scenario inserts synthetic, explicitly named fixture movies
in a temporary database. It never modifies the developer's account database.
Successful image responses use the committed SVG test artwork; the broken-image
case returns 404. Thus a missing image and a successfully loaded backdrop are
different observations, not two forms of the same fallback.

| Fixture | API backdrop | API trailer | Expected and observed UI |
|---|---|---|---|
| `both` | Present | Official YouTube Trailer | Loaded backdrop, exactly one trailer link |
| `backdrop` | Present | Null | Loaded backdrop, unavailable text, no trailer link |
| `trailer` | Null | Official YouTube Trailer | Gradient fallback, exactly one trailer link |
| `neither` | Null | Null | Gradient fallback, unavailable text, no trailer link |
| `broken` | Present, image returns 404 | Official YouTube Trailer | Broken-image fallback, trailer remains available |

The first four combinations run in **both themes at 375, 768 and 1440 px**:
24 matrix entries. Every expected backdrop has `naturalWidth=1600`, the loaded
class and visible image; each layout has no horizontal overflow. Additional
tests verify a gated SPA movie change, a late real detail response after Back,
and actual Tab/Enter navigation to a separate YouTube tab with visible focus.

Machine-readable observations:

- [Production detail API responses](results/production-details.json).
- [All 24 observed combinations](results/media-matrix.json).
- [Released old-response gate](results/released-old-response.json).
- [Four browser runs: zero page errors and zero TMDb metadata requests](results/browser-observations.json).
- [T20 report metadata/results](results/t20-summary.json).

Screenshots were recaptured by the browser suite on the tested executable tree,
and visually checked for desktop/mobile layout and trailer availability:

| Screenshot | Observation |
|---|---|
| [Dark desktop: both present](screenshots/dark-1440-both.png) | Backdrop loaded and trailer link present |
| [Dark desktop: backdrop only](screenshots/dark-1440-backdrop.png) | Backdrop loaded, no trailer action |
| [Dark desktop: trailer only](screenshots/dark-1440-trailer.png) | Gradient fallback, trailer action present |
| [Dark desktop: neither](screenshots/dark-1440-neither.png) | Both fallbacks |
| [Light mobile: neither](screenshots/light-375-neither.png) | 375px layout with unavailable text |
| [Light tablet: both](screenshots/light-768-both.png) | 768px layout with loaded backdrop and trailer |

[Screenshot SHA-256 values](results/screenshot-sha256.json) identify the captures.
They are synthetic acceptance screenshots, not images of a live TMDb movie.

## Regression results on the tested commit

All commands below exited **0**. Run from the repository root after dependency
installation in [SETUP](../../SETUP.md#s4-t20-trailerbackdrop-acceptance).

| Command | Observed result | Output |
|---|---|---|
| `.\.venv\Scripts\python.exe -m pytest -q` | 799 passed, 1 inherited skip, 210 subtests passed; 204.50s | [backend](results/backend.txt) |
| `npm.cmd --prefix frontend test -- --maxWorkers=4` | 451 passed, 39 files | [frontend](results/frontend.txt) |
| `npm.cmd --prefix frontend run test:t20:ui` | 4 passed, 24 media/theme/width combinations; owned DB removed | [T20](results/t20.txt) |
| `npm.cmd --prefix frontend run test:t01:ui` | 16 passed, 1 live-catalogue-only skip; owned DB removed | [T01](results/t01.txt) |
| `npm.cmd --prefix frontend run test:s04:e2e` | 10 passed, 1 live TMDb-only skip; owned DB removed | [S04/S13](results/s04-s13.txt) |
| `npm.cmd --prefix frontend run test:t04:integration` | 1 passed | [ranking bridge](results/t04.txt) |
| `npm.cmd --prefix frontend run test:t16:integration` | 1 passed | [filter bridge](results/t16.txt) |
| `npm.cmd --prefix frontend run test:t33:integration` | 1 passed | [rating bridge](results/t33.txt) |
| `npm.cmd --prefix frontend run lint` | Passed | [lint](results/lint.txt) |
| `npm.cmd --prefix frontend run build` | Passed, 80 modules | [build](results/build.txt) |

Backend Ruff passed; Alembic reports exactly one head, `a3d1f8b72c44`.
The C03 verifier passed (232 links, no missing target); its LF/CRLF export
verification passed with seven identical normalized hashes. T05 traceability
mapped all 37 unique P0 case IDs to 48 collected pytest nodes. The shared
runner's three forced-exit/startup-cleanup tests passed. `git diff --check` passed.

The full backend run includes official-only trailer selection, deterministic
ties, successful-empty versus failed enrichment, populated/fresh migration,
catalogue/account/preference/rating preservation, NLP/index freshness and all
six P0 stories. Browser/integration regressions additionally cover rating saves,
S07 Similar, S08 Search, detail return, ordering, filters and account boundaries.
No live account database was upgraded, imported or reset by these tests.
The inherited FastAPI/Starlette warning about `httpx` is recorded in the logs.

The T01 EBUSY/Vite failures in the
[earlier author record](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/blob/c20383ec39af8705a779174b5cde4343525e679a/docs/evidence/s4-t20/README.md)
were not reproduced on this final executable tree. The passing command and
`s04_temporary_database_removed=true` are captured above.

## Clean-clone rehearsal

A separate folder was cloned with `--no-hardlinks`, checked out at the exact
tested commit and given a **new virtual environment and new `node_modules`**.
No `.env`, application database, existing virtual environment or dependency
directory was copied. Pip's package-download cache and the host's installed
Playwright Chromium were reused; this is not a claim of uncached downloads.

The following installation/build steps all exited 0:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.lock.txt
.\.venv\Scripts\python.exe -m pip install -e './backend[dev]' --no-deps
.\.venv\Scripts\python.exe -m pip check
npm.cmd --prefix frontend ci
npm.cmd --prefix frontend run build
```

With `TMDB_READ_ACCESS_TOKEN` empty, `TMDB_NETWORK_DISABLED=1`, no browser override
and no shared-environment Python override, the clone then passed:

```powershell
npm.cmd --prefix frontend run test:t20:ui
.\.venv\Scripts\python.exe -m pytest -c pytest.ini tests backend/tests/test_trailer_enrichment.py backend/tests/test_trailer_all.py backend/tests/test_backdrop_acceptance.py backend/tests/test_s04_acceptance_gate.py -q
.\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini heads
```

- T20 browser: **4 passed**, default Playwright Chromium, database removed.
- Root P0 tests plus trailer enrichment/all-catalogue/backdrop/gate tests:
  **83 passed**.
- Alembic: one head, `a3d1f8b72c44`.

See the [exact commands/results](results/clean-clone.txt) and
[clean-clone report metadata](results/clean-clone-t20-summary.json).
[213 source-file hashes](results/tested-source-sha256.json) were compared against
the committed Git blobs, the worktree and the clean clone, normalizing CRLF/CR
to LF. Later documentation-only evidence does not change that executable tree.
This rehearsal validates offline T20 acceptance setup; it does not replace
SETUP's live TMDb catalogue-import steps or the independent reviewer gate.

`npm ci` also reported existing development-dependency advisories: 18 total,
including 4 high. `npm audit --omit=dev` reported 0. The lockfile is identical
to base main. No dependency upgrades are bundled into this media-verification
change. The [audit summary](results/dependency-audit.json) records this limitation.

## Hosted checks and independent review

`.github/workflows/s4-t20-trailer.yml` now runs the offline production API/SQLite
browser suite, T01 regression, P0/media backend tests and focused component
tests on Ubuntu with Playwright Chromium. It publishes SHA-labelled test
artifacts. See [live PR checks](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/242/checks)
for hosted results; local runs above are not represented as hosted CI results.

**Pending:** the assigned non-author reviewer (`NguyenTuanAnh0608`, or another
eligible teammate) must independently rerun the final candidate, record their
identity/date/SHA/expected-versus-actual results and submit a substantive GitHub
review before merge. No independent approval or completed reviewer rehearsal
is claimed here. Keep `Refs #215` and the issue open until that gate is met.
