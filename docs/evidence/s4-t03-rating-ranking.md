# S4 #22 rating-informed ranking — local author evidence, 2026-10-24

## Scope and status

This candidate implements the rating-sign portion of Story S05b/#22 on the
existing protected recommendation route. The source specification was the
user-supplied 2026-10-24 issue excerpt, the merged C03 contract and existing
S3 code. Live issue pages were unavailable from this environment, so no
later issue edit is claimed checked. The work is local only: no commit,
push, PR, issue closure or independent review is claimed here.

The runtime reuses the TMDb-imported **local** SQLite catalogue, existing
ratings/preferences/session tables and established route. Tests seed
fictional rows in isolated SQLite and the runner disables TMDb network and
token access. There is no schema migration, ZIP sample data or new provider
dependency. The existing S3 source docs remain historical; the S4
[API](../api.md#131-recommendation-score-transparency),
[architecture](../architecture.md#91-rating-reads-transactions-and-reset-order)
and [design](../design.md#122-state-ordering-and-truthful-labels) sections
describe this candidate.

## Genuine feature RED then GREEN

Pre-implementation Git HEAD:
`53f761d19494fb07d7ccee2ca4819d579676a2c0`. The new
[synthetic API test](../../backend/tests/test_s4_rating_ranking.py) was written
before the service/schema/repository changes. The same five parametrized
assertions were run before and after the implementation; test names and
expected values were not changed to obtain GREEN.

Environment: Windows PowerShell, Python 3.12.3, Node.js v24.20.0, offline isolated runner,
temporary SQLite database migrated through `d8a4e6f20195`. Each new API
case also uses a fresh on-disk SQLite file. Command:

```powershell
.\.venv\Scripts\python.exe backend/scripts/run_isolated_tests.py -q -k saved_rating_sign_changes_80_80_candidate_order
```

| Phase | Exit | Actual assertion/result |
|---|---:|---|
| RED, new test against pre-implementation HEAD | 1 | `5 failed, 528 deselected, 1 warning in 2.72s`. Ratings 1/2/3 failed at `KeyError: 'ratingAdjustment'`; ratings 4/5 additionally showed `Alpha Comedy` before expected `Zulu Action`. These are missing product behaviour, not import/setup errors. |
| GREEN, same test after implementation | 0 | `5 passed, 528 deselected, 1 warning in 2.79s`. Values 1/2 give Action 79, 3 gives 80, 4/5 give 81; Comedy remains 80 and both raw popularity values remain 80. |

The RED runner reported these production assertion lines:

```text
E       KeyError: 'ratingAdjustment'
E       AssertionError: assert 'Alpha Comedy' == 'Zulu Action'
5 failed, 528 deselected, 1 warning in 2.72s
```

The GREEN rerun of the same parametrized test reported:

```text
.....                                                                    [100%]
5 passed, 528 deselected, 1 warning in 2.79s
```

The full post-implementation executable has no commit SHA because the user
has authorized local edits only. The base SHA above plus the working-tree
file digests recorded below identify what was tested. A later commit SHA
must be added by the author before external review; this report does not
invent one. RED/GREEN is feature TDD evidence. No mutation/effectiveness
result is claimed; #200 may audit that separately.

## Acceptance observations

| Rule | Test node and observed result |
|---|---|
| 80/80 and every value 1–5 | `test_saved_rating_sign_changes_80_80_candidate_order`: Action adjusted 79/79/80/81/81; Comedy 80; expected title/order and raw 80 checked. |
| 90/80 neutral and no ratings | `test_90_80_neutral_and_no_ratings_preserve_baseline_order`: Action 90 remains ahead; basis is `baseline`. |
| One contribution per rated movie | `test_shared_genres_count_once_updates_replace_sign_and_accounts_are_isolated`: Action+Comedy rated movie contributes one sign to a two-genre candidate; separate Action rating contributes independently. |
| Update 5 → 1 and account ownership | The same test observes the latest signs `-2`, `-2`, `-1` on A's respective candidates after update; B remains at baseline 90. Forged `userId` query values do not retarget either account. |
| Whole-set ranking, filter and pages | `test_rank_complete_base_before_filter_and_page_all_25_candidates`: boosted former eleventh candidate enters page 1; pages are 10/10/5 distinct movies; `total=25,totalPages=3`; Comedy view returns only Target with `total=1,unfilteredTotal=25`. |
| Null and deterministic tie | `test_null_popularity_remains_null_even_with_rating_signal` keeps raw/adjusted score null and the movie after finite scores. `test_equal_adjusted_score_uses_title_then_internal_id` checks final ID tie. |
| Rating-only failure | `test_rating_query_failure_is_truthful_baseline_and_retry_recovers`: a real SQL rating query raises `OperationalError`; response remains 200 with `rating_unavailable`, zero adjustment, baseline order, unchanged preferences, no private error text, and a later retry restores boosted order. |
| Popular/cold-start/no-match privacy | `test_popular_fallback_has_no_personal_scores_even_when_account_rated`: raw ordering remains 90/80 and no `ratingAdjustment`, `adjustedScore` or `basis` key appears. Existing T09 tests retain 401 and core 503 paths. |
| UI labels | `recommendation-filter.test.tsx` checks distinct `TMDb popularity` and `Personal adjusted score`, a +1 related-signal label, and a truthful unavailable label that does not say the account has no ratings. Public cards receive no ranking props. |
| Confirmed-save refresh | `movie-rating.test.tsx` checks recommendation invalidation occurs once after a committed acknowledgement and not while pending or after a failed save. |

The [S3 synthetic fixture test](../../backend/tests/test_personalised_recommendations_api.py)
was updated only where its old whole-response oracle and “ratings never
change ranking” assertion became obsolete under S4. Its popular responses
remain private-field-free. The actual production trace is
`/api/me/recommendations` →
[`build_account_recommendations`](../../backend/app/recommendations/service.py)
→ [full eligible and current-account queries](../../backend/app/repositories/recommendations.py)
→ [response schema](../../backend/app/schemas/recommendations.py), and
React `RecommendationFilter` → `MovieGrid` →
[`MovieCard`](../../frontend/src/components/MovieCard.tsx).
The confirmed rating-save path calls the existing auth-state
`invalidateRecommendations` hook from
[`MovieRating`](../../frontend/src/components/MovieRating.tsx).

## Commands, results and limits

Run from the repository root with the setup in `docs/SETUP.md`:

```powershell
.\.venv\Scripts\python.exe backend/scripts/run_isolated_tests.py -q -k test_s4_rating_ranking
.\.venv\Scripts\python.exe backend/scripts/run_isolated_tests.py -q
.\.venv\Scripts\python.exe -m ruff check backend/app/main.py backend/app/recommendations/service.py backend/app/repositories/recommendations.py backend/app/schemas/recommendations.py backend/tests/test_personalised_recommendations_api.py backend/tests/test_s4_rating_ranking.py
npm.cmd --prefix frontend test
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run build
git diff --check
```

Observed focused backend result: `12 passed, 528 deselected, 1 warning in
3.12s`, exit 0. Frontend Vitest: `26` files and `278` tests passed in
`23.23s` on the final UI candidate, exit 0. Ruff and ESLint passed;
TypeScript/Vite build passed.
The one warning is the inherited Starlette TestClient/httpx deprecation.
The final full backend regression returned `539 passed, 1 skipped, 1 warning
in 159.68s (0:02:39)`, exit 0. The runner migrated its disposable SQLite
database through `d8a4e6f20195`; this run includes all 12 new #22 API cases.
The skipped test and deprecation warning are inherited; no planned Sprint 4
browser case is counted as a backend pass. `git diff --check` exited 0, with
only Git's LF-to-CRLF conversion warning for `docs/testing.md`.

### Exact working-tree executable snapshot

These are SHA-256 digests of UTF-8 file text after CRLF/CR → LF normalization.
They identify the author-tested candidate on base HEAD `53f761d` until an
actual implementation commit exists. Documentation digests are separately
checked by `scripts/verify_s4_c03_contract.py`.

| File | Normalized-LF SHA-256 |
|---|---|
| `backend/app/main.py` | `6fec41aa2b9c4ee89e4324e5d2cb25d540cf2ad449ccb9da4fb67cfc306196e3` |
| `backend/app/recommendations/service.py` | `1b09caec254d2562f675feab4c139fbd8097c31e276e5d2c9d3160489501f3fa` |
| `backend/app/repositories/recommendations.py` | `5098b5123d80613967d33b4747ac7057787076c041025c9da7f5656e9691863e` |
| `backend/app/schemas/recommendations.py` | `992f84ffe623412d07acc6e95f56e07db2f987c21b8b4458d9d183212c9345be` |
| `backend/tests/test_personalised_recommendations_api.py` | `4a19f3fa69419b00ff0d1ccfa443f5c76a610f22c02b809e324a6d7d88700374` |
| `backend/tests/test_s4_rating_ranking.py` | `c892680a953e90c44b79e9633e2ed5e71d10834cea3ac7252c50db4b814098e3` |
| `frontend/src/api/recommendations.ts` | `f714bfce46ec32af6ce41d4112f4ae20eb8a4252f1f9db27471e60814b0ad44d` |
| `frontend/src/components/MovieCard.tsx` | `baafe00b6835014f3eca9ab602284ef5c0090d45455a6660fd0edaacb5854dd1` |
| `frontend/src/components/MovieGrid.tsx` | `392f35934c7610dfc02daf44c60a5b49e587ff3e37aa6a5a5331698a1c6f6fdf` |
| `frontend/src/tests/recommendation-filter.test.tsx` | `d7890ca11dcb6fd899a2c1e140bba19525fc240ad06b8a06f1a4b6d931c5ba39` |
| `frontend/src/components/MovieRating.tsx` | `a8b70d1bba13f0dd24d00ee8e8c2700296d56683aee0d12e39aac5e3e54d8e35` |
| `frontend/src/tests/movie-rating.test.tsx` | `41327d92045985daa7ca8d155496a882da30e4a14af581b67c47d942a3547bc6` |

## C01 and external gates

Author-side reforecast input for C01: one combined #22 effort contains
the synthetic fixture/RED oracle, account-scoped query and full-set ranker,
API degradation/security/page tests, React score labels, regression,
contract/evidence update and independent review. The historical 5 author
hours plus 1 reviewer hour are **not** claimed as an approved current
capacity commitment. C01 must assign the revised estimate and preserve
its correction buffer; no PO approval is fabricated here.

Story S05b's five criteria have corresponding author-run observations above.
Independent substantive review by a non-coauthor, live issue comparison,
browser acceptance where required, a post-commit tested SHA, CI and merge
remain open. These cannot be completed by this local-only run. #200 is a
later audit, not a prerequisite for the RED/GREEN sequence above.
