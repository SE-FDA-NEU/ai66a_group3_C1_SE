# S4-T11 reset and concurrent account writes — reconciled implementation

Refs [T11 #206](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/206),
parent [S11 #33](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/33).
Date: 2026-10-24 (Asia/Saigon). Base: main
`3078a9c6fd3dff1f0b8576bc7411f469c7a98fdf`.

The PO authorized early implementation before C03 #217 merged. C03 is now merged
through PR #222 at main `37c2f66`, incorporated into this candidate. Its API
section 13.4 and architecture section 9.1 specify the same reservation-before-auth,
5-second timeout, commit/rollback and reset-preservation policy implemented here.
There is no competing reset API or new schema. **Independent non-coauthor review
and required checks on the final pushed head remain merge conditions.**
The owner is @kietxuan; the planned independent reviewer is @anotify-vie.

## 1. Existing HTTP boundary, unchanged

`POST /api/me/profile/reset`, authenticated and same-origin protected:

```json
{ "confirm": true }
```

The existing strict boolean DTO rejects missing/false/non-boolean confirmation
and extra body fields. Successful commit returns exactly:

```json
{ "data": { "reset": true } }
```

No account ID is accepted as a target. Query/header account selectors cannot
widen access; existing extra-body-field validation remains intact. Identity comes
only from the opaque session cookie. There is no second endpoint, new reset DTO,
schema migration or provider call in T11.

| Condition | Existing response |
|---|---|
| Invalid confirmation or body | 400 `VALIDATION_ERROR`, `Please correct the highlighted fields` |
| Missing/invalid/expired/revoked session on a healthy DB | 401 `AUTHENTICATION_REQUIRED`, `Authentication required` |
| Forbidden browser origin | 403 `ORIGIN_NOT_ALLOWED`, `Request origin is not allowed` |
| Persistence failure / unavailable writer within budget | 503 `SERVICE_UNAVAILABLE`, `Service is temporarily unavailable` |

Errors retain `{error:{code,message,requestId}}`, with no SQL, token, cookie,
password or exception detail. Infrastructure failure is not disguised as a
business-rule rejection or an empty successful profile. A DB reservation failure
can produce 503 before session validation; it must not claim the user is signed out.

Only the authenticated account's `user_genre_preferences` and `user_movie_ratings`
rows are deleted, in one transaction. Users, sessions, other accounts, catalogue,
genres, revision/provenance, text/popularity and media remain unchanged. Reset
does not invoke import, seed, index rebuild/delete or authentication revocation.
Future watchlist membership must remain unchanged as well.

## 2. Profile examples for downstream T12

These are semantic examples, not an invented GET profile response DTO. T12 #207
owns `GET /api/me/profile` and its final field names under reviewed C03.

| Account | Before A reset | After A reset, before any new A save |
|---|---|---|
| A | genres 28/35/878; movie-a=5, movie-b=2 | genres empty; ratings empty (0/0) |
| B | genre 18; movie-c=3 | exactly the same genre/rating (1/1) |

The summary must read its genres/rating counts from one consistent state (for
example one aggregate query or a reviewed read snapshot), not combine reads
from opposite sides of a reset into a mixed 3/0 or 0/2 summary. A new intentional
save after reset legitimately changes the later summary; zero is not permanent.

## 3. Actual SQLite transaction / locking policy

Runtime uses `create_database_engine` in `backend/app/db/database.py`:

- sqlite3/SQLAlchemy, existing Python legacy transaction mode retained;
- foreign keys enabled for each connection;
- sqlite connection busy timeout explicitly 5 seconds (5000ms);
- no change to an existing database's journal mode, no forced WAL;
- request-local Session; no Session shared between workers.

`get_account_write_db` reserves the SQLite writer using `BEGIN IMMEDIATE`
**before** authentication and read/modify/write decisions in:

1. `POST /api/me/profile/reset`;
2. `PUT /api/me/preferences`;
3. `PUT /api/me/ratings/{movieId}`.

The rating-write auth dependency consumes that same cached write-session
dependency, so it does not read before reservation. GET rating/auth/catalogue
routes remain read-only and do not acquire an IMMEDIATE writer reservation.
Existing same-origin middleware still rejects forbidden origins before DB work.

The route owns the sole commit and returns committed success only afterwards.
The generator dependency rolls back every uncommitted exit, including invalid
confirmation, auth failure, unknown movie, lock acquisition error, repository
error and commit error. It never retries a mutation automatically. A timeout
does not cause a hidden second reset. Repositories retain their existing SQL
and must not insert an intermediate commit between the two reset deletions.

`begin_account_write` is a boundary helper, not a nested transaction manager.
It rejects pending ORM changes, nested transactions and an already-active
physical DB transaction, without silently committing/discarding caller work.
Legacy SELECTs may create only an ORM virtual transaction: after successfully
reserving the physical writer, a clean identity map is expired so previously
cached rows cannot drive decisions under an old snapshot. Production requests
use a fresh session; callers must not supply externally owned transactions.
Non-SQLite deployments need a separately reviewed policy, not a claim of
portable row-level locking. There is no process-local account mutex.

SQLite permits one writer for the whole file. A B write can wait behind A;
account isolation means B is not deleted/absorbed by A's reset, not that SQLite
physically writes both accounts simultaneously. Keep transactions short; never
hold this boundary across TMDb/network requests or user confirmation dialogs.

### Deterministic outcomes

| Serialization order | Final A data |
|---|---|
| Save genres [28,35] commits, then reset commits | 0 genres / 0 ratings |
| Save movie-a=4 commits, then reset commits | 0 / 0 |
| Reset commits, then intentional genres [28,35] save commits | 2 genres / 0 ratings |
| Reset commits, then intentional movie-a=4 save commits | 0 genres / 1 rating |
| Two reset requests serialize successfully | 0 / 0; no partial data |
| Two updates of the same account/movie serialize | one row with the later committed value |

Order is established by actual transaction serialization, **not** mouse-click,
request arrival, HTTP-response completion or wall-clock timestamps. A delayed
HTTP response may arrive after a later transaction. The current payloads do not
carry reset epochs: the backend cannot infer whether an old request arriving
late was composed before reset. Rejecting such writes would require a reviewed
versioned-write contract; T11 does not silently add one.

On either delete failure or failed commit, rollback preserves both old A sets.
An independent B write after that rollback can still commit its intended change.
No operation invents a success before the database confirms commit.

## 4. UI contract handed to T13/T14/T15 (not implemented here)

- Opening confirmation or choosing Cancel sends **no reset POST**, leaves state
  unchanged and restores focus to the initiating control.
- Pending reset disables duplicate submissions and conflicting UI writes.
- A validated known committed response permits the exact sentence
  **Your personalisation profile was reset**; do not add a message field to the
  existing reset DTO to implement UI copy.
- After known success, increment/invalidate only the current account's
  profile/preferences/ratings/recommendation generations. Clear stale view
  filters/pages as specified by C03/T14; preserve authentication and watchlist.
- Capture account/session/request generation for every read/mutation. Older
  reads, old-account responses and delayed save acknowledgements cannot restore
  pre-reset UI or manufacture committed state. Aborting a browser request alone
  does not roll back a server commit.
- An ambiguous timeout is **unknown outcome**, not confirmed failure/success.
  Re-read authoritative current-account state using T12 APIs; show truthful
  reconciliation/retry controls, not fake success or automatic destructive retry.
  Counts alone may not identify which concurrent operation committed; do not
  claim a particular reset committed solely because counts happen to be zero.

T12 #207 owns the real profile summary API and watchlist migration/API/UI,
including A/B watchlist preservation against reset/failure. T13 #208 owns the
confirmation/cancel/rendered-success UI, T14 #209 its generation invalidation,
and T15 #210 independent complete browser acceptance, later-login persistence
and actual migrated watchlist preservation. These tasks consume finished T11;
they do not force another T11 partial milestone or duplicate reset endpoint.
S11 #33 cannot be closed on this backend evidence alone.

## 5. Automated proof and reviewer commands

`backend/tests/support/reset_concurrency.py` creates an offline synthetic A3/2,
B1/1 fixture in a real file database migrated through Alembic. It uses the
runtime engine factory and request-local sessions. Real FastAPI TestClient
requests exercise production routes/repositories; only external data is
synthetic. Auth time is frozen. No token/live TMDb/server/real user DB is needed.

`test_profile_reset_concurrency.py` covers:

- `TC_S11_write_reservation_precedes_auth_and_decision_reads`: all three writes;
- `TC_S11_A_three_genres_two_ratings_reset_preserves_B_and_shared_rows`;
- `TC_S11_both_controlled_commit_orders`: genres/rating x before/after x DELETE/WAL;
- `TC_S11_other_account_write_waits_then_succeeds_independently`;
- `TC_S11_competing_same_account_operations_are_atomic_and_unique`;
- failure-between-deletes/commit rollback and subsequent recovery;
- concurrent B write surviving failed A reset;
- invalid confirmation/session/origin/forged targeting without mutation;
- public reads without writer reservation, unknown-movie release, cold start;
- separate Python-process writer lock -> bounded 503 -> release -> recovery
  on each of reset/preferences/rating.

Threads overlap via Events at actual SQL boundaries, not timing sleeps. Each
worker uses a distinct DBAPI connection. A leader holds a real write while the
follower reaches reservation SQL; readback uses a new connection after both
finish. Both journal modes run; runtime mode is not changed. Test acquisition
and worker/child cleanup waits are bounded. Default timeout is 5s; only the
explicit contention tests override it to 50ms to stay fast.

`test_account_write_transactions.py` verifies engine policy, real reservation,
caller rollback, stale identity-map refresh and refusal of unsafe boundaries.
The old reset tests remain, strengthened to A3/2 and cleanup matching the
production session-per-request lifecycle; their original auth/rollback checks
are not deleted or weakened.

```powershell
python -m pytest backend/tests/test_profile_reset_concurrency.py backend/tests/test_account_write_transactions.py backend/tests/test_profile_reset_api.py -v
python backend/scripts/run_isolated_tests.py -q
python -m ruff check backend
```

Windows may use `.\.venv\Scripts\python.exe` instead of `python`. Run from the
repo root after the locked backend setup in SETUP.md. No new dependency or DB
migration is required. Reconcile C05's root pytest discovery when it exists;
these S11 tests are not the complete six-P0 M4 matrix or per-member evidence.

See [actual evidence](evidence/s4-t11-reset-concurrency.md). Independent
@anotify-vie review remains pending and is not manufactured.

## 6. Before merge

- C03 #217 merged and actual contracts reconciled (scope, timeout, helper reuse):
  complete at main `37c2f66`. Shared API/architecture/design retain the reviewed
  C03 text; this file records implementation-specific detail and downstream use.
- Main is merged without rewriting the original T11 commits or importing T01.
  Recheck any later main/database changes before merge; preserve auth/errors.
- Repeat focused/full regression and record tested code SHA or source digest.
- Independent non-coauthor rerun and substantive GitHub Review changes approval.
- Use `Refs #206` while early/pending; only complete accepted work uses Closes.

Background: [SQLite transactions](https://www.sqlite.org/lang_transaction.html)
and [SQLAlchemy sqlite3 transaction behavior](https://docs.sqlalchemy.org/en/21/dialects/sqlite.html#transactions-with-sqlite-and-the-sqlite3-driver).
