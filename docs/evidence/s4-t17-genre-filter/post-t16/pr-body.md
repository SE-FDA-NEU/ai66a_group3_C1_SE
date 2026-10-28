## Closes

Closes #212

## What changed

Add regression coverage for genre filtering and clear/reset after rating-driven recommendation reranking, preserving the server-authoritative order and PR #194 pagination contract. Reuse the existing S3/T03/T04 tests and fixtures: the exact 2 Action / 3 Comedy oracle now runs through a real rating save, detail return, filtering and clear against migrated SQLite.

The multi-page fixture verifies all 35 eligible candidates are selected before filtering and slicing; its 12 Action candidates remain available across pages of 10/2 even when none were originally visible on page 1. Additional tests cover latest-snapshot restoration, page/genreId/revision return context, account switching from details, delayed old responses/errors, and unmount/navigation. Relative to the updated main base, only tests, fixture/transport support and evidence changed. Main containing PR #235 is merged into T17; both rating-group selectors now use `Your rating (0.5 to 5)`, preserving the approved half-star widget.

## How to test it

From the repository root after the documented setup:

```sh
PYTHONPATH=backend DATABASE_URL=sqlite:///:memory: TMDB_READ_ACCESS_TOKEN='' TMDB_NETWORK_DISABLED=1 .venv/bin/python -m pytest backend/tests/test_filter_preference_preservation.py backend/tests/test_catalogue_pagination.py backend/tests/test_rating_aware_recommendations.py -v
npm --prefix frontend test -- src/tests/recommendation-filter-acceptance.test.tsx src/tests/recommendation-filter.test.tsx src/tests/rating-recommendation-refresh.test.tsx src/tests/pagination-navigation.test.tsx src/tests/list-context-invalidation.test.tsx
TMDB_READ_ACCESS_TOKEN='' TMDB_NETWORK_DISABLED=1 npm --prefix frontend run test:t16:integration
TMDB_READ_ACCESS_TOKEN='' TMDB_NETWORK_DISABLED=1 .venv/bin/python backend/scripts/run_isolated_tests.py -v
.venv/bin/python -m ruff check backend
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run build
```

Also run `npm --prefix frontend run test:t04:integration` and `npm --prefix frontend run test:t33:integration`. All automated fixtures are synthetic and offline/token-free; database integration uses isolated SQLite. Historical browser commands and results remain in the earlier evidence; browsers were not rerun for this selector correction.

## Screenshot / output

Post-T16 verification on committed candidate `af50498bd2c7326760497c864cd542e47f533de8`, after merging main `f69c20e1405b5e2fe0fd7dfff1d05d7591fbb0ea` (PR #235) through merge `c07f06d09a6048e949ceeb78d13b1cba50978045`:

| Verification | Observed result |
|---|---|
| Focused backend / frontend | 48 / 29 passed |
| T16, T04, T33 integration | 1 passed in each suite |
| Full backend | 705 passed, 1 historical skipped placeholder |
| Full frontend | 435 passed across 38 files |
| Ruff / ESLint / TypeScript + Vite | Passed |
| C03 contract | Passed; 228 links, 37 P0 IDs, 10 S4 oracle IDs |
| Main ancestry / source manifest / diff whitespace | Passed |

Current evidence: [candidate SHA, commands, results and limits](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/blob/test/s4-t17-genre-filter-reranking/docs/evidence/s4-t17-genre-filter/post-t16/README.md), [299-file source manifest](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/blob/test/s4-t17-genre-filter-reranking/docs/evidence/s4-t17-genre-filter/post-t16/tested-source.sha256). Manifest SHA-256: `5809b754f96573585b25c2e790ccf945529c3b82b293984fe04434708247c28c`. Subsequent evidence-only commits preserve this tested source.

These runs used the existing workspace and installed dependencies; they do not establish a clean clone of this candidate. Hosted CI on the published head is assessed separately from these local results.

Historical results from 2026-10-27 (`51a2a53`, based on `0936ee8`): 660 backend passed/1 skipped, 399 frontend passed, S04/S13 browser 10 passed/1 optional live smoke skipped, and T04 browser passed. Their [report, raw logs, browser JSON and original 251-file manifest](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/blob/test/s4-t17-genre-filter-reranking/docs/evidence/s4-t17-genre-filter/README.md) remain as history and are not presented as post-T16 browser results.

Broader Story #22/#23 acceptance, live catalogue provenance and C01 planning closure remain outside this task.

---

## Definition of Done

- [ ] Every acceptance criterion on the linked issue passes, including independent review — local automated checks passed; review of the final post-T16 candidate is pending
- [ ] The code runs from a clean clone — pending verification of this candidate with only README setup commands
- [x] Automated tests cover the scoped behaviour
- [ ] CI is green — pending hosted checks on the newly published head
- [x] No secrets, API keys, `.env` files or database dumps in the diff
- [x] No commented-out dead code added
- [x] Reproducible commands and results documented; setup unchanged

## Author declaration

- [x] Author has reviewed and can explain all changes
- [x] AI assistance is disclosed

AI assistance used: OpenAI Codex inspected existing implementation/tests, extended regression tests and fixtures, executed verification, recorded evidence, and prepared this commit and PR. No independent reviewer or coauthor credit is claimed.

## Reviewer

Planned independent reviewer for T17: @hoang3003. At the 2026-10-28 audit, GitHub recorded four approvals on the historical head `51a2a532ade4c5a16312d5cf5f875b65d6832c4e` (@NguyenTuanAnh0608, @kietxuan, @hoang3003 and @vu-huzy); the latest `Someone else must review` run on that old head succeeded. Earlier red runs remain historical. Those approvals do not certify the newly changed source; independent review of the final post-T16 candidate remains pending.
