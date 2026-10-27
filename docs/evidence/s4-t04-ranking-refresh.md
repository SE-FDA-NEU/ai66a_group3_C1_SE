# S4-T04 #199: refresh after rating saves and ranking score display

Scope: the save-to-rerank integration and the `Ranking score for you` display for
Story #22. It reuses the S3 rating widget (#139) and the T03 DTO
([T03 evidence](s4-t03-rating-ranking/README.md)). It adds no ranking logic to the
browser and no API change. Independent review is **pending**; nothing below is a
reviewer decision.

## What changed

| Area | Behaviour |
|---|---|
| `MovieRating` | After a server-confirmed save it calls `invalidateRecommendations({ keepNavigationContext: true })`. A failed or unconfirmed save does not call it and keeps the draft and `Retry save`. |
| `AuthContext` | The option skips rotating the navigation scope, so page, filter, query and hash survive. Without it the hook is unchanged: preferences, reset and account change still drop that context. |
| `MovieCard` / `MovieGrid` | Personalised cards show `TMDb popularity` and, separately, `Ranking score for you` with a reason chosen from the server's `basis`. Popular, cold-start and no-match cards show no private score. |
| Reason text | `rating_signals` with a positive adjustment: "Your high ratings of related movies raised this score."; negative: "...low ratings... lowered this score."; `baseline`: "Your ratings have not changed this score." (covers no ratings and neutral 3, which the API does not distinguish); `rating_unavailable`: "Your rating signals are temporarily unavailable, so this score uses popularity only." A missing score reads `Information unavailable`. |
| `docs/design.md` | `Personal adjusted score` renamed to `Ranking score for you`, as the T02 handoff required. |

The 80 / 81 / 79 values below come from deterministic synthetic fixtures. The imported
TMDb catalogue does not have popularity 80, so these numbers are not a claim about it.

## Review findings addressed

1. **Return context lost after a rating save.** The first version rotated the navigation
   scope, so `/recommendations?source=t34#results` came back as `?page=1`. Fixed with the
   option above. The new unit and real API journeys fail on the old behaviour
   (`expected '?page=1' to be '?source=t04'`) and pass now. The T34 browser acceptance
   (`verify_s13_rating_ui.py`) also passes, including `return_context_and_preferences`.
2. **Fixture contradicted the backend.** The Comedy candidate carried an Action genre
   and a fixed adjustment of 0. It is now Comedy only, the account saves Action and
   Comedy, and the mock computes the adjustment from genre overlap like the backend.
   The real API and SQLite journey below no longer relies on a mock.

## Automated results (branch `afeb6ba` merged with `origin/main` `657025b`)

