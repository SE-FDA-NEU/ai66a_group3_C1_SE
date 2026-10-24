# S4-T01 — onboarding and discovery UI follow-up

Refs [#195](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/195).
Verified locally on 2026-10-24, based on merged main `53f761d` (including T11).
This is a separate follow-up to merged PR #220, not a reopening of T01 or an
independent teammate review. CI and review of the pushed candidate remain separate.

## Delivered scope

- Sign-in/registration: ZIP-inspired two-column shell, original CSS cinema art,
  concise text, existing email/password forms only. On narrow screens the
  decorative panel is hidden so the actual form comes first.
- Preferences: “Tell Us What You Love to Watch”, short explanatory genre copy,
  native checkbox cards and selection/save toolbar. Available genres and saved
  selections still come from the API; descriptions do not add selectable genres.
  Unknown IDs have neutral fallback copy. The 1–5 rule and explicit save remain.
- Home: compact headline and three actual catalogue posters; Start and Explore
  Catalogue retain their existing routes/actions. No automatic personalisation.
- Popular: the first API-ranked movie becomes the page-one spotlight. The normal
  grid still has the same ten results, order, totals and pagination; the spotlight
  is not an extra result and is not incorrectly relabelled “#1” on later pages.
  Featured details preserve the Popular return context. No extra metadata fetch.
- Shared centered feedback: navigation intent, pending request, confirmed success
  or recoverable failure for auth, guest protected-page attempts, preferences and
  rating saves. It is non-modal, does not steal focus or intercept page controls,
  and has a close button and Escape dismissal. Info/success dismiss after 4.5s;
  failure after 8s; pending is never converted to success by a timer. Focus/hover
  on its close control pauses dismissal. Detailed errors remain inline alerts.
  The close control has a tested 44×44px minimum touch target, including mobile.
- Old request completions/cleanup cannot replace a newer action's notification.
  Rating account/movie guards remain. Account and preference acknowledgements
  are validated; malformed or mismatched responses cannot trigger success.

No OAuth, password recovery, fake match/accuracy numbers, playback, new ranking,
watchlist, trailer or provider implementation was introduced. No backend/schema,
dependency, setup, API payload or sorting/pagination contract changed.

## Executed checks

| Command / check | Observed result |
|---|---|
| `npm.cmd --prefix frontend test -- --maxWorkers=4` | 301 passed, 28 files |
| `npm.cmd --prefix frontend run lint` | Passed |
| `npm.cmd --prefix frontend run build` | Passed, TypeScript and production assets |
| `npm.cmd --prefix frontend run test:t01:ui` | 9 passed; separate imported-DB case intentionally skipped |
| T01 live mode with an explicitly started read-only imported-DB preview | 1 passed; 9 fixture-only cases intentionally skipped |
| `npm.cmd --prefix frontend run test:s04:e2e` | 10 passed; separate S13 live case intentionally skipped |
| `npm.cmd --prefix frontend run test:t16:integration` | 1 passed, disposable SQLite |
| `npm.cmd --prefix frontend run test:t33:integration` | 1 passed, disposable SQLite |
| `.\.venv\Scripts\python.exe backend/scripts/run_isolated_tests.py -q` | 527 passed, 1 skipped; existing Starlette/httpx deprecation warning |
| `.\.venv\Scripts\python.exe -m ruff check backend` | Passed |
| `git diff --check` | Passed |

New tests cover pending/no-early-success, failed sign-in/logout, malformed account
responses, failed/mismatched preference/rating acknowledgements, stale rating
response after sign-out, dismissal/timers/focus, guest private-request boundaries,
description accessibility, spotlight ordering/page-one-only and details return.
Existing movie-card assertions were scoped to the grid now that the spotlight
also shows its title; original score/order/request-count assertions remain.

Browser checks use Chromium, both themes, 375/768/1440 widths, overflow/contrast
and keyboard controls. Real UI login, saved genres and rating writes run only in
the verifier-owned disposable database. One delayed login test holds dispatch
then continues the unchanged browser request; it does not mock a successful API
reply or weaken the server's Origin protection. Temporary test databases were
removed by their owners. These checks are not a full WCAG certification.

## Real screenshots and data boundaries

The `fixture` images below use synthetic accounts/movies and deliberately failed
CDN requests to exercise fallback. They are not proof of TMDb data or live users.

- [Sign in, desktop/dark](../images/sprint4/t01-onboarding/onboarding-login-1440-dark-fixture.png)
- [Create account, desktop/light](../images/sprint4/t01-onboarding/onboarding-register-1440-light-fixture.png)
- [Sign in, mobile/light](../images/sprint4/t01-onboarding/onboarding-login-375-light-fixture.png)
- [Preferences, desktop/dark](../images/sprint4/t01-onboarding/onboarding-preferences-1440-dark-fixture.png)
- [Preferences, mobile/light](../images/sprint4/t01-onboarding/onboarding-preferences-375-light-fixture.png)
- [Confirmed rating feedback](../images/sprint4/t01-onboarding/onboarding-rating-feedback-fixture.png)

Public imported-catalogue captures use the existing private QA copy, opened with
SQLite `mode=ro`, containing 255 active TMDb movies, 255 poster paths and 254
backdrop paths. Actual public image bytes loaded from TMDb's image CDN. No metadata
API was called during navigation. Lazy posters were scrolled into view before
capture, not replaced or fabricated. A page-two check confirms no false #1 badge.

- [Home, desktop/dark](../images/sprint4/t01-onboarding/t01-home-dark.png)
- [Home, desktop/light](../images/sprint4/t01-onboarding/t01-home-light.png)
- [Popular spotlight, desktop/dark](../images/sprint4/t01-onboarding/onboarding-popular-1440-dark-imported.png)
- [Popular spotlight, mobile/light](../images/sprint4/t01-onboarding/onboarding-popular-375-light-imported.png)

The user's `data/app.db` was only queried read-only for media counts (also
255/255/254). It was not imported, migrated or written to. `.env`, tokens,
credentials, SQLite copies, browser traces and generated JSON reports are not
included. Only the owned preview servers were stopped after verification.

## Run and review

Use the existing [SETUP](../SETUP.md); this follow-up needs no new setup or package.
Start backend and frontend in their usual separate terminals, then:

1. Open Home; check the real poster hero and Start/Explore Catalogue links.
2. Open Popular; compare the spotlight with the first card and its popularity.
   Next page must retain correct results without a new false #1 spotlight.
3. As a guest choose My recommendations/Preferences: see centered guidance and
   sign-in, with no private data loaded. Direct sign-in still returns Home;
   an explicit protected destination remains preserved through registration.
4. Try invalid credentials, then valid credentials; observe failure/pending/
   confirmed success. On Preferences select genres using mouse or Space, check
   count/limit/descriptions, then explicitly save. Reload to verify persistence.
5. Open details, select an integer star and save. Confirm pending vs saved state;
   change theme, retry failures, sign out and back in. Test both 375px and desktop.

Independent final-diff Review changes and GitHub CI are required before merge.
The author-assisted runs above do not certify future Sprint 4 feature tasks.
