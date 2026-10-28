<!-- Title: [#200] Verify P0 regression and rating/ranking acceptance -->

## Closes

Refs #200. Change this to `Closes #200` only after the open acceptance gates
below are satisfied; merging with `Closes` now would close the issue early.

## What changed

Mapped all 37 Section 2 P0 cases to 45 executable root pytest nodes and added
rating/ranking regression and mobile half-star touch coverage. Added
traceability and test-effectiveness verification plus API, database and browser
evidence. Main CI now runs `python -m pytest tests -v` and
`python scripts/verify_s4_t05_trace.py` after the existing backend suite.
No production application code was changed.

## How to test it

Run from the repository root in PowerShell with Python 3.12 and Chrome
installed for the browser checks.

1. Install the locked dependencies:

   ```powershell
   py -3.12 -m venv .venv
   .\.venv\Scripts\python.exe -m pip install -r backend/requirements.lock.txt
   .\.venv\Scripts\python.exe -m pip install -e "./backend[dev]" --no-deps
   npm.cmd --prefix frontend ci
   ```

2. Run the same root tests and trace check that CI now runs:

   ```powershell
   .\.venv\Scripts\python.exe -m pytest tests -v
   .\.venv\Scripts\python.exe scripts/verify_s4_t05_trace.py
   ```

   Local result: 45 passed and 37 unique Section 2 IDs mapped to 45 nodes.
   Hosted CI status for the new steps is pending until this commit is pushed.

3. Run the full Python and frontend regressions:

   ```powershell
   .\.venv\Scripts\python.exe -m pytest -v
   npm.cmd --prefix frontend test
   npm.cmd --prefix frontend run test:t04:integration
   npm.cmd --prefix frontend run test:t33:integration
   npm.cmd --prefix frontend run lint
   npm.cmd --prefix frontend run build
   ```

   Recorded local results: 762 passed, 1 historical skip and 210 subtests in
   the full Python suite; 435 Vitest tests across 38 files. Both integration
   tests, lint and build passed.

4. Run Chrome acceptance checks:

   ```powershell
   $env:S04_PYTHON = (Resolve-Path '.\.venv\Scripts\python.exe').Path
   $env:S04_BROWSER_CHANNEL = 'chrome'
   npm.cmd --prefix frontend run test:t01:ui
   npm.cmd --prefix frontend run test:t13:ui
   npm.cmd --prefix frontend run test:s4:t16:ui
   ```

   Recorded local results: T01 16 passed and 1 intentional skip; T13 4
   passed; T16/T05 20 passed. The browser runner uses a temporary SQLite
   database and needs no TMDb token.

Detailed evidence: `docs/evidence/s4-t05-acceptance.md`.

## Screenshot / output

![Ranking after a five-star rating](https://raw.githubusercontent.com/kietxuan/ai66a_group3_C1_SE/e42da9cb492525e7a2120e6b4ea082169f5b5603/docs/evidence/s4-t05-ranking-ui/t04-02-personalised-rating-5-raised.png)

Additional output: `docs/evidence/s4-t05-ranking-ui/t04-api-db-evidence.json`
and `docs/evidence/s4-t05-mutations.txt`.

---

## Definition of Done

- [ ] Every acceptance criterion on #200 passes: independent review,
      per-member root-pytest authorship and the T02 historical TDD disposition
      remain open.
- [ ] The code runs from a clean clone with the README setup commands.
- [x] Automated tests cover the new acceptance behavior.
- [ ] CI is green on this PR head, including both new T05 steps.
- [ ] No secrets, API keys, `.env` files or database dumps are in the diff.
- [ ] No commented-out dead code remains.
- [x] Testing documentation and evidence are updated.
- [ ] GitHub Stories #21 and #45 match the approved requirements. Proposed
      replacement text is in `docs/evidence/s4-t05-story-issue-updates.md`.

## Author declaration

- [ ] I wrote this code, or I have named every other contributor below.
- [ ] Where I used an AI assistant, I have said so and I can explain every
      line if asked.

AI assistance used: OpenAI Codex assisted with acceptance tests, CI,
verification scripts, documentation and local test execution. The PR author
must review and attest to the diff.

## Reviewer

Request an independent review from a teammate who did not author these
changes. Before closing #200, link qualifying reviewed root-pytest PRs for
each member and record an explicit decision about the missing original T02
signals-only pre-implementation RED provenance. Verify that Stories #21 and
#45 have been synchronized with the agreed requirements.
