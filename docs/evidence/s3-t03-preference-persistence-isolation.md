# S3-T03 preference persistence and account-isolation evidence

Issue: [#105](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/105)

Parent Story: [#17 / S01](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/17)

Branch: `105-verify-preference-api-persistence`

Dependency: S3-T02 implementation/evidence at
[`7f866b5`](https://github.com/kietxuan/ai66a_group3_C1_SE/commit/7f866b5).
T02 is the accepted working base for this test branch but is not present in
`upstream/main` at `5251a88`; its PR/independent review must be linked before
T03 closes.

Verification date: 2026-10-12; Windows, Python 3.12

## Acceptance coverage

The focused test
`test_two_accounts_remain_isolated_and_a_restores_genres_after_later_login`
uses only the public registration, login, logout, and preference routes to set
up its account journey. Account A and B use separate `TestClient` instances,
which are independent cookie stores, and their opaque session cookies are
asserted to be present and different.

| T03 check | Automated evidence |
|---|---|
| A genres survive a later login | A saves Action and Comedy through `PUT`, logs out, receives `401` with the logged-out client, then logs in through a new client/cookie store and reads the same two committed genres. The new session token differs from A's revoked token. |
| B cannot read A | B sends A's ID in both query spellings and `X-User-Id`; `GET` still returns B's empty preference set. |
| B cannot change A via payload | A body containing `userId` is rejected as `400 VALIDATION_ERROR`; fresh database reads show A unchanged and B empty. A subsequent valid B write with forged query/header identity changes only B. |
| Invalid writes do not partially mutate the database | The focused forged-payload assertion checks both accounts after rejection. The reused T02 cases also cover zero/six/duplicate/wrong-type/malformed/unknown inputs and injected insert/commit failures, always checking committed rows after rejection or rollback. |
| Independent stores remain independent | B remains authenticated and retains Drama after A logs out and later signs in again; A retains Action and Comedy. |

The test checks committed rows through a fresh SQLAlchemy `Session`, rather
than trusting a response body or the request session's identity map. It does
not call TMDb, use a live token, or put credentials/session values in evidence.

## Reproducible automated checks

Run from the repository root in PowerShell:

```powershell
$env:PYTHONPATH = (Resolve-Path backend).Path

.\.venv\Scripts\python.exe -m pytest backend/tests/test_preferences_api.py -q
.\.venv\Scripts\python.exe -m pytest backend/tests -q
.\.venv\Scripts\python.exe -m ruff check backend
git diff --check
```

Recorded local results for the current uncommitted T03 worktree:

- Focused preference API suite: **51 passed**, 1 pre-existing deprecation
  warning, 17.78 seconds.
- Full backend regression on a separately migrated temporary SQLite database:
  **177 passed, 2 skipped**, 1 pre-existing warning, 52.86 seconds.
- Whole-backend Ruff: **All checks passed!**
- `git diff --check`: passed with no whitespace errors.

The two skips are existing future rating/personalised-recommendation handoff
placeholders. The warning comes from the installed FastAPI `TestClient`
compatibility layer. None is a T03 failure. Update the recorded results if code
changes before commit.

For only the new T03 journey:

```powershell
.\.venv\Scripts\python.exe -m pytest backend/tests/test_preferences_api.py `
  -k two_accounts_remain_isolated_and_a_restores_genres -v
```

The existing focused rollback and invalid-input coverage can be rerun with:

```powershell
.\.venv\Scripts\python.exe -m pytest backend/tests/test_preferences_api.py `
  -k "failed_replacement or invalid_put_body or unknown_canonical" -v
```

## Reproducible reviewer journey

Use a migrated local database with an active catalogue and start the API from
the repository README. Use two browser profiles, two private browser contexts,
or two API clients with independent cookie jars; never copy A's cookie to B.

1. Register account A and B with different emails. Sign into each account in
   its own cookie store and confirm the `ams_session` values are present and
   different without recording those secret values.
2. As A, call `GET /api/genres`, choose one to five IDs returned by that local
   catalogue, and call `PUT /api/me/preferences`. A following GET must return
   exactly the saved genres.
3. Sign A out. A's old cookie must receive `401` on preferences. Keep B signed
   in and verify B's GET is empty even with A's user ID supplied as `userId`,
   `user_id`, or `X-User-Id`.
4. As B, add A's ID as a `userId` field beside a valid `genreIds` list. Expect
   `400 VALIDATION_ERROR`. A's selection and B's empty selection must remain
   unchanged.
5. As B, send a valid preference PUT while placing A's ID in query/header
   fields. Only B's genres may change. A's GET in the next step must not show
   B's genres.
6. Open a third, clean cookie store and sign into A again. GET preferences must
   restore A's original genres. B must still see only B's genres.
7. Send a mixed valid/unknown genre list and an invalid duplicate list. Each
   request must fail, and a following GET must still return the last successful
   complete set. Use the automated fault-injection test for insert/commit
   rollback; do not corrupt the reviewer database deliberately.

## Story boundary and remaining criteria

T03 verifies the backend persistence/isolation slice only and must not close
Story #17. The current status of every S01 acceptance criterion is explicit:

| Story #17 criterion | Status after T03 |
|---|---|
| Home `Start` opens `/preferences` and displays available genres | Not implemented or verified by T03; owned by the genre-control UI task. |
| Confirming 1-5 valid genres saves them and navigates to recommendations | Backend save is covered; browser confirm, client state handling, and navigation remain outside T03. |
| Confirming zero genres shows guidance and stays on the page | Backend rejects an empty list; the required UI feedback/stay behaviour remains outside T03. |
| Selecting a sixth genre shows the limit and keeps the previous five | UI-only acceptance remains outside T03. |
| Returning shows the current account's selections and hides them from another account | Backend GET persistence/isolation is covered; complete browser rendering remains outside T03. |

Personalised recommendation results are S02 scope and are not claimed here.
Story Definition of Done also remains open until clean-clone/manual acceptance,
green remote CI, independent approval, merge to `main`, and the applicable
catalogue smoke evidence are complete.

## Publication and review gates

| Evidence field | Current state |
|---|---|
| Tested T03 commit SHA | Pending: intentionally no commit yet at the request of the branch owner. |
| Implementation/test PR | Pending commit and publication. |
| Independent review URL | Pending review by someone other than the author. |
| Remote CI result | Pending publication. |
| T02 dependency PR/review | Pending link; the dependency is currently consumed from the branch commit above. |

Before closing #105, commit the tested work, replace the pending SHA with its
link, open the PR, rerun CI against that exact SHA, and add the independent
review URL. Do not report this uncommitted local verification as reviewed.
