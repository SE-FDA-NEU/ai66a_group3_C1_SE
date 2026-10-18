# M3 P0 acceptance handoff — #127 → #136

Updated **2026-10-18**, Windows verification by Codex at the PO's request.
Executable verification is not independent teammate approval.

## Current candidate and decision

PR [#184](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/184) integrates
merged C04 [#185](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/185),
main [`0c4273a`](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/commit/0c4273ab792becb060fefd5e7341e755ed28d0a5).
Product application files match that main; this follow-up changes acceptance
tooling, CI and docs, not product routes/requirements.

Executable runs used integration snapshot `05a78c1f503c10f6f5047655acb3800b21966e99`,
before adding reports and amending the single follow-up commit. That is an
**unpublished local snapshot**, not a GitHub receipt. [verification.json](verification.json)
pins normalized executable-source fingerprints, so the tested source can be
compared with the published commit without inventing a self-referential SHA.
The final PR head needs its own hosted checks and independent review.

All six P0 Stories and separate P1 S06/S09 remain **partly works** under the
AC + DoD rule. Functional assertions below pass, but human session details and
final acceptance review remain open. One intermittent T33 bridge failure is
retained below. Do not claim an unconditional release pass or close Stories.

## Latest evidence, separated by data source

| Evidence | Actual result / scope |
|---|---|
| [M3 live report](latest/live/results.json), [console](latest/checks/m3-live.txt) | Five grouped first-screen browser seam checks PASS; cleanup PASS; accepted **255-movie TMDb** snapshot copied, not M2 seed. |
| [T22 live](latest/checks/t22-live.txt) | Five S01 ACs, zero/six server validation, retained draft and visible Save retry PASS on another snapshot backup. |
| [S13 live](latest/checks/s13-live.txt), [structured report](latest/s13-live-results.json) | 1 browser case PASS; real sessions/preferences/rating isolation on accepted-snapshot copy. |
| [S04/S13 synthetic](latest/checks/s04-s13-synthetic.txt), [report](latest/synthetic-results.json) | 10 PASS / 1 intentionally opt-in live skip; ranking ties, null fields, empty/error/retry, delayed responses and ownership. |
| [Backend](latest/checks/backend-tests.txt) | **419 PASS / 1 inherited skip**, isolated migrated DB; actual HTTP/restart/rollback/security included. |
| [Frontend](latest/checks/frontend-tests.txt), [lint](latest/checks/lint.txt), [build](latest/checks/build.txt), [Ruff](latest/checks/ruff.txt) | **236 PASS**; lint/build/Ruff PASS. Vitest alone is not browser E2E. |
| [M3 verifier regressions](latest/checks/m3-verifier.txt) | **11 PASS on Windows**, including real deletion lock, process tree, CRLF equality and failure reporting; now included in Linux/Windows CI. |
| [S04 cleanup](latest/checks/s04-cleanup.txt), [T16](latest/checks/t16.txt) | 3 cleanup PASS; filter React/API/DB integration 1 PASS. |
| [T12](latest/checks/t12.txt), [T21](latest/checks/t21.txt) | Real browser, synthetic DB: matching/no-match/503/retry/auth and exact popular order/empty PASS. |
| [T33 first attempt](latest/checks/t33.txt), [standalone rerun](latest/checks/t33-rerun.txt) | First attempt failed at logout destination (`/login` instead of `/`); rerun passed. Five further standalone repetitions also passed; see limitations. |
| [T28 synthetic](latest/checks/t28-synthetic.txt) | 18 backdrop compatibility checks PASS; temporary DB removed. |
| [Merged C04 fresh clone](../s3-c04-clean-clone.md), [visible restart journey](../s3-c04-final/live/results.json), [backdrop](../s3-c04-final/backdrop-live/results.json) | Reused prerequisite: locked fresh setup, real import, visible rating save, process restart, A/B separation and desktop/mobile images. Not relabelled as a new T25 install. |
| [Updated C04 clone replay](latest/clone-live/results.json) | Existing fresh-installed clone advanced to integrated source: pip check, 11 verifier tests, build and five live first-screen checks PASS on its separate 20-film snapshot. No new dependency installation claimed. |

M3 runtime children explicitly set `TMDB_NETWORK_DISABLED=1` and a blank token.
Runtime acceptance requires no TMDb API request. Normal configured operator
imports remain available; CDN checks are separate from offline API acceptance.

## Environment and safe provenance

- Windows build 26300 x64; Python 3.12.6; Node v24.19.0; npm 11.17.0.
- Microsoft Edge 155.0.4283.62 via `M3_BROWSER_CHANNEL=msedge` /
  `S04_BROWSER_CHANNEL=msedge`; default CI browser stays Playwright Chromium.
- Active revision `34b442f2-f5a8-4317-9f2f-468e6ec06a20`, provider `tmdb`:
  255 active distinct movies, 255 finite popularity values/fetch timestamps,
  17 associated genres; migration head `c6f8a2d4e901`.
- Source opened read-only and copied using SQLite backup. All acceptance accounts
  and writes occur in disposable copies; no shared-source migration/import/seed.
- Source SHA-256: `a0488d0bf5f8ef63ac58e174a3749d705c35cd5efcbab1229893259489931776`.
  Final safety verification must match. No DB, dump, cookie, password or token
  is committed. Missing year/overview cases are synthetic, not live claims.

## Complete P0 AC-to-evidence matrix

AC order follows GitHub Stories. PASS denotes functional assertion only, not
the Story's remaining independent AC + DoD sign-off. Links above locate reruns;
the [historical detailed matrix](historical-initial-report.md#p0-ac-to-evidence-matrix)
retains the exact test-case mapping and original run limitations.

| Story / AC | Functional assertion and latest/reused executable proof |
|---|---|
| S01 #17 AC1 | PASS: signed-in home Start opens picker. T22 AC1 + M3 live. |
| S01 AC2 | PASS: one/five genres commit and navigate; fresh current-account GET follows PUT. T22 AC2 + M3 live. |
| S01 AC3 | PASS: zero stays at picker with correction, no overwrite. T22 AC3 + live capture. |
| S01 AC4 | PASS: sixth rejected/first five kept; zero/six API payloads cannot overwrite. T22 AC4. |
| S01 AC5 | PASS: revisit restores; B begins empty and cannot read A. T22 AC5 + S13. |
| S02 #18 AC1 | PASS: at most 10 distinct current-genre matches. T12 oracle + live. |
| S02 AC2 | PASS: title/genres and matching-genre reason. T12 cards + live DTO/card equality. |
| S02 AC3 | PASS: true no-match, at most 10 alternatives, Edit/Retry; zero-alternative case. T12 + S04. |
| S02 AC4 | PASS: real source/SQL 503 shows Error/Retry, not empty; preferences unchanged. T12 + S04. |
| S02 AC5 | PASS: visible Retry after recovery restores personalised cards. T12 + S04. |
| S03 #19 AC1 | PASS: visible card opens matching title/year/genres/overview. M3/S13 live + detail tests. |
| S03 AC2 | PASS: invalid-ID negative test shows `Movie not found` and Return to catalogue. S13 + backend 404. This typed invalid URL is not normal discovery. |
| S03 AC3 | PASS, synthetic: null year/overview each show `Information unavailable`. S04 + detail tests. |
| S03 AC4 | PASS: visible detail return with saved preferences restored. M3/T22 + return-context tests. |
| S04 #20 AC1 | PASS: non-personalised top 10 equals live DB oracle; synthetic A90/B80/C80 tie/limit/distinct. S04 + live. |
| S04 AC2 | PASS: visible Enter preferences opens picker. S04 + live. |
| S04 AC3 | PASS, synthetic: empty/no-finite-popularity guidance, zero fake cards, distinct from SQL error. S04. |
| S04 AC4 | PASS: save refreshes personal/no-match data; delayed pre-save cannot overwrite. S04 + live. |
| S12 #44 AC1 | PASS: home → Sign in → Create account, 201/one row/login redirect. M3 live. |
| S12 AC2 | PASS: uppercase duplicate, 409, `This email is already registered`, no extra row. Live. |
| S12 AC3 | PASS: invalid email/short password identify both fields; zero new rows. Live + backend. |
| S12 AC4 | PASS: Argon2id stored/public DTO only id/email; boolean only, no hash retained. Live + registration tests. |
| S13 #45 AC1 | PASS: login/session/current-account recommendations. S13 synthetic/live + auth tests. |
| S13 AC2 | PASS: unknown/wrong both 401/`Email or password is incorrect`, no cookie. S13 + backend. |
| S13 AC3 | PASS: guest private entry/rating CTA → login, no private reads/writes; expired/revoked rejected. S13 + backend. |
| S13 AC4 | PASS in browser/API suites: logout → home, replay 401, later private entry → login; restart persists revocation. Separate T33 intermittency remains documented. |
| S13 AC5 | PASS: B cannot read/update/recommend/reset A; delayed A cannot replace B; relogin restores A. S13 + backend. |

Backend proof reuses `test_auth_acceptance.py`, preference/rating/reset suites
and `test_restart_persistence.py`: forged IDs, invalid origin/confirmation,
rollback between deletes/at commit and actual uvicorn restart. Reset remains
**API-only**; the profile placeholder is not a completed reset UI. Ratings
persist but Sprint 3 ranking is **genre + popularity**, not rating-adjusted S05b.

P1 outside the six-P0 gate: S06 #23 filter/empty/reset/unchanged preferences
passed (T16); S09 #31 exact order/empty passed (T21 + live DB oracle). Both remain
**partly works** until final DoD, as do all six P0. No new closure was performed.

## Route/UI handoff for #136

| Route | Visible entry / return |
|---|---|
| `/` | First screen; Return to catalogue/Browse the catalogue |
| `/register` | Home → Sign in → Create an account |
| `/login` | Home Sign in/guest Start; rating CTA |
| `/preferences` | Signed-in Start; Enter preferences/Change my genres |
| `/recommendations` | Login, Save preferences, My recommendations |
| `/movies/:movieId` | Movie-card detail link; context-aware back link |
| `/popular` | Home Popular movies; Back to popular movies |
| `/profile` | Protected placeholder, guard test only |

Current captures: [home](latest/live/live-first-screen.png),
[registration correction](latest/live/live-registration-validation.png),
[mobile BR1 correction](latest/live/live-mobile-corrective-message.png),
[personalised data](latest/live/live-personalised-mobile.png).
Historical [loading](synthetic/recommendation-loading.png),
[empty](synthetic/recommendation-empty.png), [error](synthetic/recommendation-error.png),
[null detail](synthetic/missing-detail-fields.png) keep their original version;
latest synthetic reports repeat those assertions. Exact messages/manual replay:
[detailed report](historical-initial-report.md#exact-messages-errors-and-states-for-136).
Viewport screenshots have **no browser address bar**. #136 still owns its
address-bar captures, wireframes/design, independently reviewed PDF and receipt.

## Reproduce safely (PowerShell)

Follow [README](../../../README.md) / [SETUP](../../SETUP.md). Free 8000/5173 and
8014/5174. Default browser is installed Playwright Chromium; overrides below
use installed Edge on Windows. Use ignored output paths, not tracked evidence.

```powershell
$env:PYTHONUTF8 = '1'
$env:TMDB_NETWORK_DISABLED = '1'
$env:TMDB_READ_ACCESS_TOKEN = ''
$env:M3_BROWSER_CHANNEL = 'msedge'
$env:S04_BROWSER_CHANNEL = 'msedge'
.\.venv\Scripts\python.exe backend/scripts/run_isolated_tests.py -q
.\.venv\Scripts\python.exe -m ruff check backend
npm.cmd --prefix frontend test
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run build
npm.cmd --prefix frontend run test:m3:verifier
npm.cmd --prefix frontend run test:s04:runner
npm.cmd --prefix frontend run test:s04:e2e
npm.cmd --prefix frontend run test:t16:integration
npm.cmd --prefix frontend run test:t33:integration
node frontend/scripts/verify-m3-handoff.mjs data/app.db frontend/test-results/m3-final
$env:S13_TMDB_SMOKE = '1'
$env:S13_TMDB_DATABASE = (Resolve-Path data/app.db).Path
npm.cmd --prefix frontend run test:s04:e2e -- s13.acceptance.ts --grep 'live TMDb'
Remove-Item Env:S13_TMDB_SMOKE, Env:S13_TMDB_DATABASE
```

Never pass shared `data/app.db` directly to T22's `--database`: it creates users.
Make a read-only SQLite backup first. T12/T21 own their synthetic temp DBs.
The M3 runner compares application bytes after CRLF→LF normalization only;
other changes fail. It stops owned process trees before removal, retries locks
and reports cleanup failures even after journey failures. Either failure exits 1.

## Limitations and final gates

- T33's first bridge run failed at logout while other suites were running;
  a standalone rerun and five additional repetitions passed. Keep both outcomes;
  no definitive root cause was proved. Real-browser S13 logout/replay passed.
  No unrelated product-auth change is silently included in this PR.
- Backend skip: inherited M2 rating placeholder, superseded by current rating
  security tests. The Starlette/httpx deprecation warning is inherited.
- [Human validation](human-validation.md): PO confirms unfamiliar participant
  **Trang** tried P0 journeys unaided. Session date/version/individual results
  were not provided and are not invented. Confirm these before final sign-off.
- C04 is **closed/merged**, README head fixed to `c6f8a2d4e901`, final fresh-clone
  evidence available. Kiet's observed approval alone does not establish review
  independent of every contributor; promised teammate review awaits real record.
- Verify hosted CI on the final T25 head, obtain substantive independent review,
  resolve findings, merge. Prior Kiet approval on `4f3b2d2` is historical; Kiet
  contributes this follow-up. Do not close #127 before its gates pass.
- PO reconciles previously closed #44/#45 against final AC + DoD. Preserve other
  incomplete Stories. Dossier/PDF/LMS submission is not claimed by T25.

Original 417-test macOS records were **not rewritten** into 419-test Windows
evidence: [historical report](historical-initial-report.md),
[historical manifest](historical-initial-verification.json). Current manifest:
[verification.json](verification.json); handoff/reviewer checklist: [handoff-pr.md](handoff-pr.md).
