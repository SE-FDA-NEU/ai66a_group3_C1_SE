# S3-T34: rating protection and recovery acceptance

Task: [#141](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/141).

Parents: [S05a #21](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/21)
and [S13 #45](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/45).

Dependencies (actual issue numbers):

- S3-T32 is [#140](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/140).
- S3-T33 is [#139](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/139).

Final acceptance of all five S13 criteria remains owned by
[#125](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/125). This task does
not implement or claim rating-adjusted reranking.

## Acceptance boundary

`backend/scripts/verify_s13_rating_ui.py` creates a new migrated, file-backed
SQLite database and a temporary Chromium profile. It seeds the reviewed S3-T06
synthetic catalogue, starts the real FastAPI and Vite processes, and drives the
real React UI through Chrome DevTools Protocol. It uses no configured developer
database, live TMDb token, provider network, mock API response, or production
debug endpoint.

The database fault is a temporary SQLite `BEFORE UPDATE` trigger. A real rating
PUT reaches FastAPI and SQLAlchemy, fails with 503, rolls back, and is retried
after the trigger is removed. Delayed-response checks hold already-returned real
browser fetch responses before resolving their promises; they do not replace the
backend with a mock.

## Completion-check mapping

| Completion check | Recorded verification |
|---|---|
| Guests retain public details access | Public movie GET is 200 and `t34-01-guest-public-detail.png` shows the detail with the guest CTA. The browser request audit contains no guest rating GET/PUT. |
| Personal rating action leads to login without mutation | The CTA opens `/login`; both the pre/post database snapshots contain zero rating rows. A direct unauthenticated PUT is independently 401. |
| Signed-in save/update shows the committed rating | Account A saves 3 and updates to 5. The browser, API log, and final database row agree on 5. |
| Save failure preserves draft/prior value and permits retry | `t34-02-save-failure.png` shows committed 3, draft 5 and `Retry save`; SQLite still contains 3. `t34-03-retry-committed.png` and the database then show 5. |
| Account B never sees Account A's rating | In the same browser, B initially sees `Not rated yet`, saves 2, and never renders A's 5. The final database has separate A=5 and B=2 rows for the same movie. |
| Delayed movie/account responses cannot restore old state | A held A-account response cannot replace signed-in B or B's 2 (`t34-05-delayed-account.png`). A held Amber response cannot replace the newer Binary route (`t34-06-delayed-movie.png`). |
| Expired/revoked sessions use central 401 recovery | Real database revocation and expiry each make the next rating PUT return 401; both journeys end on `/login` (`t34-07-revoked-session.png`, `t34-08-expired-session.png`) without changing ratings. |
| Ratings are optional; zero ratings do not block recommendations | A's personalised recommendation list renders while the rating table is empty. The same API order is returned before and after rating, without claiming reranking. |
| Return navigation preserves preferences/detail context | The detail link carries `/recommendations?source=t34#results`; the back link restores path, query and fragment. A's saved Meadow preference remains unchanged. |
| No other account's recommendation cache is reused | A's list starts with Amber Velocity. After same-browser sign-out/sign-in, B's list starts with Binary Picnic and contains no Amber card. |
| Browser/API/DB evidence, tested SHA, independent review | The files below record the local run. The exact commit SHA and independent reviewer are intentionally pending until these uncommitted changes are committed, pushed, and reviewed. |

## Evidence index

| File | Purpose |
|---|---|
| `t34-browser-run-output.txt` | Timestamp, base commit, candidate source digest, runtimes, and PASS summary. |
| `t34-regression-output.txt` | Full backend/frontend, T33 integration, lint, and build results. |
| `t34-api-db-evidence.json` | Sanitised browser request/status audit, recommendation observations, failure values, session actions, final preferences/ratings, and SQLite integrity result. |
| `t34-backend-output.txt` | Real FastAPI request log, including rating 200/503/401 responses. |
| `t34-frontend-output.txt` | Vite startup log. |
| `t34-browser-output.txt` | Headless Chromium process log. |
| `t34-01-guest-public-detail.png` | Guest public detail and sign-in rating CTA. |
| `t34-02-save-failure.png` | Prior committed 3, preserved draft 5, actionable retry. |
| `t34-03-retry-committed.png` | Successful retry committed at 5. |
| `t34-04-account-isolation.png` | B's independent committed 2 on the same movie. |
| `t34-05-delayed-account.png` | B remains owner after delayed A response. |
| `t34-06-delayed-movie.png` | New movie remains visible after delayed old response. |
| `t34-07-revoked-session.png` | Central recovery destination after revocation. |
| `t34-08-expired-session.png` | Central recovery destination after expiry. |

The images are automated real-browser captures. Their address is recorded by the
CDP snapshot/request audit rather than by browser chrome in the bitmap. No
password, cookie, token, `.env` value, or database file is retained.

## Reproduce

Install the locked backend/frontend runtimes from `docs/SETUP.md`, stop anything
using ports 8000 or 5173, then run from the repository root:

```powershell
$env:PYTHONUTF8 = "1"
.\.venv\Scripts\python.exe backend/scripts/verify_s13_rating_ui.py `
  --evidence-dir docs/evidence/s3-t34-rating-acceptance
```

If browser detection fails, append `--browser <absolute Chrome/Chromium/Edge path>`.
The runner deletes its temporary database/profile after stopping all processes.

The dedicated workflow `.github/workflows/t34-browser-acceptance.yml` repeats the
same journey on the pushed SHA and uploads its evidence directory as a CI
artifact. It does not commit generated CI artifacts.

## Recorded local result and review gate

On 2026-10-16 (Asia/Saigon), the verifier passed against base commit
`e47830511a6321cf1543bef7b18895769bd2a99f` with local changes present. The exact
candidate digest and runtime versions are in `t34-browser-run-output.txt`; the
temporary database finished with `PRAGMA integrity_check = ok` and exactly two
account-owned rating rows.

Regression on the same candidate passed: 373 backend tests with one inherited
skip, 199 frontend tests, the T33 cross-runtime integration test, Ruff, ESLint,
and the production build. See `t34-regression-output.txt` for the commands and
recorded counts.

Because the user explicitly requested no automatic commit, this run cannot
truthfully name a commit containing the new verifier/evidence. Before closing
#141, commit the intended files, rerun on a clean tree so `base_commit` is the
tested SHA, attach the green workflow artifact, and record an independent
reviewer's approval link here:

- Tested task commit: pending.
- T34 workflow run: pending.
- Independent reviewer and approval link: pending.

Suggested PR linkage: `Closes #141`, `Refs #140`, `Refs #139`, `Refs #21`, and
`Refs #45`. Do not close #21, #45, or #125 from this testing task.
