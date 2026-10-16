# S3-T22: account preference recommendation journey

Links: [Task #124](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/124), [Story #17](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/17), [M3 handoff #127](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/127).

## Candidate and environment

- Tested code base: `e47830511a6321cf1543bef7b18895769bd2a99f` (`upstream/main`) plus the T22 verifier on this branch. The verifier does not change application behavior.
- Date: 2026-10-16 (Asia/Saigon). Windows, Python repository `.venv`, Vite on `127.0.0.1:5173`, FastAPI on `127.0.0.1:8000`, headless Google Chrome, SQLite file `data/t22-live.db` (ignored, disposable). No application server was running before the verifier started its own processes.
- A fresh migrated database received `python -m app.cli.import_tmdb_catalogue --pages 1` using the private local token. Import result: provider `tmdb`, revision `8c393996-f348-417c-83cf-fb08c4350e2a`, 20 inserted, 0 updated/rejected, 20 finite-popularity movies, 11 associated genres; source fetched `2026-10-16T05:47:43.035022Z`, imported `2026-10-16T05:47:44.133310Z`.
- Read-only SQLite provenance query confirmed 20 active movies, 20 distinct source IDs, zero non-TMDb active movies, 20 fetch timestamps, and 11 associated genres. The database and token are not committed.
- [Browser run output](t22-browser-run-output.txt) gives the exact tested SHA and observed results. The verifier creates fresh account emails each run, so it is repeatable against a disposable imported DB.

## Story #17 acceptance evidence

| AC | Real browser and API/SQLite observation | Result |
|---|---|---|
| AC1: signed-in home `Start` opens genres | Opened the first screen `/`, used visible `Start`; an unsigned visitor reached login. After registration/sign-in, used the visible catalogue link and `Start` again. `/preferences` displayed the 11 active TMDb genres and `0 of 5 selected`. [Initial picker](t22-start-preferences.png). | PASS |
| AC2: 1–5 save for account and open recommendations | Selected one, clicked `Save preferences`, observed `/recommendations` with `Recommended for you` cards and one SQLite preference row. Returned through `Change my genres`, selected five, saved, observed the same personalised heading with cards and five committed rows. [One saved](t22-one-saved-recommendations.png); [five saved](t22-five-saved-recommendations.png). | PASS |
| AC3: zero selections | Clicked `Save preferences` with zero choices; stayed on `/preferences` with `Select at least one genre` guidance. After a valid save, cleared the selected genre and repeated; the prior SQLite row remained. Direct same-session API `PUT {"genreIds":[]}` returned `400`. [Zero rejected](t22-zero-rejected.png). | PASS |
| AC4: sixth choice | With five checked, clicked a sixth checkbox. The UI showed the five-genre limit, preserved the first five, left the sixth unchecked, and kept `5 of 5 selected`. [Limit screenshot](t22-sixth-rejected.png). Direct API `PUT` with six valid IDs returned `400 VALIDATION_ERROR`; five committed rows remained. | PASS |
| AC5: restore and account isolation | Used `Change my genres` to revisit the picker after both successful saves; checked genres matched the saved rows. Signed out A through the visible button, registered/signed in B, opened the picker through navigation, and saw zero selections/rows. B saved one genre; A's five rows remained. [Restored selection](t22-one-restored.png); [B starts empty](t22-account-b-empty.png); [B saved separately](t22-account-b.png). | PASS |

Additional T22 checks: Blocked only the browser's preference save request after editing a valid five-genre draft. The page stayed editable, showed a connection/retry message, kept the draft, and left committed rows unchanged. Unblocked the request and clicked the visible `Save preferences` button; navigation and new committed rows succeeded. [Failure and recovery control](t22-draft-retry.png).

No production defect was observed in this candidate, so no module-owner fix was needed. The unsigned `Start` flow sends the visitor to login; after login, the user can use the visible `Change my genres` or catalogue navigation to reach the picker.

## Deterministic automated checks (separate from TMDb smoke)

These checks use isolated synthetic data or mocked fetches. They do **not** establish TMDb provenance or replace the real-browser results above.

```powershell
$env:PYTHONPATH='backend'
.\.venv\Scripts\python.exe -m pytest backend/tests/test_preferences_api.py backend/tests/test_preference_migration.py -q
npm.cmd --prefix frontend test -- --run src/tests/preferences.test.tsx src/tests/preferences-account-switch.test.tsx src/tests/preference-usability.test.tsx
```

Observed: backend **57 passed** (one Starlette/httpx deprecation warning); frontend **27 passed** across three files. [Backend preference tests](../../../backend/tests/test_preferences_api.py) cover valid one/five writes, invalid and unknown IDs, atomic rollback, session and account isolation. [Frontend picker tests](../../../frontend/src/tests/preferences.test.tsx), [account-switch tests](../../../frontend/src/tests/preferences-account-switch.test.tsx) and [usability tests](../../../frontend/src/tests/preference-usability.test.tsx) cover Start, sixth-choice validation, save navigation, draft preservation, restored choices and account switching. The [migration tests](../../../backend/tests/test_preference_migration.py) verify the account-owned storage schema. The complete real-browser assertions are in the [T22 verifier](../../../backend/scripts/verify_s01_preferences_ui.py).

## Reproduce the live browser run

Run from the repository root with ports 8000 and 5173 free and a private TMDb token in the root `.env`. Use a new disposable DB; the script writes two test accounts. Do not run it against a shared staging database.

```powershell
$env:PYTHONPATH='backend'
$env:DATABASE_URL='sqlite:///./data/t22-live.db'
.\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini upgrade head
.\.venv\Scripts\python.exe -m app.cli.import_tmdb_catalogue --pages 1
.\.venv\Scripts\python.exe backend/scripts/verify_s01_preferences_ui.py --database data/t22-live.db --evidence-dir docs/evidence/s3-t22-preferences-acceptance
```

The verifier checks the active provider and genre count before starting. It launches the real API, Vite and Chrome, navigates from `/` using visible controls, checks the rendered state and committed SQLite rows, then stops its processes. It intentionally blocks one browser save request for the recovery check. The run output and screenshots are the actual results, not expected-only steps.

For manual replay, start the backend and frontend using `docs/SETUP.md`, then open only the application's first screen. Choose `Start`, register/sign in if needed, return through the visible catalogue link, then choose `Start` again. Run the AC actions in the table above, using `Change my genres` to revisit saved choices and `Sign out` to switch accounts. Use a separate disposable TMDb-imported database if reproducing the failure scenario; the verifier's network block is the deterministic way to trigger that scenario.
