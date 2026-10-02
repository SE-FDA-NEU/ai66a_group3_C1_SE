# S2-T20 integrated auth-to-catalogue handoff evidence

Test date: 2026-10-02 (Asia/Saigon)

- Related task: [#66](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/66)
- Parent story: [#45](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/45) (reference only; the Story stays open)
- Base commit: `c2597f901848318eccbbb36e65cc1ff70734bb55` (`main`, contains the merged T06, T11, T13 and T16 work)
- Tested commit: the head of the T20 pull request, which adds only the test and evidence files listed below. Record its SHA in the PR description.
- Scope: verification only. No production code was changed.

## Files added by this task

| File | Purpose |
|---|---|
| `backend/tests/test_auth_catalogue_handoff.py` | API flow on a database built by the real bootstrap command |
| `frontend/src/tests/auth-catalogue-handoff.test.tsx` | UI flow against a stateful fake API |
| `docs/evidence/t20-handoff/` | This README, screenshots and command output |

## Automated tests

```text
python -m pytest backend/tests/test_auth_catalogue_handoff.py -v -rs   -> 4 passed, 2 skipped
npm --prefix frontend test                                            -> 41 passed (5 files)
python -m pytest backend/tests                                        -> 100 passed, 2 skipped
ruff check backend                                                    -> All checks passed
```

Raw output: `t20-backend-tests.txt`, `t20-frontend-tests.txt`.

| Completion check | Where it is proven |
|---|---|
| New account reaches the recommendation landing | Backend `test_new_account_reaches_the_recommendation_landing_data`; frontend T20 flow test; browser run step 2 |
| Logout forbids reuse of the authenticated API | Backend `test_logout_forbids_reusing_the_old_session_on_authenticated_api` replays the former cookie value from a new client and gets `401 AUTHENTICATION_REQUIRED` on `/api/auth/me` and `/api/me/recommendations`; the session row has `revoked_at` set. Browser run step 5 repeats this against a running server |
| Protected route returns to `/login` | Frontend T20 flow test; browser run steps 0 and 6 |
| Movie detail is public | Backend `test_a_recommended_movie_opens_its_public_detail`; frontend `keeps the catalogue and movie detail public` |
| Signing in again gives a new session | Backend `test_signing_in_again_after_logout_creates_a_fresh_session` |

The two skipped tests are intentional placeholders for the pending criteria below, so the open scope appears in every test run.

Mutation check: temporarily making `revoke_session` return immediately made `test_logout_forbids_reusing_the_old_session_on_authenticated_api` fail. The change was reverted.

## Real browser run on an empty database

The database was created for this run only (`data/t20-evidence/app.db`, which did not exist beforehand):

```powershell
$env:DATABASE_URL = "sqlite:///./data/t20-evidence/app.db"
$env:TMDB_READ_ACCESS_TOKEN = ""
.\.venv\Scripts\python.exe -m app.cli.bootstrap_m2_catalogue
```

```text
M2 catalogue bootstrap complete
active_revision=1b50e76b-9e93-4147-806d-b7b35e4934bf
movies=12
genres=8
movie_genres=22
```

The backend (`uvicorn app.main:app`) and the Vite dev server then ran against that file, and headless Chrome walked the flow. Full log: `t20-browser-run-output.txt`. After the run, the database held 1 user and 1 session, and that session was revoked. The database was deleted afterwards.

| Step | Result |
|---|---|
| Open `/recommendations` without an account | Browser ends on `/login`; `GET /api/me/recommendations` returns `401` |
| Register a new account, then sign in | `/recommendations` opens; `ams_session` cookie is `httpOnly`, `SameSite=Lax` |
| `GET /api/me/recommendations` with the cookie | `200`, `mode=popular`, `personalised=false`, `noMatch=false`, `count=10` (Northstar Protocol 98, Quiet Harbour 92, Paper Planets 90) |
| Catalogue and detail | 10 movie cards; the detail of Northstar Protocol opens and `GET /api/movies/{id}` without a cookie returns `200` |
| Sign out | Browser lands on `/`; the cookie is removed |
| Reuse the old token | `/api/auth/me` and `/api/me/recommendations` return `401`; the public `/api/movies?limit=10` still returns `200` |
| Open `/recommendations` after sign-out | Browser ends on `/login` |

Screenshots (headless Chrome has no address bar; each name states the route reached):

- `t20-01-unsigned-redirect-to-login.png`
- `t20-02-recommendation-landing-new-account.png`
- `t20-03-movie-detail.png`
- `t20-04-after-sign-out-guard-redirects-to-login.png`

## Finding to hand to the owner (not fixed here)

`t20-02-recommendation-landing-new-account.png` shows the landing page for a new account displaying "No recommendations available yet", even though `GET /api/me/recommendations` returns ten popular movies for the same session. `RecommendationsPage` does not call that endpoint yet; the T13 evidence (`docs/t13-recommendations-evidence.md`) already lists "Real recommendation API integration is not included in T13" as pending.

So the account reaches the real landing page and the API returns correct cold-start data, but the page does not display those movies. Wiring the page to the API is production work for the landing-page owner and was not done in this verification PR.

## Pending, intentionally not covered

- Rating write API (S05a) and rating-based recommendations (S05b).
- Preference saving and personalised recommendations (S01, S02).
- Cross-account personalised recommendation isolation (needs the two items above). Identity isolation between accounts is already covered by T11.
- Rendering the popular movies on `/recommendations`, see the finding above.
- S13 (#45) stays open: personal-data boundaries and later criteria are outside this task.

## Reviewer steps

1. `git checkout` the PR branch; run `npm --prefix frontend ci`.
2. `python -m pytest backend/tests/test_auth_catalogue_handoff.py -v -rs` and `npm --prefix frontend test`.
3. Optional manual run: bootstrap a new database as above, start the backend and `npm --prefix frontend run dev`, then repeat the table of steps in a browser.
