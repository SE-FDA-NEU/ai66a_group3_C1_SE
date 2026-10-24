# S4-T02 #197: account rating signals (local candidate)

This candidate supplies the rating-signal boundary for the later T03 ranking
consumer. It reads saved ratings for one account from the active local
catalogue, converts 1–2 to −1, 3 to 0 and 4–5 to +1, and computes one
contribution per related rated movie even when several genres overlap. A
later saved value replaces the earlier value because the query reads the
current `user_movie_ratings` row. No provider token or live network is used.

T03 #198 owns the complete ranking, paging, degradation policy and optional
personal score DTO. T04 #199 owns the card label, explanation and refresh after
save. This candidate does not change the recommendation route, response DTO,
`MovieRating`, frontend rendering, or the Sprint 3 recommendation order.
The T04 handoff is to use `Ranking score for you` for the future
`adjustedScore` display, rather than C03's earlier `Personal adjusted score`.
T04 must update its design/test expectations with the UI implementation;
this T02 candidate does not change them or claim a browser pass.

## Candidate and scope reconciliation

The submitted branch HEAD before this local correction is
`7cccf76` (`origin/chore/s3-c04-review-setup-135`). Its earlier commits
contained T03/T04 work. The local worktree removes those implementations from
the net diff against `origin/main`; the retained source is
`backend/app/recommendations/signals.py` and the focused test is
`backend/tests/test_s4_t02_rating_signals.py`. No correction commit or CI run
exists yet for this reduced candidate.

The locally available T01 ref `origin/feature/s4-t01-onboarding-polish` is at
`8c2210d`; its current association with PR #224 could not be checked live.
A read-only `git merge-tree` of the previous branch HEAD with that ref reported
two conflict regions in `MovieRating.tsx`. The reduced worktree
sets `MovieRating.tsx` and `AuthContext.tsx` to the `origin/main` content, so
T02 no longer edits the feedback/pending notice or rating-save refresh area.
PR #224 should merge before final integration of #223; this local worktree is
not evidence that GitHub has merged #224 or that hosted checks are green.
A read-only path comparison found zero overlap between the reduced candidate's
four net paths and the local T01 branch's 36 changed paths. A committed
post-#224 merge result still needs to be verified on GitHub.

## Focused TDD evidence

PowerShell, Python 3.12.3, Windows, 2026-10-24. The command runs Alembic to
head on a disposable SQLite file, blanks the TMDb token, and disables provider
network access. The tests create isolated synthetic accounts and catalogue
rows of their own.

```powershell
.\.venv\Scripts\python.exe backend/scripts/run_isolated_tests.py -q -k test_s4_t02
```

Before implementing the signal functions, the focused run returned exit 1:

```text
7 failed, 1 passed, 528 deselected, 1 warning in 2.22s
E       assert 0 == -1
backend\tests\test_s4_t02_rating_signals.py:87: AssertionError
```

The failure was an actual sign assertion against a temporary zero-signal
implementation; rating 3/no rating was the one passing case. After the
account-scoped active-catalogue query and once-per-movie aggregation were
implemented, the same command returned exit 0:

```text
8 passed, 528 deselected, 1 warning in 2.20s
```

The 80/80 test was then tightened to read the stored raw popularity values;
the final-file focused rerun returned `8 passed, 528 deselected, 1 warning in
1.27s`, exit 0. The full regression below includes that final test version.
Because the user restricted this work to local files, the temporary RED state
has no commit SHA; `7cccf76` identifies the branch base, not that stub. The
earlier PR history also contains T03/T04 implementation commits, so a reviewer
must not mistake this local sequence for a clean historical test-first commit
chain on #223.

The eight cases cover all five saved values, raw 80/80 scores, two shared
genres counted once, two distinct rated movies summed, 5→1 replacement,
account A/B isolation, no-rating/neutral baseline and inactive-catalogue
exclusion. They do not claim that the recommendation API is ranked here.

Candidate source identity uses SHA-256 on UTF-8 text after CRLF/CR→LF:

| File | SHA-256 LF |
|---|---|
| `backend/app/recommendations/signals.py` | `32d317c8b7ada5b2be9eadfb32382ada4a204a03ad6e41b2d08e01589cadb78f` |
| `backend/tests/test_s4_t02_rating_signals.py` | `03b6487de33c65e3e1c3b439992eab54ebee4a79fd9051445c32cdd7428a10b0` |

## Regression and remaining gates

After scope reduction, the full disposable migrated-SQLite backend command
`.\.venv\Scripts\python.exe backend/scripts/run_isolated_tests.py -q`
returned exit 0:

```text
535 passed, 1 skipped, 1 warning in 167.10s (0:02:47)
```

The one skip and Starlette TestClient warning are inherited. Ruff passed on
the two new Python files. The C03 document verifier returned `PASS`, 194
local links and 10 unique Sprint 4 feature oracles on the unchanged contract;
`git diff --check origin/main` returned exit 0 with only Windows LF-to-CRLF
conversion warnings. The restored acceptance checks also passed locally:

| Check | Actual local result |
|---|---|
| `npm.cmd --prefix frontend run test:t33:integration` | 1 passed in 7.52s, exit 0 |
| T34 Chrome/temporary SQLite | `result=PASS`, `database_integrity=ok`, source fingerprint `f2f21128677b6716d962df6d2e926cce4a9538b63e6fd6b20e1498d6938d3781`, exit 0 |
| S04 Edge/temporary SQLite | 10 passed, 1 intentional live-mode skip in 26.1s; temporary database removed, exit 0 |

These checks verify inherited flows after removing the out-of-scope changes;
they do not execute T03/T04 behaviour or prove a merged T01 #224 candidate.
Hosted CI, clean-clone setup, live issue comparison, #224 integration and
independent review remain unverified for this candidate.
