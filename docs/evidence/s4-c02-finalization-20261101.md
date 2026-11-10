# C02 finalization and member-authored tests — 1 November 2026

PR [#244](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/244), issue [#196](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/196).
This supersedes the earlier [integration audit](s4-c02-integration-20261101.md)
for Planning, commitment, Review/Retro, PO acceptance, SM5 acknowledgement and
member-test evidence. [The receipt](s4-c02-finalization-20261101.json) records
source hashes, original authorship, actual test results and remaining gates.

## Confirmed human records

The PO explicitly confirmed in the project conversation on 1 November:

- Planning was **20 October 2026**, committing #22/#24/#30/#33 for **18 points**.
  Hour totals are omitted at the PO's request.
- All four Stories' AC/DoD are accepted: **18 committed, 18 PO-accepted completed
  points, velocity 18**. Earlier S3 Stories and Task/Chore points are not recounted.
  Parent issues remain Open at the source read; reviewed-merge closing directives
  synchronize that administrative status.
- Review and Retrospective were **1 November 2026**, with all five members present.
  The PO corrected an earlier mistaken 20 October Review date.
- Feedback/improvement focused on UI and persistent Add to watchlist.
  Existing implementation owners are T01 @kietxuan and T12 @hoang3003.
  These improvements are delivered and retained for Sprint 5 release revalidation.
- SM5 **@kietxuan acknowledged handoff**. The PO confirms
  `TuanAnh0608` and `NguyenTuanAnh0608` belong to the same Nguyen Tuan Anh.

These are attributed PO reports. No transcript, individual attendance signature,
independent reviewer execution or historical screenshot is invented.

## Actual compact M4 run

Production baseline: merged `0d2378d5f0c44889ca93c8cff7c8bc9c568b43c5`.
Relocation/source commit: `6ca4760befe135a1083bc3793b92d9db21018c89`.

```text
python -m pytest -v --junitxml=docs/evidence/s4-c02-finalization-pytest-20261101.xml
```

**40 passed, 0 failed/skipped/xfail, 22.21 seconds**. The same two default files
still map all 37 Section 2 IDs.
[Full output](s4-c02-finalization-pytest-20261101.log) ·
[JUnit](s4-c02-finalization-pytest-20261101.xml).

Runner: **Codex, author verification**, Windows, Python 3.12.6/pytest 9.1.1.
This run began before the relocation commit was created; selected test/config
bytes match that commit. The member run below used the committed relocation.
The receipt pins hashes rather than claiming later documentation was re-tested.

An initial sandbox invocation failed to clean a sandbox temp folder (Windows
Access denied). The permitted invocation passed. That environment failure is
not a business-rule red test. Passing runs have one inherited Starlette/httpx
warning. Fixtures use temporary migrated SQLite and block provider networking;
the user database/servers were untouched. No broad regression suite was run.

## Per-member authored test evidence

| Member | Current root pytest node | Actual authorship | Focused result |
|---|---|---|---|
| @kietxuan | `tests/test_s03_details.py::test_TC_P0_S03_001_public_known_id` | [`31c5bf7`](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/commit/31c5bf7b9e8b006809a1bb2fcb69338589246421) — GitHub commit author kietxuan introduced the production detail API case; subsequent changes retain its meaningful assertions. | Passed |
| @hoang3003 | `tests/test_s4_t02_rating_signals.py::test_s4_t02_account_isolation_and_no_ratings_baseline` | [`8f313bc`](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/commit/8f313bc7e3d7c84671e26f13367cf07850d0f9f5) — Original member-authored function retained verbatim in AST; whole module relocated under root tests, with fixture-path repair only. | Passed |
| @anotify-vie | `tests/test_p0_acceptance.py::test_TC_P0_S02_001_full_set_paging_has_25_distinct_movies` | [`6fbea72`](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/commit/6fbea7221093116d84450e587d2ffd6caabb72f9) — Git author Tran Tuan Anh in PR authored by anotify-vie added six meaningful lines for limit 9/10 success and limit 11 refusal. This is a shared case; initial function authored by Nguyen Tuan Anh. | Passed |
| @vu-huzy | `tests/test_similar_movies_api.py::test_comparator_oracle_usable_source_is_a_b_c_and_missing_source_is_c_b_a` | [`76c4b7f`](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/commit/76c4b7f69b0fc4f26ea0155d86b3b98e3ea0a72f) — Original member-authored comparator function retained verbatim in AST; whole module relocated without content changes. | Passed |
| @NguyenTuanAnh0608 | `tests/test_p0_acceptance.py::test_TC_P0_S12_004_duplicate_normalized_email_is_conflict` | [`f0b56b7`](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/commit/f0b56b790f2edaa2bac8830c17d8cc6f1922756b) — GitHub commit author TuanAnh0608; PR owner NguyenTuanAnh0608. PO explicitly confirmed both accounts belong to the same team member. | Passed |

Trần Tuấn Anh added a meaningful **9/10/11 boundary scenario** (six lines) to the
existing S02 case in `6fbea72`; he is not credited with the initial whole
function, which Nguyễn Tuấn Anh wrote. This contribution awaits #244 merge.

Hoàng and Huy already authored real tests under `backend/tests/`. Their modules
are moved into root `tests/`, with original source commits retained. Selected
function ASTs exactly match the GitHub originals; all moved function/class
bodies match the pre-move modules. Huy's file is unchanged after LF normalization;
Hoàng's only executable edit repairs the oracle fixture path.
The relocation commit does not change historical Git author metadata or invent
coauthor credit. Five attributable contributions exist in the proposed PR tree;
the relocations and Trần Tuấn Anh's contribution become merged with #244.

## Focused execution and reproduction

Five member nodes plus the rating JSON-oracle and Similar API/vector cases
verify the moved fixtures/imports. From the repository root on POSIX:

```bash
python -m pytest -v \
  tests/test_s03_details.py::test_TC_P0_S03_001_public_known_id \
  tests/test_s4_t02_rating_signals.py::test_s4_t02_account_isolation_and_no_ratings_baseline \
  tests/test_p0_acceptance.py::test_TC_P0_S02_001_full_set_paging_has_25_distinct_movies \
  tests/test_similar_movies_api.py::test_comparator_oracle_usable_source_is_a_b_c_and_missing_source_is_c_b_a \
  tests/test_p0_acceptance.py::test_TC_P0_S12_004_duplicate_normalized_email_is_conflict \
  tests/test_s4_t02_rating_signals.py::test_s4_t02_whole_set_handoff_oracle_is_explicit \
  tests/test_similar_movies_api.py::test_usable_source_orders_cosine_then_appends_missing_text_candidate \
  --junitxml=docs/evidence/s4-c02-member-tests-20261101.xml
```

On PowerShell use the venv Python and pass the seven nodes on one line, or use
backticks instead of POSIX continuation backslashes.

**7 passed, 0 failed/skipped/xfail, 2.54 seconds.**
[Full output](s4-c02-member-tests-20261101.log) ·
[JUnit](s4-c02-member-tests-20261101.xml).
Codex executed these tests; no separate run by each human member is claimed.
Default M4 stays 40 items. Moved modules remain optional and are included by the
existing `pytest tests backend/tests scripts` opt-in; they are not added to
the four-section P0 report.

## Remaining gates

Document structure/217 links, normalized-LF fingerprints and LF/CRLF exports
passed. The changed-scope check passed 32 local links/anchors, source hashes
and unchanged Sprint 1–3 history. Focused Ruff and default 37-ID/40-node
traceability passed; `git diff --check` is clean.

C01 #216/PR #245 still needs independent review/merge at the source read.
Its [Planning record](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/blob/b453abf5c4f908f810fb775e6cb24f094c17cb6c/docs/sprint4-backlog-refinement.md)
records the missing historical image honestly. C05 #219 still needs independent
non-author setup/build/storage/recovery acceptance; merged #243 supplies author
evidence. This C02 run is not a new independent clone/live import/recovery run.

Final C02 needs a substantive non-contributor review. @kietxuan's current
`ok` approval is formal PO review, while he also authored follow-up commits.
C04 owns final board, report/PDF/submission and LMS receipt afterward.

The [Sprint log](../sprint-log.md#sprint-4--wrap-up-cutoff-1-november-2026)
contains accepted points, reported Review/retro, member ledger and concrete
Sprint 5 handoff. Earlier receipts/logs retain their original SHA/time/scope.
