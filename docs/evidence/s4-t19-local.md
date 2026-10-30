# S4 #19 implementation and local test evidence

The tested implementation is on branch `pr-190-head` at
`fe91c0ba87f3a4b4f17a998d8d146acc72c90f6e`, following commits
`57f4247` (storage and selection) and `385f9a1` (enrichment command).
The branch was pushed to `origin`; this evidence record was prepared afterward.
No provider token or live database was used in these checks.

| Check | Expected | Actual |
|---|---|---|
| `python -m pytest backend/tests/test_trailer_enrichment.py backend/tests/test_tmdb_import_cli.py backend/tests/test_movies_api.py -q` | Selection, API, budget, status and rollback tests pass | 70 passed; one pre-existing Starlette deprecation warning |
| `python -m pytest backend/tests/test_backdrop_storage.py backend/tests/test_backdrop_acceptance.py backend/tests/test_trailer_enrichment.py backend/tests/test_tmdb_import_cli.py backend/tests/test_movies_api.py -q` | Legacy migration and trailer paths coexist | 88 passed; one pre-existing warning |
| `python -m ruff check backend` | No lint findings | All checks passed |
| `cd frontend; npm run build` | TypeScript and production bundle build | Passed |
| `cd frontend; npm run test -- --run src/tests/movie-backdrop.test.tsx src/tests/visual-primitives.test.tsx` | Trailer link, null and navigation states pass | 24 passed |
| `cd frontend; npm run test` | Full frontend suite passes | 440 passed |
| `cd frontend; npm run lint` | No lint findings | Passed |
| `git diff --check` | No whitespace errors | Passed |

The initial full repository pytest run, before correcting two historical
migration snapshot helpers, had 775 passed, 1 skipped, 3 failed and 2 errors.
The three failures and two errors were the old snapshots comparing new nullable
trailer columns against pre-migration schemas; one new test also hit a subprocess
timeout during that long run. All five affected tests passed in the focused
88-test rerun. The full repository suite has not been rerun after the helper
correction.

The synthetic API test verifies the exact populated and null details DTO, and
blocks any runtime TMDb videos request. The SQLite upgrade test verifies that
existing movie IDs, account rows, preferences and ratings remain present. The
frontend test verifies a safe YouTube link and that it disappears on navigation
to a movie with no trailer. Live TMDb import, a separate human review, CI,
PR/merge and issue closure remain pending; this record does not claim those
steps are complete.