Run on 2026-10-27 after merging main (PR #230, T13); the merge commit did not exist yet,
so the working tree is the merge result. The same checks passed earlier on `2ce64ea`
(32 files, 333 tests).

| Command | Result |
|---|---|
| `npm --prefix frontend test` | 34 files, 364 tests passed (includes T13's tests from main). |
| `npm --prefix frontend run lint` | clean. |
| `npm --prefix frontend run build` | `tsc -b` and `vite build` passed. |
| `npm --prefix frontend run test:t04:integration` | 1 passed: jsdom UI, real FastAPI, migrated temporary SQLite. |
| `npm --prefix frontend run test:t33:integration` | 1 passed (S3 rating regression). |
| `npm --prefix frontend run test:t16:integration` | 1 passed (S3 filter regression). |
| `.\.venv\Scripts\python.exe -m ruff check` on the two new Python files | passed. |
| `.\.venv\Scripts\python.exe scripts/verify_s4_c03_contract.py` | PASS: 203 local links, hashes match the matrix including the new T04 row. |
| `.\.venv\Scripts\python.exe scripts/test_s4_c03_contract_line_endings.py` | PASS: LF and CRLF exports give identical hashes. |

New tests: `recommendation-ranking-display.test.tsx` (display, rounding, missing score,
popular mode, no copied rating), `rating-recommendation-refresh.test.tsx` (generation
only after commit, failed save, late pre-save response, 81/80 and 79/80 journeys,
page/filter/query/hash return) and `integration/t04-ranking-refresh.acceptance.tsx`.

Real API and SQLite journey (fixture: two candidates at 80, Action only and Comedy only,
two accounts with both genres saved): rating 5 gives Action 81 above Comedy 80, rating 1
gives Action 79 below Comedy 80, popularity stays 80, one stored row per account/movie,
account B stays `baseline`, preferences unchanged, `integrity_check` ok.

## Real browser (Chrome 155, FastAPI, temporary SQLite)

Command (needs Chrome and free ports 8000 and 5173):

```powershell
.\.venv\Scripts\python.exe backend/scripts/verify_s4_t04_ranking_ui.py --evidence-dir docs/evidence/s4-t04-ranking-ui
```

Last run at 2026-10-27 10:30 +07:00 on `afeb6ba` with `origin/main` `657025b` merged
(working tree, merge not yet committed): `result=PASS` for all seven checks. An earlier
run at 10:14 on `2ce64ea` also passed and produced byte-identical screenshots
([run output](s4-t04-ranking-ui/t04-browser-run-output.txt),
[API and database evidence](s4-t04-ranking-ui/t04-api-db-evidence.json)). The API
evidence names the account and `catalogueRevision` for each state.

| Check | Observed | Screenshot |
|---|---|---|
| Baseline and missing score | Alpha Comedy 80/80, Zulu Action 80/80, a null-popularity movie shows `Information unavailable` twice and no reason | [01](s4-t04-ranking-ui/t04-01-personalised-baseline-and-missing-score.png) |
| Rating 5 | Zulu Action popularity 80, ranking 81 first; return URL kept `?source=t04#results` | [02](s4-t04-ranking-ui/t04-02-personalised-rating-5-raised.png) |
| Themes and widths | Dark and light at 375, 768 and 1440 px: no horizontal overflow, no clipped or overflowing score text, lowest text contrast 6.39 (dark) and 6.47 (light) against the 4.5 target | [dark 375](s4-t04-ranking-ui/t04-03-dark-375px.png), [dark 768](s4-t04-ranking-ui/t04-03-dark-768px.png), [dark 1440](s4-t04-ranking-ui/t04-03-dark-1440px.png), [light 375](s4-t04-ranking-ui/t04-03-light-375px.png), [light 768](s4-t04-ranking-ui/t04-03-light-768px.png), [light 1440](s4-t04-ranking-ui/t04-03-light-1440px.png) |
| Keyboard | Tab reaches `View details for Zulu Action` with a visible 3 px focus outline; Enter opens the detail page | [04](s4-t04-ranking-ui/t04-04-keyboard-focus-on-card.png) |
| Rating 1 | Zulu Action 79 below Alpha Comedy 80, still one stored rating | [05](s4-t04-ranking-ui/t04-05-personalised-rating-1-lowered.png) |
| Rating source failure | The ratings table made unreadable for one request: every card says signals are unavailable, `basis=rating_unavailable`, scores equal popularity, no "no ratings" claim; table restored afterwards | [06](s4-t04-ranking-ui/t04-06-rating-signals-unavailable.png) |
| Account switch and Popular | Account B with no saved genres sees `Not personalised`, no `Ranking score for you` and none of A's reasons | [07](s4-t04-ranking-ui/t04-07-popular-not-personalised-account-b.png) |

Not covered by this run: the Playwright suites (`test:t01:ui`, `test:s04:e2e`) because
`@playwright/test` is not installed in this checkout, screen-reader testing and a
manual check on a physical phone.

## T01 regression

T01's component and interaction tests (`cinematic-ui`, `visual-primitives`,
`onboarding-polish`, `catalogue-sort`, `home-onboarding`, `action-feedback`) are part of
the 333 passing unit tests. The shared card CSS gained only `.movie-ranking*` rules.
The T34 browser acceptance also passed on the T04 candidate, covering sign-in, detail
return and account isolation in a real browser. The T01 Playwright visual suite itself
was not run.

## Reviewer steps and limits

1. Check out the branch, run `npm --prefix frontend ci`, then the commands in the
   results table.
2. Run the browser command above; open the screenshots and the JSON.
3. In the real app, rate a recommended movie, return from the detail page and confirm
   the URL and the new score; the numbers depend on the imported catalogue.

Known limit: if a save is committed but the user leaves the detail page before the
response arrives, the widget is already unmounted and does not advance the generation.
The next visit still refetches on mount, but the saved page/filter context is kept as
it was. The fixture-based 80/81 numbers are not a real TMDb result.
