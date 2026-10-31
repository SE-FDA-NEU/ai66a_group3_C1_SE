# S4-T20 official trailer UI: local implementation and verification

Issue [#215](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/215).
Local implementation branch `feature/s4-t20-trailer-ui` began from fetched
`upstream/main` `4e5259004bd5b0add88fc1ce5d5b74aeed5e517a`, which includes
merged S4-T19 #214 and the T01 UI baseline. Executable implementation commit:
`81f2941db2f7d28052690f6a409ceff57fbde19f`. No push, PR, merge or issue
closure was performed. The browser regression follow-up commit is
`a65e8df6aa51023fbda4a032c285fdf911fd1315`, the tested executable SHA.

## Admitted scope and boundaries

The optional trailer capability is enabled on this local branch. A detail
response with an official YouTube Trailer and matching canonical HTTPS URL
renders exactly one `Watch trailer` action. Null, omitted, invalid, mismatched,
teaser or unofficial data renders `Trailer unavailable` without an action.
Navigation to another movie clears the former action immediately; late results
cannot restore it. The destination opens in a new tab with `noopener noreferrer`
and an accessible new-tab description. There is no iframe, autoplay, full-film
viewing, provider metadata request or client token.

Backdrop remains the existing Sprint 3 component. Its baseline is
[#131 / S3-T37](../s3-t37-backdrop-ui/README.md) and the original
[#131 backdrop acceptance](../s3-t28-backdrop-acceptance/README.md).
This task does not re-accept or reimplement Sprint 3 backdrop functionality.
The backend selection/import/API from S4-T19 is also retained without code
changes; its [real SQLite/API/browser evidence](../s4-t19-live-20261031.md)
is a prior baseline, not a new final-candidate review.

## Reproduce and observed results

Run from repository root with the locked frontend dependencies and local Python
environment described in [SETUP](../../SETUP.md):

| Command | Observed result on executable tree at `a65e8df` |
|---|---|
| `npm.cmd --prefix frontend test -- --maxWorkers=4` | 451 passed in 39 files |
| `npm.cmd --prefix frontend run test:t20:ui` | 2 passed; 24 backdrop/trailer/theme/width combinations at 375, 768 and 1440 px, plus broken-image/rapid-navigation check |
| `npm.cmd --prefix frontend run test:t04:integration` | 1 passed; rating-based ranking bridge |
| `npm.cmd --prefix frontend run test:t16:integration` | 1 passed; filter/ordering bridge |
| `npm.cmd --prefix frontend run test:t33:integration` | 1 passed; rating bridge |
| `npm.cmd --prefix frontend run lint` | Passed |
| `npm.cmd --prefix frontend run build` | Passed |
| `.\\.venv\\Scripts\\python.exe -m ruff check backend` | Passed |
| `.\\.venv\\Scripts\\python.exe -m pytest -q` | 799 passed, 1 skipped, 210 subtests passed in 382.76s; one inherited Starlette/httpx deprecation warning |
| `.\\.venv\\Scripts\\python.exe -m alembic -c backend/alembic.ini heads` | One head: `a3d1f8b72c44` |
| `git diff --check` | Passed |

The T20 browser test uses intercepted local API/image fixtures. It checks
keyboard focus, link URL/attributes, an intercepted new-tab navigation,
absence of horizontal overflow, no iframe, broken-image fallback, old-trailer
removal during a delayed detail response and zero browser requests to the
TMDb metadata host. The fixture screenshots show the final executable UI:
[present, dark desktop](screenshots/dark-1440-both.png) and
[absent, light 375px](screenshots/light-375-neither.png). They are synthetic
fixtures, not a live-catalogue or YouTube-playback test. Automated tests do not
require YouTube playback or external networking.
Their SHA-256 hashes are respectively
`487b28f300887632617990352a14478aa425c74756db89963e7ffc7ca6f2d18e` and
`fc4fdb763f33038eebc7427edc5417f1425b058e1d8a2478d365c881b5669374`.

The existing T01 browser regression executed 16 tests successfully with one
intentional imported-catalogue skip. On that run, its Windows runner exited 1
after tests due to `EBUSY` while removing its owned temporary SQLite file.
The test assertions themselves passed. A second run reached two passed tests,
then the managed Vite server stopped responding at `127.0.0.1:5174`; 14 tests
failed with connection refusals or absent Similar cards and one was skipped.
Its runner again reported `EBUSY` for its owned temporary SQLite file. These
runs leave T01 as a regression-gate gap, not a passing command. The separate
T20 browser suite and Vitest/integration suites exited 0.

## Backend and independent acceptance status

The first root run produced 798 passed, 1 skipped and 1 failure because this
machine's `.venv\\Scripts\\pytest.exe` launcher still pointed at a removed
`.venv-new` Python path. That local launcher was regenerated from the installed
pytest package without changing repository files; the three direct setup
tests then passed. A complete rerun passed as recorded above.

The backend test suite exercises official-only selection, deterministic ties,
successful-empty versus failure, media-only account/catalogue preservation,
populated/fresh migration, single Alembic head, index freshness, and the
repository P0 acceptance cases. S07 Similar cosine order and S08 title-first browser paths were
among the passing T01 checks. No account database was migrated or enriched by
this UI task; database upgrade/import acceptance remains based on synthetic
isolated fixtures and prior S4-T19 evidence.

An independent non-author reviewer still needs to rerun the actual final
candidate against a real isolated API/DB/browser, record tester identity,
expected/actual results and SHA, and provide substantive review. Hosted CI,
PR linkage and issue closure require a push and review and are pending by the
requester's no-push instruction. This local author record does not claim those
external gates passed.
