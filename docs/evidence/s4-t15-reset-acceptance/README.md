# S4-T15 full reset, later-login persistence and accessible recovery

Issue: [#210](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/210), parent Story #33.
Base: `origin/main` at `aab5bed` (T12 #207, T13 #208, T14 #209 and T05 #200 merged).
Owner: @NguyenTuanAnh0608 as assigned; this candidate was prepared with an AI assistant (see PR).
Tested commit: _fill in with `git rev-parse HEAD` after the final commit._
Independent reviewer: @anotify-vie, **not yet performed**. Nothing below is an independent sign-off.

## What was added

No production source changed. T15 is a verification task, so the change is test-only:

- `frontend/e2e/t15.reset-acceptance.ts`: 10 real-browser cases (below).
- `frontend/playwright.t15.config.ts` and the `test:t15:ui` script, reusing the S04 harness
  (disposable migrated SQLite DB, real FastAPI backend, Vite app, ports 8014/5174, no TMDb, no token).
- This document and 19 real screenshots under `screenshots/`.

Every committed-state assertion reads the server as the account itself (`/api/me/profile`,
`/preferences`, `/ratings/{id}`, `/watchlist`, `/recommendations`), not what the page claims.
Account B runs in a second browser context with its own cookie jar.

## Reproduce

From the repository root, after the locked backend/frontend setup in `SETUP.md`:

```powershell
$env:S04_PYTHON = (Resolve-Path '.\.venv\Scripts\python.exe').Path
npm --prefix frontend run test:t15:ui
npm --prefix frontend run test:t13:ui
npm --prefix frontend test
npm --prefix frontend run lint
```

Optional screenshots: set `T15_SCREENSHOT_DIR` to a folder before `test:t15:ui`.
If Playwright's bundled Chromium is not installed, `S04_BROWSER_CHANNEL=msedge` (or `chrome`) uses an installed browser.

## Mapping to the #210 checks

| #210 check | Case | Result |
|---|---|---|
| All four #33 criteria; A stays 0/0 after later login; B preserved and can still sign in | `journey dark 1440px` and `journey light 375px`: A 3 genres / 2 ratings / 2 watchlist, B 1 / 1 / 1. Cancel by button and Escape, reload, keyboard confirm, API readback, sign out and in again, B signs out and in again | PASS both |
| Both A and B watchlists non-empty; reset clears only A genres and ratings; reload, later login and details membership agree | Same cases. A keeps `[movie 1, movie 2]`, B keeps `[movie 3]`; details page says "Saved to your watchlist" for A's movie 1 and "Not in your watchlist" for B's movie 3; the watchlist page shows 2 cards | PASS |
| Cancellation preserves server data and sends no request | Same cases: 0 POSTs, A and B server state deep-equal before and after | PASS |
| No duplicate reset while saving | `duplicate submissions...`: double-click, Enter, Escape and a forced click while the held POST is pending. Exactly 1 POST; Cancel and confirm both disabled; server data unchanged until release | PASS |
| Explicit failure keeps truthful status | `explicit failure...` step 1: documented 503 envelope. Counts stay 3/2/2, no success sentence, retry enabled, server state of A and B unchanged | PASS |
| Ambiguous timeout keeps truthful status, with reconciliation and no invented success | Steps 2 and 3. Lost **before** commit: reconcile shows 3/2/2, 1 POST, no success sentence. Lost **after** a real commit and a failing first read: reset blocked, then the next read shows 0/0/2 and still no success sentence. A's watchlist (2) and B's whole state survive both | PASS |
| Keyboard confirm/cancel and focus return, 375px and desktop, no overflow, both themes | `keyboard order, focus return and dialog fit` x 4 (dark/light x 375/1440): tab order, default focus on Cancel, Tab trapped both ways, Escape and Space-Cancel return focus to the trigger, controls >= 44px, dialog inside the viewport, no horizontal scroll | PASS x4 |
| Basic removal of prior rating signals after reset/reselection, and the real non-personalised cold start, on the same candidates | `prior rating signals are gone...`: baseline adjustments 0; after 5 stars (Comedy) and 1 star (Action) adjustments are non-zero and the UI says "raised this score"; after the UI reset the API returns `popular / personalised=false / noMatch=false` with empty reasons; after reselecting the same genres every movie's `(ratingAdjustment, adjustedScore, basis)` and the order equal the original baseline; a new rating is accepted afterwards | PASS |
| Delayed old responses cannot overwrite a completed reset | `a read that was in flight before the reset...` (see limitation 2) | PASS |
| Light and dark themes for the whole journey | Journey run in dark/1440 and light/375; keyboard cases in both themes | PASS |

## Results on this machine

Windows 11, PowerShell, Node v24.21.0, Python from `.venv`, **Microsoft Edge** through Playwright
(`S04_BROWSER_CHANNEL=msedge`).

| Command | Result |
|---|---|
| `npm --prefix frontend run test:t15:ui` | 10 passed (1.1 min); `s04_temporary_database_removed=true` |
| `npm --prefix frontend run test:t13:ui` | 4 passed (regression of the existing T13 suite) |
| `npm --prefix frontend test` | 38 files, 435 tests passed |
| `npm --prefix frontend run lint` | clean |

The backend was not changed and the Python suites were not rerun for this candidate.

## Mutation checks (do the new tests fail when the behaviour is broken?)

| Temporary break (reverted afterwards) | Detected by |
|---|---|
| Removed the `busy` guard in `ProfilePage.confirmReset` and the `disabled` on the dialog confirm button | T15 `duplicate submissions...` failed (confirm button stayed enabled). |
| Made `invalidatePersonalisationAfterReset` a no-op | **Not** detected by T15. It **is** detected by the T13/T14 unit tests in `profile.test.tsx` (3 failed). |

## Limitations (stated so they are not mistaken for coverage)

1. **Browser.** Verified in Edge only. Chromium was not installed on this machine and CI's own Chromium job was not run.
   No fresh-clone run was done for this candidate.
2. **Delayed old responses.** The Profile page cannot overlap its own reads (its Refresh/Check controls are disabled while
   loading, and reset is blocked until a summary exists). The browser case therefore holds a recommendations read that started
   before the reset, leaves the page, resets, returns and releases the old response; the old personalised cards never come back.
   That passes because the old request is aborted on unmount and the page refetches, so it does not by itself prove the
   shared invalidation (mutation 2 above). The generation logic is proved by the T14 unit tests.
3. **Failures are injected at the network layer.** The 503 envelope and the aborted responses are test controls, not a real
   database failure. The "lost after commit" case does forward the real reset to the real backend before dropping the response.
4. **Pending toast.** The "Resetting personalisation…" notice was not asserted: it did not appear as visible text in the
   held-POST run, and the dialog state ("Working...", both buttons disabled) is what the case proves.
5. **Contrast ratios** are covered by the existing T13 test; T15 does not repeat them.
6. **No independent review.** The author evidence above does not replace the independent re-run by the named reviewer,
   who must record expected/actual, SHA and tester identity.
7. **Not part of this candidate:** CI result, `#218` hand-off comment, and the S5-T05 release-environment regression.

## Screenshots (real captures, synthetic isolated data)

| Case | Files |
|---|---|
| Journey, dark 1440 | `journey-dark-1440-1-before.png`, `-2-confirm.png`, `-3-after.png` |
| Journey, light 375 | `journey-light-375-1-before.png`, `-2-confirm.png`, `-3-after.png` |
| Dialog and focus, 4 combinations | `keyboard-confirm-{dark,light}-{375,1440}.png` |
| Duplicate submission pending | `duplicate-pending.png` |
| Failure and reconciliation | `failure-1-rejected.png`, `failure-2-lost-before-commit.png`, `failure-3-unconfirmed.png`, `failure-3-reconciled.png` |
| Rating signals | `signals-1-rated-recommendations.png`, `signals-2-cold-start.png`, `signals-3-reselected.png` |
| In-flight read | `stale-after-reset.png` |
