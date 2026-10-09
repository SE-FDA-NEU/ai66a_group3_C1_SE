# S3-T06 deterministic recommendation fixture evidence

Issue: [#108](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/108)  
Parent Story: [#18](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/18)  
Contract dependency: merged [PR #144](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/144)  
Base: `upstream/main` at `9a77476`  
Tested implementation commit: [`124973a6859749190be91fe0f5fa9bc0ff01b484`](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/commit/124973a6859749190be91fe0f5fa9bc0ff01b484)

## Delivered fixture and oracle

The fixture is
[`backend/tests/fixtures/recommendations_s3_t06.json`](../../backend/tests/fixtures/recommendations_s3_t06.json).
It is hand-authored, synthetic, offline, and separate from demo/import data. It
contains no provider source fields or credentials.

The input has 12 rows: 11 unique movie IDs and one byte-for-byte duplicate of
`...0003`. All 11 unique candidates match at least one of the two saved genres
in the personalised case, so the oracle proves de-duplication and the ten-card
cap. Scores, titles, and IDs exercise the committed deterministic order:
popularity descending, then title ascending, then ID ascending.

Expected movie entries use a normalized encoding to avoid copying the same card
fields into every case. Each entry references its candidate by `id` and adds
the exact public `reason.matchedGenres`. Expanding `genreIds` through the
fixture's canonical `genres` array and copying the candidate's title, release
year, and popularity score produces the complete response card.

The controlled cases are:

| Case | Expected state | Oracle |
|---|---|---|
| Saved Ember + Tidal | `personalised / true / false` | Ten distinct ordered cards; every card has its exact non-empty genre intersection |
| No saved genres | `popular / false / false` | Ten ordered popular cards; every matched-genre list is empty |
| Saved Archive, zero matches | `popular / false / true` | The same controlled popular alternatives; every matched-genre list is empty |
| Invalid session | `401 AUTHENTICATION_REQUIRED` | Exact message plus the public request-ID pattern |
| No active catalogue | `503 CATALOGUE_UNAVAILABLE` | Exact message plus the public request-ID pattern |
| Database read failure | `503 SERVICE_UNAVAILABLE` | Exact message plus the public request-ID pattern |

## Automated checks and results

Focused checks from `backend`:

```powershell
..\.venv\Scripts\python.exe -m pytest tests\test_recommendation_fixtures.py -q
..\.venv\Scripts\python.exe -m ruff check tests\test_recommendation_fixtures.py
```

Result on 2026-10-09: `5 passed in 0.03s`; Ruff: `All checks passed!`.

Full backend regression from `backend` (the path is inherited by subprocess
bootstrap tests):

```powershell
$env:PYTHONPATH = (Resolve-Path .).Path
..\.venv\Scripts\python.exe -m pytest -q
```

Result on 2026-10-09: `107 passed, 2 skipped, 1 warning in 24.64s`. The two
skips are existing handoff placeholders and are not caused by this task.

The whole-backend Ruff invocation currently reports 16 pre-existing findings
outside the changed files. The focused changed-file Ruff check above passes.

## Reproducible reviewer steps

1. Check out `s3-t06-deterministic-recommendation-fixtures` and confirm the
   base contains merged contract PR #144.
2. Run the two focused commands above from `backend`.
3. Inspect the fixture and verify that row `...0003` is duplicated exactly,
   there are 11 unique IDs, and each success oracle returns no more than ten
   distinct IDs.
4. Verify each personalised card's `matchedGenres` equals the intersection of
   the card's canonical `genreIds` and saved genres `[7101, 7102]`.
5. Verify the Archive case has no eligible movie, returns the popular fallback,
   and sets `noMatch=true`.
6. Verify no fixture field contains provider IDs, provider payloads, tokens, or
   values copied from the live smoke catalogue.
7. Record an approval or independent review link on PR #108's implementation
   PR before closing the task.

## Scope and remaining Story criteria

This task defines reusable data and exact oracles; it does not implement the
Sprint 3 preference storage or personalised recommendation route. Therefore
the following Story #18 criteria remain explicitly unimplemented here:

- saving and reading account-owned genre preferences;
- runtime personalised candidate selection and response projection;
- runtime no-match fallback integration;
- frontend recommendation-card rendering and no-match actions;
- cross-account isolation and end-to-end acceptance evidence.

Rating-adjusted ranking is outside Sprint 3 S02 and remains Story #22 / S05b.
Story #18 must not be closed from this fixture task alone.

Independent review is still an external closure gate. The branch is published;
task #108 should remain open until a separate reviewer approves the PR and that
review URL is recorded here or on the issue.
