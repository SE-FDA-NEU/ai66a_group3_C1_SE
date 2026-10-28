# S4-T05 #200: P0, rating and ranking acceptance audit

Date: 2026-10-28 (Asia/Saigon). Branch:
`test/s4-t05-p0-rating-ranking-acceptance`, based on fetched `origin/main`
`0feafb3295e22a76e1f624dcf086ec93ddd206d3`. All automated fixtures are
synthetic, offline and isolated from the developer database. This is candidate
evidence for a reviewer; no independent review, PR merge or issue closure is
claimed here.

## Reproduce

From the repository root, with the locked backend/frontend dependencies and
Chrome installed:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_s03_details.py tests/test_p0_acceptance.py tests/test_rating_ranking_acceptance.py -q
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m pytest -v
.\.venv\Scripts\python.exe scripts/verify_s4_t05_trace.py
.\.venv\Scripts\python.exe scripts/verify_s4_t05_mutations.py
npm.cmd --prefix frontend test
npm.cmd --prefix frontend run test:t04:integration
npm.cmd --prefix frontend run test:t33:integration
.\.venv\Scripts\python.exe backend/scripts/verify_s4_t04_ranking_ui.py --evidence-dir docs/evidence/s4-t05-ranking-ui
$env:S04_PYTHON = (Resolve-Path '.\.venv\Scripts\python.exe').Path
$env:S04_BROWSER_CHANNEL = 'chrome'
npm.cmd --prefix frontend run test:t01:ui
```

The browser commands start local servers and use a migrated temporary SQLite
database. The Chrome verifier may need normal process permissions to launch its
headless browser; the first sandboxed attempt exited before an application
assertion, and the rerun passed. Neither browser command needs a TMDb token.

## P0 Section 2 case map

Every ID below is a collected test in repository-root `tests/`, and the focused
command above executes every node. `tests/conftest.py` migrates a separate
SQLite database per case, checks foreign keys and blocks provider HTTP. The
tests call production FastAPI routes and assert persisted rows or returned
HTTP/DTO values. Browser-specific navigation and rendering claims use separate
frontend tests.

<!-- TC-MAP-START -->
| Section 2 ID | Collected pytest node |
|---|---|
| `TC-P0-S01-001` | `tests/test_p0_acceptance.py::test_TC_P0_S01_001_canonical_genres_and_empty_selection` |
| `TC-P0-S01-002` | `tests/test_p0_acceptance.py::test_TC_P0_S01_002_zero_preserves_previous_rows` |
| `TC-P0-S01-003` | `tests/test_p0_acceptance.py::test_TC_P0_S01_003_004_005_006_exact_selection_boundaries[TC-P0-S01-003]` |
| `TC-P0-S01-004` | `tests/test_p0_acceptance.py::test_TC_P0_S01_003_004_005_006_exact_selection_boundaries[TC-P0-S01-004]` |
| `TC-P0-S01-005` | `tests/test_p0_acceptance.py::test_TC_P0_S01_003_004_005_006_exact_selection_boundaries[TC-P0-S01-005]` |
| `TC-P0-S01-006` | `tests/test_p0_acceptance.py::test_TC_P0_S01_003_004_005_006_exact_selection_boundaries[TC-P0-S01-006]` |
| `TC-P0-S01-007` | `tests/test_p0_acceptance.py::test_TC_P0_S01_007_invalid_sets_preserve_previous_selection` |
| `TC-P0-S01-008` | `tests/test_p0_acceptance.py::test_TC_P0_S01_008_guest_forgery_and_origin_leave_accounts_intact` |
| `TC-P0-S02-001` | `tests/test_p0_acceptance.py::test_TC_P0_S02_001_full_set_paging_has_25_distinct_movies` |
| `TC-P0-S02-002` | `tests/test_p0_acceptance.py::test_TC_P0_S02_002_rating_free_order_and_reasons` |
| `TC-P0-S02-003` | `tests/test_p0_acceptance.py::test_TC_P0_S02_003_no_match_uses_unboosted_popular` |
| `TC-P0-S02-004` | `tests/test_p0_acceptance.py::test_TC_P0_S02_004_guest_and_expired_cookie_are_private` |
| `TC-P0-S02-005` | `tests/test_p0_acceptance.py::test_TC_P0_S02_005_core_failure_then_retry_preserves_preferences` |
| `TC-P0-S02-006` | `tests/test_p0_acceptance.py::test_TC_P0_S02_006_filter_after_whole_set_ranking` |
| `TC-P0-S03-001` | `tests/test_s03_details.py::test_TC_P0_S03_001_public_known_id`<br>`tests/test_s03_details.py::test_TC_P0_S03_001_missing_optional_fields[year]`<br>`tests/test_s03_details.py::test_TC_P0_S03_001_missing_optional_fields[summary]`<br>`tests/test_s03_details.py::test_TC_P0_S03_001_missing_optional_fields[both]` |
| `TC-P0-S03-002` | `tests/test_s03_details.py::test_TC_P0_S03_002_unknown_id_refused` |
| `TC-P0-S03-003` | `tests/test_s03_details.py::test_TC_P0_S03_003_catalogue_and_database_failures_are_distinct` |
| `TC-P0-S03-004` | `tests/test_s03_details.py::test_TC_P0_S03_004_return_query_cannot_redirect_or_change_public_movie` |
| `TC-P0-S03-005` | `tests/test_s03_details.py::test_TC_P0_S03_005_detail_widgets_preserve_both_accounts_preferences` |
| `TC-P0-S03-006` | `tests/test_s03_details.py::test_TC_P0_S03_006_membership_commit_allows_read_snapshot_cleanup` |
| `TC-P0-S04-001` | `tests/test_p0_acceptance.py::test_TC_P0_S04_001_public_catalogue_pages_include_null_popularity` |
| `TC-P0-S04-002` | `tests/test_p0_acceptance.py::test_TC_P0_S04_002_cold_start_has_no_personal_score` |
| `TC-P0-S04-003` | `tests/test_p0_acceptance.py::test_TC_P0_S04_003_limit_9_and_10_keep_full_total` |
| `TC-P0-S04-004` | `tests/test_p0_acceptance.py::test_TC_P0_S04_004_limit_and_page_refusals` |
| `TC-P0-S04-005` | `tests/test_p0_acceptance.py::test_TC_P0_S04_005_empty_active_versus_missing_revision` |
| `TC-P0-S04-006` | `tests/test_p0_acceptance.py::test_TC_P0_S04_006_stale_catalogue_revision_is_409` |
| `TC-P0-S12-001` | `tests/test_p0_acceptance.py::test_TC_P0_S12_001_eight_char_normalized_hashed_registration` |
| `TC-P0-S12-002` | `tests/test_p0_acceptance.py::test_TC_P0_S12_002_seven_char_password_has_no_row` |
| `TC-P0-S12-003` | `tests/test_p0_acceptance.py::test_TC_P0_S12_003_nine_char_password_has_safe_dto` |
| `TC-P0-S12-004` | `tests/test_p0_acceptance.py::test_TC_P0_S12_004_duplicate_normalized_email_is_conflict` |
| `TC-P0-S12-005` | `tests/test_p0_acceptance.py::test_TC_P0_S12_005_invalid_email_and_storage_failure_create_no_account` |
| `TC-P0-S13-001` | `tests/test_p0_acceptance.py::test_TC_P0_S13_001_login_me_cookie_and_safe_user` |
| `TC-P0-S13-002` | `tests/test_p0_acceptance.py::test_TC_P0_S13_002_wrong_and_unknown_credentials_same_public_error` |
| `TC-P0-S13-003` | `tests/test_p0_acceptance.py::test_TC_P0_S13_003_logout_replay_and_later_login_restore_data` |
| `TC-P0-S13-004` | `tests/test_p0_acceptance.py::test_TC_P0_S13_004_missing_expired_and_revoked_sessions_refused` |
| `TC-P0-S13-005` | `tests/test_p0_acceptance.py::test_TC_P0_S13_005_account_isolation_and_forged_identity` |
| `TC-P0-S13-006` | `tests/test_p0_acceptance.py::test_TC_P0_S13_006_cross_origin_auth_and_write_refused` |
<!-- TC-MAP-END -->

## Rating #21 / ranking #22 acceptance

| Criterion | API/DB or UI evidence | Observed result |
|---|---|---|
| #21 save and update | `test_s05a_saved_value_replaces_one_row_and_invalid_write_preserves_it` | PUT/GET returns current value; repeated updates leave exactly one SQLite row. |
| #21 invalid write and retry | Same test and `test_s05a_failed_update_has_no_success_and_retry_commits`; T33 integration and T01 browser | 0, 6, quarter step and string rejected; stored value survives; injected UPDATE failure returns 503, previous 3 remains, retry saves 5. UI keeps draft and shows failure/retry until a confirmed save. |
| #21 optional and A/B | First rating test, `TC-P0-S03-005`, T01 browser | Unrated GET is null; B cannot read A's value; recommendations remain available. |
| #22 positive, negative, neutral | `test_s05b_save_to_rerank_exact_scores_and_account_isolation`; [browser API/DB capture](s4-t05-ranking-ui/t04-api-db-evidence.json) | Action/Comedy raw 80/80: 5 gives 81/80 and Action first; 1 gives 79/80 and Comedy first; 3 gives 80/80 and title tie. Popularity stays 80. |
| #22 full set, distinct and one signal | `TC-P0-S02-001`, `TC-P0-S02-006`, existing `test_rank_whole_set_before_paging_and_view_filter` and `test_overlap_once_null_popularity_and_deterministic_ties` | 25 distinct page 10/10/5; view filter after rank; shared genre overlap adds one sign. |
| #22 failure and alternatives | `test_s05b_rating_query_failure_is_truthful_and_core_failure_is_error`, `test_s05b_reset_reselection_removes_old_signal_preserves_b`; [browser output](s4-t05-ranking-ui/t04-browser-run-output.txt) | Rating-only failure uses 200 baseline with `rating_unavailable`; core failure remains 503. After A reset/reselection the old signal vanishes, B remains identical; Popular has no private score/reason. |
| Save-to-rerank and account UI | T04 real API/SQLite integration and Chrome browser; [score screenshots](s4-t05-ranking-ui/t04-02-personalised-rating-5-raised.png), [failure screenshot](s4-t05-ranking-ui/t04-06-rating-signals-unavailable.png), T01 Chrome | Confirmed save refreshes the same account and keeps return context; rendered order/score/reason match the API capture. Chrome checked keyboard focus, six theme/width combinations and account switch. |
| Touch and stale rating responses | [T05 touch browser case](../../frontend/e2e/s4-t16.detail-boundaries.ts), existing `movie-rating.test.tsx` and `rating-recommendation-refresh.test.tsx` | Chrome touch emulation at 375px selects 2.5 stars without a write; explicit Save makes one PUT and reload keeps 2.5. Existing component checks reject late 200/401/503 after account or movie switch, keep a failed draft for Retry and rerank only on confirmed save. |

The historical #21 text rejects any non-integer rating, but the later T16
contract and current migrated API accept exact half-star values 0.5 through 5.
The added regression asserts the current contract and rejects quarter steps.
Personal stars, raw TMDb popularity and adjusted ranking score remain separate.
The original three-step S10 explanation is covered by
`backend/tests/test_recommendation_explanation_content.py` and is unchanged.

## Genuine TDD and test effectiveness

T02 #197's [own evidence](s4-t02-rating-signals.md) states that its original
signals-only RED used an uncommitted zero-signal stub and has no exact
pre-implementation source SHA. Its later active-history correction has a
committed baseline `8f313bc`, a meaningful `assert 0 == 1` RED and same-test
GREEN, but that does not retroactively prove the original feature TDD.
T03 #198's [original RED/GREEN log](s4-t03-rating-ranking/tdd.log) shows the
same `test_five_star_related_rating_reorders_80_80` ordering assertion fail
before implementation and pass after implementation. Its
[manifest](s4-t03-rating-ranking/README.md) identifies the uncommitted GREEN
source; base Git SHA `d3c24ac` alone is not the GREEN candidate. This audit
reproduces regression on current code; it does not invent missing old SHAs.

The [mutation log](s4-t05-mutations.txt) is a separate, labelled
test-effectiveness exercise: all 36 newly authored root test nodes have a
relevant wrong business rule that caused their own pytest assertion to fail.
Each source file was restored byte-for-byte and the exact same node passed.
The S05b score mutation is a representative Section 4 item for C04 #218.
The runner refuses syntax/setup failures as evidence. The six inherited S03
IDs already have T16's bug/fix evidence and were not authored in T05.

## Execution and review boundary

| Command | Expected | Observed |
|---|---|---|
| Focused root P0/rating command | Every Section 2 ID and added rating journeys pass | 45 passed, one inherited Starlette warning. |
| Full repository `python -m pytest -v` | Existing backend plus root regression | 761 passed, 1 historical skipped placeholder, 210 subtests passed; this run began before the final added failed-update test and shared-fixture move. Final-candidate rerun is recorded below. |
| Default `python -m pytest` | Full discovery with the shared root fixture | 762 passed, 1 historical skipped placeholder; began before the final numeric-boundary assertions, which passed separately. |
| Full frontend Vitest | No component regression | 435 passed in 38 files. |
| T04 real API/SQLite integration | Confirmed-save refresh matches ranking API | 1 passed. |
| T33 real API/SQLite integration | Rating widget keeps committed/draft and account boundary | 1 passed. |
| Chrome ranking verifier | Real browser compares displayed order, fields and reasons with API/DB | 7 checks PASS, Chrome 156, database integrity `ok`; first sandboxed browser launch failed before checks. |
| T01 Chrome suite | Star keyboard/navigation and P0 browser regression | 16 passed; one marked live-TMDb screenshot test skipped by fixture mode; temporary DB removed. |
| T13 Chrome suite | Reset/reselection, account ownership and session recovery | 4 passed; temporary DB removed. |
| T16/T05 Chrome suite | Half-star pointer, keyboard, touch, return context, account races | First concurrent run: 2 passed, then server fixture disconnected during case 3 and subsequent cases failed with `ECONNREFUSED`. Isolated rerun: 19 passed. Final run after adding touch: 20 passed; temporary DB removed. |
| Frontend lint/build | ESLint, TypeScript and Vite | Both passed. |

The final verbose run on committed executable/test SHA `5ae1e0f` returned
**762 passed, 1 historical skipped, 210 subtests passed** in 346.20 seconds.
The skipped placeholder is in `backend/tests/test_auth_catalogue_handoff.py`;
none of the 37 Section 2 IDs is skipped or xfailed. The T05 touch browser
test was added after that SHA and exercised in the separate 20-case Chrome run;
it changes no application code or Python test. Its normalized-LF SHA-256 is
`0958c0abccb84497c378a55cde175eb04716c0e3737356abd2ccc3173134776d`.
The final frontend rerun returned 435 Vitest tests; lint and build passed.
The current root tests' Git authors are
Kiet for S03 and Tuan Anh for the new P0/rating suite. The requirement for
each named member to author a root pytest through their own reviewed PR is
therefore **not yet demonstrated** by this branch; backend or Vitest authorship
cannot be substituted. A non-coauthor independent reviewer must inspect this
candidate and record their decision before #200 can close. Current GitHub
#22 remains Open, and S03 #19 still has an unchecked post-M3 return-context AC;
these issue states are not silently changed by this test result.
