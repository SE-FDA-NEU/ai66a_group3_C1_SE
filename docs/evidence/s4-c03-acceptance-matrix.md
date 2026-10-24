# S4-C03 local acceptance evidence — 2026-10-24

## Source and candidate

This is author-side evidence for the proposed S4-C03 #217 contract, using
the user-supplied 24 October 2026 issue text and tracked Sprint 3 contracts.
The live GitHub issue was unreachable, so no later edit is claimed checked.
The PO ZIP was inspected only for visual reference; no sample data, logic or
unapproved feature was copied into production.

The local executable base is HEAD
`3078a9c6fd3dff1f0b8576bc7411f469c7a98fdf` plus uncommitted
contract files. The verifier prints SHA-256 hashes for the exact text checked.
HEAD alone is **not** the document candidate. Nothing was committed, pushed,
submitted, reviewed independently or closed on GitHub.

## Requirement-to-artifact trace

`Specified` means an author inspected the linked local text and found the
required decision. It does **not** mean a future API, test, browser flow or
review has passed.

| ID | Requirement in supplied C03 issue | Local contract evidence | Author result |
|---|---|---|---|
| C03-01 | Reuse protected rating/reset and popularity contracts without duplicate API/storage. | [Existing rating/reset](../api.md#9-sprint-3-rating-contract-implemented-under-s3-t31), [S4 routes](../api.md#13-sprint-4-c03-implementation-contract-planned-not-delivered), [module ownership](../architecture.md#9-sprint-4-c03-runtime-and-storage-contract-planned) | Specified; Sprint 3 stays labelled implemented, S4 planned. |
| C03-02 | 1/2=-1, 3=0, 4/5=+1; one contribution per rated movie; adjusted-score/title/ID order. | [Score contract and 80/80 oracle](../api.md#131-recommendation-score-transparency), [rank cases](../testing.md#2-test-cases-for-every-p0-story) | Specified, including replacement and shared-genre de-duplication. |
| C03-03 | Separate raw popularity, personal adjustment, adjusted score and basis; public DTOs private-free. | [API score fields](../api.md#131-recommendation-score-transparency), [visible labels](../design.md#122-state-ordering-and-truthful-labels) | Specified, including null and rating-read degradation. |
| C03-04 | Preserve S10's exact three steps and existing public error messages. | [Existing explanation copy](../recommendation-explanation.md), [design rule](../design.md#122-state-ordering-and-truthful-labels), [error envelope](../api.md#1-conventions) | Existing copy retained; no fourth step added. |
| C03-05 | Profile summary, confirm/cancel, timeout reconciliation and save/reset transaction order. | [Profile API](../api.md#134-profile-and-watchlist), [transaction order](../architecture.md#91-rating-reads-transactions-and-reset-order), [UI states](../design.md#123-five-star-profile-and-watchlist-interactions) | Specified; ambiguous timeout is not definite success. |
| C03-06 | Versioned shared TF-IDF transform, index readiness/rebuild, corrupt/stale failure. | [Index config and manifest](../architecture.md#92-versioned-overview-index-and-startup), [API error](../api.md#132-shared-nlp-search-and-similar-reads) | Specified with `overview-tfidf-v1` and empty-vocabulary state. |
| C03-07 | Similar: shared genre, source exclusion, max five, two text groups, missing-source fallback. | [Similar API](../api.md#132-shared-nlp-search-and-similar-reads), [named case](../testing.md#2-test-cases-for-every-p0-story) | Specified; index failure differs from missing overview. |
| C03-08 | Search: static route, literal title-first, positive-only cosine, max ten, no popular fill. | [Search API](../api.md#132-shared-nlp-search-and-similar-reads), [named case](../testing.md#2-test-cases-for-every-p0-story) | Specified; positive-order and all-zero fixtures are separate. |
| C03-09 | UI tokens/interfaces, responsive layout, both themes and truthful score labels. | [UI interface/token table](../design.md#121-visual-tokens-and-shared-component-interfaces), [states](../design.md#122-state-ordering-and-truthful-labels) | Specified; implementation remains T01/feature owners. |
| C03-10 | Nullable poster DTO/path/migration/CDN/fallback; preserve backdrop and stable IDs. | [Poster DTO](../api.md#133-poster-media-on-existing-dtos), [storage handoff](../architecture.md#9-sprint-4-c03-runtime-and-storage-contract-planned) | Specified; no migration/import is claimed completed. |
| C03-11 | Treat ZIP as visual sample; exclude fake claims/data and defer VN provider slots. | [Reference exclusions](../design.md#124-reference-only-exclusions), [provider slot](../design.md#121-visual-tokens-and-shared-component-interfaces) | Specified; no ZIP HTML or data inserted into product. |
| C03-12 | Whole-set rank/filter before ten-item page, counts/revision and 25 -> 10/10/5. | [API rank/page](../api.md#131-recommendation-score-transparency), [UI URL state](../design.md#122-state-ordering-and-truthful-labels), [P0 cases](../testing.md#2-test-cases-for-every-p0-story) | Specified. |
| C03-13 | Watchlist unique account/movie, addedAt/internal ID, list/status/PUT/DELETE, order/page/CSRF/reset preservation. | [Watchlist API](../api.md#134-profile-and-watchlist), [table/owner](../architecture.md#9-sprint-4-c03-runtime-and-storage-contract-planned), [UI](../design.md#123-five-star-profile-and-watchlist-interactions) | Specified; future T12 implementation not claimed. |
| C03-14 | Five integer star hover/draft/committed/explicit-save/keyboard/API semantics. | [Rating interaction](../design.md#123-five-star-profile-and-watchlist-interactions), [named case](../testing.md#2-test-cases-for-every-p0-story) | Specified; future browser verification not claimed. |
| C03-15 | Four-layer test strategy and 2–3 risk sentences. | [Testing section 1](../testing.md#1-what-we-test-and-why) | Four layers and three risk sentences present. |
| C03-16 | Six P0 stories, unique IDs, three cases minimum, numeric boundaries and production trace. | [Testing section 2](../testing.md#2-test-cases-for-every-p0-story) | 35 IDs: S01=8, S02=6, S03=4, S04=6, S12=5, S13=6; 0/1/2/4/5/6 genres, 7/8/9 password, 9/10/11 limit and 25-movie pages included. |
| C03-17 | Future root pytest, isolated migrated SQLite, deterministic clocks/data, no server/token/network. | [Testing section 3](../testing.md#3-automated-tests) | Specified; C05 #219 owns actual root setup. |
| C03-18 | Separate genuine RED/GREEN from mutation effectiveness; case ID to production assertion. | [Testing section 3](../testing.md#3-automated-tests), [findings status](../testing.md#4-what-the-tests-found) | Specified; no event or test result fabricated. |
| C03-19 | Keep historical Story AC/baseline; transfer final executable reconciliation to #218. | [S4 delivery status](../api.md#13-sprint-4-c03-implementation-contract-planned-not-delivered), [testing handoff](../testing.md#4-what-the-tests-found) | Historical snapshots/Story AC untouched; final audit still belongs to #218. |

## Commands, actual results and limits

Run from the repository root. The
[structural verifier](../../scripts/verify_s4_c03_contract.py) is read-only,
standard-library only and does not use the database, `.env` or network:

```powershell
.\.venv\Scripts\python.exe scripts/verify_s4_c03_contract.py
.\.venv\Scripts\python.exe -m ruff check scripts/verify_s4_c03_contract.py
git diff --check
```

Observed locally on 2026-10-24 (exit 0 for each command):

```text
S4-C03 local document structure: PASS
Document final newlines/trailing whitespace: PASS
Local link targets: 184 checked, 0 missing
Testing sections: 1, 2, 3, 4
P0 case IDs: 35 unique; S01=8, S02=6, S03=4, S04=6, S12=5, S13=6
S4 feature oracle IDs: 9 unique
ruff: All checks passed!
git diff --check: no output
```

| Check | Expected | Actual |
|---|---|---|
| Structural verifier | Four numbered testing sections, all six P0 stories with at least three unique IDs, local links and candidate hashes consistent | Pass; four sections, 35 unique IDs, 184 local links with none missing; hashes match the table below. |
| Ruff | No Python lint findings in the verifier | `All checks passed!` |
| Tracked diff whitespace | No malformed whitespace | `git diff --check` exit 0, no output. |
| Existing backend regression | Inherited behaviour remains green on disposable SQLite | 447 passed, 1 skipped, 1 deprecation warning, exit 0; not an S4 feature pass. |
| Independent contract review | Non-coauthor checks content and records a dated decision | Pending; no reviewer decision is claimed. |

The verifier checks document structure and local path existence, **not**
semantic approval or actual execution of the planned TC-IDs.

The existing backend suite was run previously on the same executable base
through the isolated runner:

```powershell
.\.venv\Scripts\python.exe backend/scripts/run_isolated_tests.py -q backend/tests/test_catalogue_pagination.py backend/tests/test_profile_reset_api.py backend/tests/test_nlp_spike.py
```

Actual result: disposable SQLite migrated through `c6f8a2d4e901`;
`447 passed, 1 skipped, 1 warning in 157.94s (0:02:37)`; exit 0.
The warning was Starlette TestClient/httpx deprecation. The runner
automatically included all `backend/tests`, so this was the existing full
backend suite. It validates the inherited baseline only; it did **not**
execute future S4 routes, root `tests/` cases, React/browser UI or live
TMDb smoke. It was not rerun merely because this evidence document changed.

## Candidate hashes

The final verifier run below identifies the exact local contract files.
Because there is no commit, these hashes plus the base HEAD identify the
candidate; the evidence file itself is a report and is checked for links
and whitespace but is not self-hashed.

| File | SHA-256 from final verifier run |
|---|---|
| `docs/api.md` | `7f0aea3a426075ec0d6eedec15aaeecfbceef3119960127d0077704a72fbbd47` |
| `docs/architecture.md` | `689c00033a077de877ad228e138a9701f438c0c0eb0a2eb313e1dbff451efbb7` |
| `docs/design.md` | `325150ab82b348e8030d32e2886b23f6bef9e74422ad614e8eee94fa7ff3e6fe` |
| `docs/testing.md` | `3d07dcb4000a3d77869b7725fe71a3b88e1db45f4faeaa5f85acb6fb8ec40fb3` |
| `scripts/verify_s4_c03_contract.py` | `969ff06d8a3734b3037dba35324fcb0f8903cf56116df2c9651edc5fe49e2e0c` |

## Review and acceptance status

The author-side mapping and local checks are complete. **Independent
substantive review has not occurred.** A non-coauthor reviewer would need
to inspect score null/degradation rules, NLP readiness, reset transaction
order, watchlist ownership, P0 test expectations and the ZIP exclusions;
their dated comments/corrections and decision must be recorded only after
that actual review. The live #217 comparison also remains unverified.

C03 contract review can finish before the feature owners implement Sprint 4
behaviour. This evidence does not turn planned pytest cases or UI states
into passes. It claims no mutation, feature TDD event, new API/browser
acceptance, reviewer approval, PR, commit or GitHub closure.
