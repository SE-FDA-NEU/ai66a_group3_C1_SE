# S4-T17 post-T16 verification — 2026-10-28

Issue [#212](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/212),
PR [#236](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/236).
Times use Asia/Ho_Chi_Minh (+07:00).

## Candidate identity and change

- Historical T17 head: `51a2a532ade4c5a16312d5cf5f875b65d6832c4e`.
- Main containing merged PR #235: `f69c20e1405b5e2fe0fd7dfff1d05d7591fbb0ea`.
- Merge into T17: `c07f06d09a6048e949ceeb78d13b1cba50978045`.
- Tested committed candidate: **`af50498bd2c7326760497c864cd542e47f533de8`**.

The merge completed without conflicts. Two test selectors now find the rating
group by its approved accessible name, `Your rating (0.5 to 5)`, in
`frontend/src/tests/pagination-navigation.test.tsx` and
`frontend/integration/t16-filter.acceptance.tsx`. No production code or
half-star rating behaviour was changed by the correction.

[source-identity.json](source-identity.json) records the commit ancestry and
runtime versions. [tested-source.sha256](tested-source.sha256) covers all
299 tracked files under `backend/`, `frontend/`, `tests/` and
`.github/workflows/`, including the new half-star migration and T16 tests.
Its SHA-256 is
`5809b754f96573585b25c2e790ccf945529c3b82b293984fe04434708247c28c`.
The manifest scope is broader than the historical 251-file manifest; compare
each run using its own manifest. Documentation/evidence are excluded to avoid
self-reference. Later evidence-only commits do not change this tested source.

Verify from the repository root:

```sh
git merge-base --is-ancestor f69c20e1405b5e2fe0fd7dfff1d05d7591fbb0ea af50498bd2c7326760497c864cd542e47f533de8
shasum -a 256 docs/evidence/s4-t17-genre-filter/post-t16/tested-source.sha256
shasum -a 256 -c docs/evidence/s4-t17-genre-filter/post-t16/tested-source.sha256
```

## Executed checks

All commands below ran at the tested SHA and exited 0. Every log records its
timestamp, HEAD, exact command and exit code. The environment set
`TMDB_READ_ACCESS_TOKEN='' TMDB_NETWORK_DISABLED=1`. API/integration fixtures
and the backend runner own temporary SQLite databases; no live catalogue or
developer database was used. Python 3.12.4, Node 24.21.0 and npm 11.19.0 were
already installed in the existing workspace. This is **not** a clean-clone
setup verification.

| Command | Result | Evidence |
|---|---|---|
| `PYTHONPATH=backend DATABASE_URL=sqlite:///:memory: .venv/bin/python -m pytest backend/tests/test_filter_preference_preservation.py backend/tests/test_catalogue_pagination.py backend/tests/test_rating_aware_recommendations.py -v` | 48 passed | [Log](checks/focused-backend.log) |
| `npm --prefix frontend test -- src/tests/recommendation-filter-acceptance.test.tsx src/tests/recommendation-filter.test.tsx src/tests/rating-recommendation-refresh.test.tsx src/tests/pagination-navigation.test.tsx src/tests/list-context-invalidation.test.tsx` | 5 files, 29 passed | [Log](checks/focused-frontend.log) |
| `npm --prefix frontend run test:t16:integration` | 1 passed; real React/API/SQLite filter, rating save, return and clear | [Log](checks/t16-integration.log) |
| `npm --prefix frontend run test:t04:integration` | 1 passed | [Log](checks/t04-integration.log) |
| `npm --prefix frontend run test:t33:integration` | 1 passed | [Log](checks/t33-integration.log) |
| `.venv/bin/python backend/scripts/run_isolated_tests.py -v` | 705 passed, 1 historical skip | [Log](checks/backend-regression.log) |
| `npm --prefix frontend test` | 38 files, 435 passed | [Log](checks/frontend-regression.log) |
| `.venv/bin/python -m ruff check backend` | Passed | [Log](checks/ruff.log) |
| `npm --prefix frontend run lint` | Passed | [Log](checks/frontend-lint.log) |
| `npm --prefix frontend run build` | TypeScript/Vite passed | [Log](checks/frontend-build.log) |
| `.venv/bin/python scripts/verify_s4_c03_contract.py` | Passed; 228 links, 37 P0 IDs, 10 S4 oracle IDs | [Log](checks/contract.log) |
| `git diff --check`, main ancestry and source manifest verification | Passed | [Log](checks/final-verification.log) |

The full backend run used sandbox permission for local HTTP sockets. Its skip
remains the historical `test_rating_write_requires_the_signed_in_account`
placeholder. Executed rating API and migration cases passed. The Python
suite reports an existing Starlette/httpx deprecation warning.

## Evidence boundaries and DoD

The [2026-10-27 report](../README.md), logs, browser JSON and original
`tested-source.sha256` remain unchanged apart from the report's link to this
new run. Browser journeys were not rerun for this correction; the historical
S04/T04 browser results are not presented as results for this candidate.

[github-before.json](github-before.json) records the remote review/check state
before publication. The live state has advanced since the report of zero
reviews: four approvals now exist on historical head `51a2a53`, from
@NguyenTuanAnh0608, @kietxuan, @hoang3003 and @vu-huzy. The latest
`Someone else must review` run on that head succeeded; older failures remain
in the raw check history. These approvals do not certify the changed
post-T16 source. Hosted checks on the newly pushed head must be assessed
separately from both historical hosted runs and the local checks above.

- [x] Automated regression coverage and local checks above passed.
- [ ] Every linked-issue acceptance criterion, including independent review:
  pending a substantive teammate review of the final candidate.
- [ ] Clean clone with only README setup commands: pending; these runs used
  the existing workspace.
- [ ] All hosted PR checks green: pending checks on the published head.

The [PR body](pr-body.md) keeps these unverified criteria unchecked. No
independent approval, full Story acceptance, live TMDb smoke, merge to main
or issue closure is certified by this verification.
