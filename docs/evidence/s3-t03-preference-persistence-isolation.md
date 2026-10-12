# S3-T03 preference persistence and account-isolation evidence

Issue: [#105](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/105)

Parent Story: [#17 / S01](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/17)

Branch: `105-verify-preference-api-persistence`

Dependency: S3-T02 was merged into `main` through
[PR #152](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/152), merge
commit
[`ad3452572edad79faf6ef4e59628402dc5f7a9c9`](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/commit/ad3452572edad79faf6ef4e59628402dc5f7a9c9).
This branch has since been synchronized with `upstream/main` at
[`f421f50d7933cc5a6ad1207d78c45d3ece19d17d`](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/commit/f421f50d7933cc5a6ad1207d78c45d3ece19d17d).

Verification date: 2026-10-12; Windows local verification and GitHub CI on
Python 3.12

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
$taskT03Database = Join-Path $env:TEMP `
  ("s3-t03-" + [guid]::NewGuid().ToString("N") + ".db")

$env:PYTHONPATH = (Resolve-Path backend).Path
$env:DATABASE_URL = "sqlite:///" + $taskT03Database.Replace('\', '/')

.\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini upgrade head
.\.venv\Scripts\python.exe -m pytest backend/tests/test_preferences_api.py -q
.\.venv\Scripts\python.exe -m pytest backend/tests -q
.\.venv\Scripts\python.exe -m ruff check backend
git diff --check

Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $taskT03Database -ErrorAction SilentlyContinue
```

Recorded after synchronizing the branch with `upstream/main@f421f50` at local
merge commit `485a18a84bd0be6334271752131b63d8f9a9fdb6`:

- Focused preference API suite: **51 passed**, 1 pre-existing deprecation
  warning, 30.63 seconds.
- Full backend regression on a separately migrated temporary SQLite database:
  **283 passed, 1 skipped**, 1 pre-existing warning, 131.21 seconds.
- Whole-backend Ruff: **All checks passed!**
- `git diff --check`: passed with no whitespace errors.

The one skip is an existing future handoff placeholder. The warning comes from
the installed FastAPI `TestClient` compatibility layer. Neither is a T03
failure. The earlier **177 passed, 2 skipped** count was recorded before later
Sprint 3 work reached `main` and is retained only in Git history as a historical
baseline, not as the current result.

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
| Home `Start` opens `/preferences` and displays available genres | Implemented by the separate genre-control UI work; not claimed or re-verified by T03. |
| Confirming 1-5 valid genres saves them and navigates to recommendations | Backend persistence is covered by T03; browser save/navigation belongs to the separate preference UI work and still needs integrated Story acceptance. |
| Confirming zero genres shows guidance and stays on the page | Backend rejection is covered; browser feedback/stay behaviour remains outside T03's verification scope. |
| Selecting a sixth genre shows the limit and keeps the previous five | UI acceptance remains outside T03's verification scope. |
| Returning shows the current account's selections and hides them from another account | Backend persistence/isolation is covered; complete browser rendering remains part of integrated Story acceptance. |

Personalised recommendation results are S02 scope and are not claimed here.
PR #159 has green remote CI and independent approval. Story Definition of Done
still remains open until clean-clone/manual acceptance, merge to `main`, and
the applicable catalogue smoke evidence are complete.

## Publication and review gates

| Evidence field | Current state |
|---|---|
| Reviewed T03 implementation SHA | [`121bd2c9dfd10d67364d6f95d01bc43149e80034`](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/commit/121bd2c9dfd10d67364d6f95d01bc43149e80034) |
| Implementation/test PR | [PR #159](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/159) |
| Independent review | Approved by [vu-huzy](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/159#pullrequestreview-5486097342) and [hoang3003](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/159#pullrequestreview-5486171590) on the reviewed SHA. |
| Remote CI | [Python tests](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/38163176710/job/114540201940), [Node build and tests](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/38163176710/job/114540201980), and [review policy gate](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/38204838789/job/114665917144) passed. |
| T02 dependency | Merged through [PR #152](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/152) at [`ad3452572edad79faf6ef4e59628402dc5f7a9c9`](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/commit/ad3452572edad79faf6ef4e59628402dc5f7a9c9). |

PR #159 is published and has independent approval. The main-sync merge and
this evidence correction occurred after reviewed SHA `121bd2c`; remote CI must
be allowed to rerun after the follow-up is pushed so the final PR head retains
the same green status before merge.
