# S4-C05 local final-candidate rehearsal and S5 handoff

Issue [#219](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/219).
The approved EARLY_TEST_SETUP was already merged via PR #240 at `9f285a1`.
This record concerns the later build/index/storage/recovery pass on
`acd99688bd88a2a78fe3ec13b193febf6a538d4a`, based on fetched main
`b1e8c1e50cbbf21099dc424e481df065f9e6b99b`. The candidate is local
and has not been pushed. The [manifest](manifest.json) names the executable
tree, locked dependencies, build artifacts, migration head, rehearsal and
deployment status for C02/C04/S5-C02. This evidence commit changes no
executable files.

## Implemented output

- `storage_snapshot` provides `inspect`, `backup` and `restore` with explicit
  SQLite paths. The backup API includes committed WAL pages. A new destination
  is published only after integrity/FK/Alembic checks; existing files are
  refused. Restore writes a new DB path, leaving the old file untouched.
- The offline storage test migrates disposable SQLite, seeds two non-empty A/B
  accounts with preferences, ratings and watchlists, tests uncheckpointed WAL,
  restore, stable movie IDs and media, reset/reimport boundaries, index rebuild
  and a new API process. The separate startup rehearsal runs two actual
  Uvicorn processes sequentially and checks health/catalogue/detail/Search/
  Similar before and after restart.
- [Release/storage runbook](../../s4-c05-release-storage.md) and
  [SETUP.md](../../SETUP.md) now give explicit build, import, index, startup,
  persistent-volume, backup, restore and rollback procedures. No M2 seed is
  used for live acceptance. Existing CI already runs direct root pytest and
  the extended backend/frontend tiers; the new test is selected by that root
  command, and its provider boundary is offline.

## Executed commands and actual results

All commands below use Python 3.12, Node 24 and the committed lockfiles.
The clean local clone was made in a new folder from the exact committed
candidate, with a new Python venv and `npm ci`; it had no `.env`, application
DB or running service. [Clean source/install record](checks/clean-source.txt).

| Command | Actual result |
|---|---|
| `npm.cmd --prefix frontend ci` | 240 packages installed in the clean clone |
| `npm.cmd --prefix frontend run lint` and `run build` | Exit 0; [full output](checks/clean-frontend-build.log). Built HTML/CSS/JS hashes are in the manifest and matched the original checkout. |
| `npm.cmd --prefix frontend test -- --maxWorkers=4` | 467 passed in 41 files; [full output](checks/clean-frontend-tests.log) |
| `.\.venv\Scripts\pytest.exe` in clean clone | 820 passed, 1 inherited skip, 1 deprecation warning in 299.30s; [full output](checks/clean-plain-pytest.log) |
| `.\.venv\Scripts\python.exe -m pytest -v` in clean clone | 820 passed, 1 inherited skip, 1 warning and 210 subtests in 242.77s; [full verbose output](checks/clean-python-module-pytest-verbose.log) |
| Literal `pytest` via `cmd /c "call .venv\Scripts\activate.bat && pytest"` in the clean clone | 820 passed, 1 inherited skip, 1 warning in 250.58s; [full output](checks/clean-literal-pytest.log) |
| `.\.venv\Scripts\python.exe scripts/verify_s4_t05_trace.py` | 37 Section 2 IDs mapped to 48 collected root nodes |
| `.\.venv\Scripts\python.exe -m pip check` | No broken requirements |
| `.\.venv\Scripts\python.exe backend/scripts/verify_s4_c05_startup.py` | Exit 0; 2 A/B users, 2 preferences, 2 ratings, 2 watchlist rows and 2 movies survived WAL backup/restore and two HTTP starts; [machine output](checks/clean-startup-rehearsal.log) |
| `.\.venv\Scripts\python.exe -m ruff check backend` | Passed in original checkout |
| `python -m alembic -c backend/alembic.ini heads` | One head, `a3d1f8b72c44` |

The regular checkout also ran `python -m pytest -q`: 820 passed, 1 skipped,
210 subtests passed in 449.53s. The inherited skip is
`test_rating_write_requires_the_signed_in_account` in the older backend
handoff suite, outside the required
Section 2 cases; the traceability check collected all 37 IDs. No fixture
requires a real TMDb token, external networking, Uvicorn, Vite or browser in
the required pytest command.

## Imported catalogue and limits

A read-only SQLite backup of the existing local TMDb catalogue was upgraded
from `c6f8a2d4e901` to `a3d1f8b72c44`. The 252 movie IDs and all 7 user
rows were identical before and after; preference/rating rows matched and FK
check was empty. The rebuilt index was
ready for all 252 active movies. A loopback Uvicorn process returned health
200 at the current migration, 252 list movies, one matching detail ID, two
description Search matches and five Similar results. The source database
remained at its old migration; the disposable copy and index were removed.
[Actual summary](checks/imported-preview-summary.txt).

A new one-page live TMDb import was attempted in a different empty DB, but
DNS resolved `api.themoviedb.org` to loopback and TCP 443 failed. This is a
network blocker, not a successful live import; the empty DB was removed.
[Network/import result](checks/live-import-network.txt). The repository's
earlier [S4-T19 live import evidence](../s4-t19-live-20261031.md) is a prior
baseline, not re-labelled as this candidate's live import.

No deployed volume/service/path exists for this local task, and no hosted CI
run or independent non-author fresh-clone review can be claimed before the
branch is pushed and reviewed. The named reviewer is @vu-huzy. They must
rerun the final candidate, record their own expected/actual results, SHA,
platform and full output, and verify deployment-specific persistent paths,
restart, backup and restore before #219 can close. The failed live TMDb
network check also remains explicit for the operator; do not substitute the
synthetic fixture for mandatory live-catalogue provisioning.
