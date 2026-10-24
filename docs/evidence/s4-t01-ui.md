# S4-T01 local verification — early branch, not final approval

Refs [#195](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/195).
Date: 2026-10-24 (Asia/Saigon). Base main:
`3078a9c6fd3dff1f0b8576bc7411f469c7a98fdf`.

PO explicitly permitted implementation/push before C03 was merged. The original
executions below predate its merge; the post-C03 reconciliation is recorded
separately below. This evidence records local author-assisted checks, **not** an
independent teammate approval, final CI status, complete M4 acceptance, submission
receipt, or permission to merge. A substantive independent GitHub Review changes
and required checks on the final pushed candidate remain pending.

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
theme reload, sign-in → Home → Start → Preferences → Recommendations → details, star selection
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

## PO-authorized Home and intentional-personalisation follow-up — 2026-10-24

This follow-up is one additional commit on the existing T01 PR, based on
`3153028cbb057ce233da90f7467197e817cfeca2`; the previous ten commits are not
rewritten. It replaces the old visible Start paragraph with a compact cinematic
hero, Start / Explore Catalogue actions and one persistent My recommendations
navbar entry. Ordinary login lands on Home without requesting personalisation;
an explicit guest Start returns to Preferences after login/registration. The
picker keeps the real 1–5 rule, restored saved selections and explicit server
save. Default landing and protected-route intent are separately tested.

The existing poster/backdrop pipeline, star component and rating API, auth/session
provider, backend application/schema and recommendation/filter/pagination logic
are unchanged by this follow-up. Test/verifier entry steps were updated to make
the now-explicit navigation, retaining their ranking, failure and isolation
assertions rather than dropping or skipping old cases.

### Executed follow-up checks

| Check | Actual result |
|---|---|
| Focused onboarding/auth/preferences unit suites | 62 passed |
| Full frontend unit regression on final source | 276 passed, 26 files; 21.80s |
| Full isolated backend regression on final source | 479 passed, 1 skipped, 1 existing deprecation warning; 142.66s |
| T01 fixture browser | 6 passed, 1 separate imported-mode skip; 16.1s |
| S04/S13 real browser regression | 10 passed, 1 separate live-mode skip; 22.8s |
| T16 DB integration | 1 passed; 5.03s |
| T33 DB integration | 1 passed; 6.14s |
| T28 offline browser/media regression | 18 cases passed, temporary database removed |
| T34 real browser rating/auth/failure/race verifier | PASS; guest/save/retry/A-B isolation/delayed account+movie/revoked+expired session/return context assertions retained |
| Imported-catalogue read-only browser | 1 passed, 6 fixture-mode skips; 14.0s |
| S04 runner / M3 verifier lifecycle suites | 3 / 11 passed |
| Frontend ESLint / TypeScript production build / backend Ruff | Passed; build transformed 64 modules |

The browser fixture report pins the visual test source SHA-256 as
`372e512dfb96aa64736eb9083b527e3fdfa376dd5bf633e1b929757c09be907c`.
T34's final executed candidate/source digest is
`3cdc59bbceb09b63cd73d64616b6a44348918b88eeb32a83bc13ccdd78afe927`.
Reports identify the base SHA plus modified working tree, not a nonexistent
already-committed follow-up SHA. Local full reports remain in ignored
`frontend/test-results`; no credential-bearing traces or database files are
uploaded.

Initial local checks caught TypeScript query-option/regex-lint mistakes in new
tests and old verifier assumptions about the automatic login landing/dropdown.
These were corrected before the final passing runs. The new registration browser
case also needed to wait for the actual registration screen before filling its
same-labelled email field; no application validation was weakened. T34 now reads
the selected native star radio and shared-header identity, and waits for the
Recommendations heading instead of mistaking Home cards during route transition
for ranked results. These changes retain the original exact saved/draft/account
expectations; they are not new product rules.

### Actual screenshots and data safety

The existing QA copy contains **255 active TMDb movies / 255 poster paths**.
It was reopened with SQLite `mode=ro&uri=true`, disabled provider networking and
no usable TMDb token. The live browser refreshed Home dark/light and details
light/mobile screenshots, loaded actual public CDN artwork, and made no account
writes. The QA SQLite SHA-256 before/after was identical. The real development
database and root `.env` were not modified, no import/enrichment was repeated,
and the two owned preview processes were stopped after capture.

- [Updated Home — dark, real TMDb copy](../images/sprint4/t01/t01-home-dark.png)
- [Updated Home — light, same real copy](../images/sprint4/t01/t01-home-light.png)
- [Home — dark, explicitly synthetic offline fixture](../images/sprint4/t01/t01-home-followup-dark-fixture.png)
- [Home — light, explicitly synthetic offline fixture](../images/sprint4/t01/t01-home-followup-light-fixture.png)
- [Home — 375px authenticated light fixture](../images/sprint4/t01/t01-home-followup-mobile-light-fixture.png)
- [Preferences — 375px dark fixture, one selected genre](../images/sprint4/t01/t01-preferences-followup-mobile-dark-fixture.png)

The offline fixture intentionally blocks image networking and demonstrates poster
fallback; it is not presented as imported-TMDb data. Synthetic emails shown there
are disposable test identities, not real accounts. The real-catalogue captures
show guest state and do not expose account credentials. Screenshots are real
browser captures, not edited reference images.

### Remaining coordination, not waived

C03 #217 was pending at that follow-up capture; it is now merged and incorporated
in this candidate. Independent final review/CI remain pending. Story #45 currently
contains both Home-after-login and the obsolete unconditional Recommendations
landing AC. Replace the obsolete AC with the reviewed explicit-intent rule before
merge; requirements.md and this proposal already reflect the PO's new request.
Historical M3 evidence is not rewritten or falsely reaccepted. No new Story,
watchlist/search/reset/trailer feature or Story Points are claimed here.

## Post-C03 reconciliation and repeated verification — 2026-10-24

C03 PR #222 is merged at main `37c2f66`. This reconciliation merges that
accepted main into the existing T01 history (`73e86cf`), resolves the API and
requirements conflicts, and retains all C03 ranking/NLP/profile/watchlist/test
contracts. The executable `backend/` and `frontend/` content is unchanged from
`73e86cfbec2e39aa02baf53ee18fed80354f331e`; these are new executions on the
reconciled working candidate, not newly invented historical results.

The API now distinguishes implemented T01 poster/navigation changes from
future Sprint 4 capabilities. The original C03 hash capture is preserved;
the consumer matrix adds the current normalized API hash. No dependency on
future C05 root-pytest implementation is introduced into T01 closure.

| Repeated command/check | Observed result |
|---|---|
| `python backend/scripts/run_isolated_tests.py -q` | 479 passed, 1 skipped, 1 existing deprecation warning; 166.16s |
| `python -m pytest backend/tests/test_poster_pipeline.py -q` | 27 passed; 5.37s; includes fresh/populated migration/import preservation |
| `npm --prefix frontend test` | 276 passed, 26 files; 30.80s |
| `npm --prefix frontend run test:t01:ui` | 6 passed, separate imported-DB mode skipped; 19.5s |
| `npm --prefix frontend run test:s04:e2e` | 10 passed, separate live-provider mode skipped; 21.1s |
| `npm --prefix frontend run test:t16:integration` | 1 passed; 4.49s |
| `npm --prefix frontend run test:t33:integration` | 1 passed; 6.83s |
| `npm --prefix frontend run test:t28:acceptance` | 18 passed cases; temporary database removed |
| Runner / M3 verifier lifecycle suites | 3 / 11 passed |
| `python scripts/verify_s4_c03_contract.py` | PASS; 194 local paths checked, 35 planned P0 IDs, 10 feature oracles |
| `python scripts/test_s4_c03_contract_line_endings.py` | LF and CRLF PASS; seven identical normalized hashes |
| Backend/scripts Ruff; frontend lint/build | PASS; 64 frontend modules transformed |
| `alembic -c backend/alembic.ini heads` | One head, `d8a4e6f20195`; C03 adds no migration |

Initial restricted-sandbox attempts failed before meaningful execution because
the sandbox denied temporary-directory access (and Vitest worker module files).
They are environment failures, not feature RED evidence. The commands above
were rerun successfully outside that sandbox using disposable databases.
No production assertion, timeout or test was weakened to obtain these results.

No live import, poster enrichment, real account mutation or new screenshot
capture was performed in this reconciliation. Existing imported-catalogue
screenshots remain evidence for the identical executable T01 source, not a
claim of a second live run. Root `.env`, the real catalogue and user-owned
untracked `tmp/` remain untouched.

Independent non-coauthor review, required checks on the final pushed head and
the conflicting live Story #45 AC still need resolution before acceptance.
This does not claim full M4 root-pytest coverage or later-feature delivery.
