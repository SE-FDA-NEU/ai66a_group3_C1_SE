# S4-T01 local verification — early branch, not final approval

Refs [#195](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/195).
Date: 2026-10-24 (Asia/Saigon). Base main:
`3078a9c6fd3dff1f0b8576bc7411f469c7a98fdf`.

PO explicitly permitted implementation/push before C03 is merged. C03 #217
remains open. This evidence records local author-assisted checks, **not** an
independent teammate approval, final CI status, complete M4 acceptance, submission
receipt, or permission to merge. Final contract/migration reconciliation and a
substantive independent GitHub Review changes are pending.

## Executed checks

| Check | Actual local result |
|---|---|
| Pre-change backend baseline | 447 passed, 1 skipped; existing Starlette/httpx deprecation warning |
| Pre-change frontend baseline | 232 tests passed |
| Poster mapper TDD RED | Two new assertions against unchanged production returned None instead of the expected w500 URL; 2 failed for the intended missing behavior, not import/setup failure |
| Poster mapper GREEN | The same 2 assertions passed after implementation; expanded poster/import/migration coverage added |
| Full isolated backend suite after final preservation/rollback coverage | 479 passed, 1 skipped, 1 existing deprecation warning |
| Frontend unit suite | 251 tests passed across 24 source test files |
| T01 fixture browser verifier | 4 passed; 1 separate imported-DB mode skipped intentionally |
| T01 imported-DB browser verifier | 1 passed; 4 fixture-mode cases skipped intentionally |
| Real DB T16 filtering integration | 1 passed |
| Real DB T33 rating integration | 1 passed; committed/draft/failure/isolation assertions retained with radio selectors |
| Existing Chromium S04/S13 acceptance | 10 passed; 1 separate live-TMDb mode skipped intentionally |
| Existing T28 offline browser/media verification | 18 cases passed; own disposable DB removed |
| S04 runner lifecycle tests | 3 passed |
| M3 verifier lifecycle/newline tests | 11 passed |
| Backend Ruff + frontend ESLint + production build | Passed |

The initial full-backend run found four exact-response oracles missing the new
nullable `posterUrl`. They were updated additively (`None`) while retaining all
original values, ordering, metadata and isolation checks; the full suite then
passed. Two additional tests then verified exact account/preference/rating row
preservation across backfill (including retired movies and backdrops) and rollback
after an injected second database-write failure; the final total is 479 passed.
No failing tests were removed or skipped to obtain GREEN.

Vitest now explicitly collects `src/tests/**/*.test.{ts,tsx}`; dedicated
integration/browser suites keep their own commands. Previously ignored review
checkout copies under `frontend/test-results` were accidentally discovered by
the default test/lint tools. ESLint excludes these generated artifacts and uses
an explicit tsconfig root. No user review checkout was deleted.

### T01-specific browser checks

`npm.cmd --prefix frontend run test:t01:ui` uses the existing owner-cleanup runner
with the new T01 Playwright config and disposable migrated database. It verifies:

- Existing public pages in both themes at 375/768/1440px, no horizontal overflow;
  semantic text/primary/error color contrast, control boundary contrast, reload
  persistence and reduced-motion preference.
- Actual login/preferences flow, genre draft preservation during theme change;
  native Arrow/Space integer-star selection with zero writes until Save; one
  real server write, saved state after reload and responsive details.
- Blocked browser storage without a crash, and page-2 URL/order preservation
  during a theme toggle.
- One explicitly separate live-preview test (skipped in fixture mode); see below.

Unit tests additionally cover poster null/unsafe/broken-image fallback, image
failure reset on source change, login draft preservation, five native radios,
no write on hover/focus, modal labels/focus loop/Escape/restore/pending, safe
external trailer-link patterns and non-clickable provider-name examples.
Existing rating suites retain delayed account/movie and save-retry cases.

## Real imported-catalogue smoke and screenshots

A read-only SQLite backup copied the user's accepted **255-movie active TMDb
catalogue** into an ignored private QA database. Only the copy was migrated and
enriched; the original database/account data was not modified. The preview ran
against that copy. Neither SQLite file nor `.env`/credentials is committed.

Actual poster-only enrichment output on the copy:

```text
eligible=255
fetched=255
remaining=0
updated=255
cleared=0
unchanged=0
missing=0
invalid=0
```

The first image smoke timed out at an overly short 5-second browser polling
budget while CDN loading was pending. A HEAD connectivity check returned 200;
the unchanged image URL passed the rerun with a 30-second bounded polling budget.
No mocked artwork, disabled TLS check or replacement CDN was used to pass it.
The live browser run loaded a real poster with positive natural width, opened
details from the card, switched both themes and checked 375px overflow; no page
JavaScript error was observed. This is external-network smoke, not deterministic
CI or a guarantee of future CDN availability. Failed CDN images retain fallback.

| Image | Provenance |
|---|---|
| [Home — dark](../images/sprint4/t01/t01-home-dark.png) | Actual 255-movie imported DB copy, real CDN posters |
| [Home — light](../images/sprint4/t01/t01-home-light.png) | Same copy/order/page, theme toggle only |
| [Details — light](../images/sprint4/t01/t01-details-light.png) | Same copy, clicked first Home card; poster + existing backdrop |
| [Details — 375px dark](../images/sprint4/t01/t01-details-mobile-dark.png) | Same copy, public guest state |
| [Saved stars — fixture](../images/sprint4/t01/t01-rating-dark-fixture.png) | Real browser/API/disposable SQLite, explicitly synthetic catalogue/account; not TMDb ranking evidence |

Browser screenshots show the rendered viewport/page, not browser chrome. They
are T01 implementation evidence, not a substitute for any milestone screenshot
that requires a visible address bar.

## Reproduce on your machine

From the repository root, keep the real configured `DATABASE_URL`, back it up
before migrating, and use the root `.env` for the server-only token:

```powershell
$env:PYTHONUTF8 = "1"
.\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini upgrade head
# Existing accepted catalogue: optional poster-only enrichment, not a re-import
.\.venv\Scripts\python.exe -m app.cli.import_tmdb_catalogue --enrich-posters --limit 300
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --reload
```

In a second terminal: `npm.cmd --prefix frontend ci`, then
`npm.cmd --prefix frontend run dev`. Open the Vite URL and test Home/Popular,
theme reload, sign-in → Preferences → Recommendations → details, star selection
without saving, explicit Save, reload and detail return. A fresh clone instead
follows `docs/SETUP.md` and its real `--pages 15` TMDb import. Do not change to a
synthetic/demo database to create the review account.

Automated commands (stop your own conflicting test ports first; runners refuse
to silently reuse an unrelated server):

```powershell
.\.venv\Scripts\python.exe backend/scripts/run_isolated_tests.py -q
.\.venv\Scripts\python.exe -m ruff check backend
npm.cmd --prefix frontend test
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run build
npm.cmd --prefix frontend run test:t16:integration
npm.cmd --prefix frontend run test:t33:integration
npm.cmd --prefix frontend run test:s04:e2e
npm.cmd --prefix frontend run test:t28:acceptance
npm.cmd --prefix frontend run test:t01:ui
```

Optional read-only live screenshot verifier: first start an explicitly prepared
preview on a disposable backup of an imported database; it never creates that
backup or mutates accounts itself. With its URL (no fixture servers started):

```powershell
$env:T01_LIVE_URL = "http://127.0.0.1:5173"
$env:T01_SCREENSHOT_DIR = Join-Path (Get-Location) "frontend/test-results/t01-live"
npm.cmd --prefix frontend run test:t01:ui
Remove-Item Env:T01_LIVE_URL
Remove-Item Env:T01_SCREENSHOT_DIR
```

Remaining merge conditions are explicit in the
[contract handoff](../s4-t01-ui-contract.md#reconciliation-and-review-checklist).
