# S4-T02 #197: rating signals and T03 handoff

## Scope and current candidate

The committed PR branch currently ends at `8f313bc7e3d7c84671e26f13367cf07850d0f9f5`.
The corrections below are local working files on that commit; they have no
new commit SHA or hosted CI result. A read-only GitHub API check confirmed
that [PR #223](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/223)
still targets this SHA and its hosted title/body still describe the old
ranking/API/UI candidate. The live [#197 issue](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/197)
assigns T02 the oracle package, rating signals, genuine feature TDD and
independent review. No Git metadata, remote branch, issue or PR body was
changed by this verification work.

T02 reads saved `user_movie_ratings` rows for the server-supplied account ID
and their canonical `movie_genres`, including retained ratings whose source
movie is no longer in the active catalogue. Rating 1–2 contributes −1, 3
contributes 0 and 4–5 contributes +1. A candidate sharing several genres
with one rated movie receives that movie's sign once. A later saved value
replaces its earlier sign. The helper does not mutate raw popularity or call
the provider. T03 #198 owns full-set ranking, page/filter metadata, failure
fallback and DTO wiring; T04 #199 owns the UI score label and refresh.

The prior active-only join was an extra rule absent from the supplied C03
contract. The new test keeps an Action candidate active while the rated
Action source moves to an inactive revision; the saved row persists and its
+1 signal remains available. T03 should consume this stored-history rule.

## Concrete oracle package for T03

[The synthetic handoff fixture](../../backend/tests/fixtures/s4_t02_ranking_handoff.json)
has two named cases with explicit source ratings, candidate scores/genres,
expected order, page contents and metadata. T02 checks the fixture and its
signal values; it does **not** claim that an API ranking implementation passes.

| Case | Expected result for T03 to assert |
|---|---|
| `neutral90_80` | A related Action source rated 3 has sign 0. `Zulu Action` raw 90 stays before `Alpha Comedy` raw 80; the rated source raw 1 remains last. Neither candidate gets an adjustment. |
| `wholeSet25` | With 25 saved-genre-eligible candidates, `Target` raw 90.5 starts 11th. A separate Comedy source rated 5 gives only `Target` +1, so its adjusted 91.5 enters page 1 at position 10. Other candidate scores stay raw. |
| Pages after signal | Page 1: `Action 01`…`Action 09`, `Target`; page 2: `Action 10`…`Action 19`; page 3: `Action 20`…`Action 24`. Lengths 10/10/5; `total=25`, `totalPages=3`, `unfilteredTotal=25`, `limit=10`. |
| Genre 2 view | `Target` only, with `total=1`, `totalPages=1`, `unfilteredTotal=25`. Apply this view after ranking the full eligible set. |

The `wholeSet25` source has genre 2 and is outside selected genre 1; it
still contributes to the related `Target` candidate, which has genres 1 and
2. The fixture's exact arrays are validated for internal consistency in
`test_s4_t02_whole_set_handoff_oracle_is_explicit`. A T03 API test must seed
these rows and compare actual `/api/me/recommendations` pages to the stored
arrays and metadata. No API pass is claimed here.

The T04 handoff remains `Ranking score for you` for the future
`adjustedScore` display, separately from raw `TMDb popularity` and `Your
rating`. The C03 design still says `Personal adjusted score`; T04 must align
its design and UI tests with the chosen label. No T04 code or contract file
is changed in this T02 candidate.

## RED/GREEN provenance

The original local signals-only exercise used a temporary zero-signal stub:
`7 failed, 1 passed, 528 deselected, 1 warning in 2.22s`, then `8 passed,
528 deselected, 1 warning in 2.20s`. The temporary RED stub was never
committed or hashed. The base `7cccf76` is **not** a SHA of that RED source,
and those results do not satisfy a requirement for a committed
pre-implementation T02 SHA. The older `c82998d` evidence records a
`53f761d` pre-implementation SHA for the now-removed T03 API ranking work;
it cannot be relabelled as signals-only T02 history.

For the new active-history correction, there **is** a committed production
baseline: `8f313bc7e3d7c84671e26f13367cf07850d0f9f5`. The new test at
normalized-LF SHA-256
`7d2a1f554b21af742662c92fd0991f1a77dc1ae83df5c125df28aa2ef3afa8d6`
failed against that exact committed helper before the implementation edit.
The [actual RED excerpt](s4-t02-active-history-red.txt) records the command,
`assert 0 == 1` and `1 failed, 535 deselected, 1 warning in 2.68s` (exit 1).
After removing the active-revision join, the same case passed:
`1 passed, 535 deselected, 1 warning in 2.58s` (exit 0). This is a real
regression RED/GREEN for the **active-history correction**, not a replacement
for the missing original feature TDD SHA.

The final focused command is:

```powershell
.\.venv\Scripts\python.exe backend/scripts/run_isolated_tests.py -q -k test_s4_t02
```

It returned `10 passed, 528 deselected, 1 warning in 2.99s` (exit 0) before
one final assertion made the active replacement revision explicit. The
final-file focused rerun returned `10 passed, 528 deselected, 1 warning in
3.87s` (exit 0).
A final local recheck on 2026-10-24 returned `10 passed, 528 deselected,
1 warning in 3.28s` (exit 0); Ruff and tracked-diff whitespace also passed.
These ten cases include values 1–5, 80/80, 90/80 neutral, shared-genre
deduplication, latest 5→1 value, account isolation, retained history after
revision change and the 25-candidate handoff oracle. The wrapper migrates a
disposable SQLite database and disables live TMDb access; the focused
fixtures create their own isolated file-backed SQLite tables and fictional
rows. The inherited warning is from Starlette TestClient.

Current source identity uses SHA-256 of UTF-8 text after CRLF/CR→LF:

| File | SHA-256 LF |
|---|---|
| `backend/app/recommendations/signals.py` | `02ab54c2d3b62fa1fb5b2851982224f3042a3fdaa02266d67abd97e59b2b1ff0` |
| `backend/tests/test_s4_t02_rating_signals.py` | `af37cd56ab15329866e5f33d23fb7b683b4d4f6731637aeb17350a5e7bed75ce` |
| `backend/tests/fixtures/s4_t02_ranking_handoff.json` | `7710a9d95ffd46969d19ca5744e59a4415a3e012904e786bc5e0eba8609229fb` |

## Regression and external gates

The full backend command
`.\.venv\Scripts\python.exe backend/scripts/run_isolated_tests.py -q`
returned exit 0 with `537 passed, 1 skipped, 1 warning in 314.43s (0:05:14)`
on the corrected production helper and oracle fixture. Pytest collected
before the last test-only assertion was added; the final-file focused rerun
above executes that assertion. Ruff on the two changed Python files,
`git diff --check` and the C03 document verifier also passed locally.

At SHA `8f313bc`, the [T34 pull-request run](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/40095509300)
failed while its [push run](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/40095506627)
succeeded. The reviewer reports that the failed job timed out opening Chrome
DevTools `/json/list`, before any rating assertion. The public GitHub API
confirms the job's browser-journey step failed but denies unauthenticated log
downloads (`403`), so the exact traceback remains reviewer-supplied. This is
a browser bootstrap observation, not evidence that signal calculation failed;
no signal algorithm change was made for it. Acceptance needs either a green
rerun or a green T34 check on the corrected PR SHA. A read-only check on
2026-10-24 found that PR run still
completed with failure on attempt 1, with PR head unchanged at `8f313bc`.
This environment has no authenticated GitHub Actions tool or `gh` CLI, so the
rerun could not be triggered here. The only recorded PR approval is at
`7cccf76`, so the
reduced-scope candidate needs independent review again. Neither hosted
rerun nor new review was performed here.

[PR #224](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/224)
is still open and unmerged at live head `51bf72ab25fedff325ada841063921f8234f23ac`.
Its current GitHub file list has no path overlap with this T02 candidate's
signal helper, focused test, oracle fixture or evidence. `MovieRating` and
`AuthContext`, the former conflict area, are outside this reduced PR diff.
The actual combined result still needs verification after #224 merges.
Clean-clone setup, hosted CI and final merge acceptance remain pending.
