# S4-T14 reset invalidation: local candidate evidence

Issue [#209](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/209), parent Story [#33](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/33). Date: 2026-10-27 (Asia/Saigon). The user requested an uncommitted working-tree implementation. The base HEAD is `486adabf3d2b33805082c5a7a236e52c119c29a8`, which contains merged T01 polish PR #224. No T14 commit, PR, independent review, merge or issue closure is claimed.

## Scope and concurrency decision

`ProfilePage` calls the dedicated `invalidatePersonalisationAfterReset` helper only after the existing client validates `200 {data:{reset:true}}`. It discards its pre-reset summary immediately and uses the existing Profile GET for the replacement. The helper checks the originating account and calls the shared `invalidateRecommendations()`, which advances the request generation and rotates the account's recommendation navigation scope. This invalidates old cards, matched-genre reasons, page/filter context and late recommendation reads. The existing route lifecycle unmounts Preferences and Rating when Profile opens; those pages abort their requests and use their existing GET clients when reopened. No auth, watchlist, catalogue, theme, rating or notification store is changed.

Cancel, explicit rejection and unconfirmed/lost responses never invoke the helper. A known ACK does not sign out the viewer. A later deliberate preferences/rating save goes through the existing SQLite transaction policy; the browser scenario verifies both values are visible after a new Profile read. The backend is unchanged.

The original historical estimate was 3 author hours plus 0.5 independent review hours. This local reforecast separates 1 hour for scoped integration, 1 hour for focused/API/browser checks, 1 hour for evidence/contracts, a 0.5 hour correction buffer and 0.5 hour for non-coauthor review. It is a planning estimate, not a claim that independent review happened or that team capacity was approved.

## Reproduce

Run from the repository root with the locked frontend/backend setup and installed Chrome (or Playwright Chromium). The browser runner creates an isolated SQLite database with synthetic catalogue data; no TMDb token or external provider call is used.

```powershell
npm.cmd --prefix frontend test -- src/tests/profile.test.tsx src/tests/profile-client.test.ts src/tests/list-context-invalidation.test.tsx
npm.cmd --prefix frontend test -- src/tests/reset-invalidation.test.tsx src/tests/profile.test.tsx
npm.cmd --prefix frontend test
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run build
.\.venv\Scripts\python.exe -m pytest backend/tests/test_profile_reset_api.py backend/tests/test_profile_reset_concurrency.py -q
.\.venv\Scripts\python.exe scripts/verify_s4_c03_contract.py
$env:S04_PYTHON = (Resolve-Path '.\.venv\Scripts\python.exe').Path
$env:S04_BROWSER_CHANNEL = 'chrome'
$env:T13_SCREENSHOT_DIR = Join-Path (Get-Location) 'docs/images/sprint4/t14-reset'
npm.cmd --prefix frontend run test:t13:ui
Remove-Item Env:T13_SCREENSHOT_DIR
npm.cmd --prefix frontend run test:t01:ui
git diff --check
```

### Expected and observed

| Check | Expected | Observed |
|---|---|---|
| Focused unit tests | ACK once invalidates; cancel/rejection/lost response/account switch do not; old Profile data cannot remain visible after ACK/read failure; a read started before reset cannot restore old recommendation cards or reasons | 40 existing focused cases plus the new integrated reset-generation case passed; the final full run includes all 393 cases |
| Full frontend suite | No component/API regressions | 393 passed, 36 files |
| Backend reset/API concurrency | Reset preserves B and watchlist, rollback and later writes follow the existing transaction policy | 68 passed, one inherited TestClient/httpx deprecation warning |
| Lint, build and diff whitespace | No ESLint/TypeScript/bundle errors or whitespace defects | All passed |
| C03 document structure | Existing contract links and structure remain valid | Passed, 208 local links checked, none missing |
| Real T13 browser | A 3/2 to 0/0; next API recommendations popular/false/false, empty reasons; Preferences 0/5; rating null; watchlist 2; B stays 1/1/1; later A save/refetch 1/1/2 | 4 browser test bodies passed with Chrome and isolated SQLite; a later one-test screenshot run passed. The Windows Playwright runner did not exit after printing pass results and was interrupted during web-server teardown. |
| T01 browser regression | All tests pass | The full run failed at the existing Similar Movies gate: expected one captured request, received two on the dev server under React StrictMode. The isolated Similar Movies case passed. A second run excluding S07 had 12 passed, one skipped and one Home-to-Preferences timing failure in the star test; that isolated star case also passed. The full gate is **not green**. No unrelated assertion was removed. |

The default Playwright Chromium Headless Shell was not installed locally; the initial browser attempt failed at browser launch before any application assertion. Setting `S04_BROWSER_CHANNEL=chrome` used the installed Chrome browser. The Windows teardown issue does not affect the test-body observations, but a clean browser command exit remains unverified.

Because this is an uncommitted working tree, no tested T14 commit SHA exists. The base HEAD is named above. Exact SHA-256 of the tested source/test files is:

| File | SHA-256 |
|---|---|
| `frontend/src/auth/resetInvalidation.ts` | `00a115dbb8d4850cfb6f9d90379e6ae034b7a6e01d6924962d9a54f8a84c41d7` |
| `frontend/src/pages/ProfilePage.tsx` | `c3bbdfdbee2646621ffcdf9127138ce158de91460876cf576555a6e1ad3ad399` |
| `frontend/src/tests/profile.test.tsx` | `da5793083d83ddfef3ec40b644c20358dbed09ff1785120440c635dc8acf5ceb` |
| `frontend/src/tests/reset-invalidation.test.tsx` | `7725f45f896b91b2e4a5304eae7fae8a0162c71b442044b6c4c92413536e3593` |
| `frontend/e2e/t13.profile.ts` | `5ea8bc28d7c5c67cb810913b5c153b9d626a83925d1c09f9b2b1a0facd592fe1` |

## Real browser captures

- [Committed Profile, dark desktop](../../images/sprint4/t14-reset/profile-success-dark-1440.png)
- [Reset confirmation, dark desktop](../../images/sprint4/t14-reset/profile-confirm-dark-1440.png)
- [Committed Profile, light mobile](../../images/sprint4/t14-reset/t14-profile-success-light-375.png)
- [Empty Preferences after reset](../../images/sprint4/t14-reset/t14-preferences-empty-light-1440.png)
- [Popular recommendations after reset](../../images/sprint4/t14-reset/t14-recommendations-popular-light-1440.png)

These are actual browser screenshots from the synthetic isolated fixture. The T13 browser test also checks the committed state in both themes at 375, 768 and 1440 pixels without horizontal overflow. They are not live-TMDb captures.

## Acceptance and remaining gates

The four S11 Story criteria recorded in `docs/requirements.md` are reset A from 3/2 to 0/0, no change on cancellation, exact success message, and B retaining 1/1. The T13/T14 browser path exercises all four, but T15 #210 owns the complete independent Story acceptance; this document does not mark Story #33 done. The unimplemented T14 closure work is a tested commit/PR link, a substantive non-coauthor review, a clean applicable T01/CI browser gate, and merge/issue closure. These require a future committed candidate and independent reviewer; no such evidence is fabricated here.
