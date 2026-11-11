# S5-T07 public acceptance and M5 demo preparation

Issue [#254](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/254). Checked on **11 November 2026** (Asia/Saigon) from the application source at `50aa9ad4fccc63f5d7ef8186bb296ed12f0d18ee`. This is an **incomplete acceptance record**: the current public deployment lacks the regional-provider release. No PO decision or independent review is claimed.

## Candidate identity and public blocker

The source commit is the merge of [T05 PR #263](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/263). Its [main CI run](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/42987332068) completed successfully. T03 [#260](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/260), T05 #263 and T06 [#262](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/262) are merged; their prior evidence is recorded at [T03](../../s5-t03-deployment.md), [T05](../s5-t05-regional-ui.md) and [T06](../s5-t06-recovery/README.md).

The only supplied public target is `https://cineai-o9tf.onrender.com/`. A real headless Microsoft Edge 157 desktop session and an **emulated** 390×844 mobile viewport visited it. The [read-only probe](public-probe.json) recorded Home 200 with 10 movie links, Popular and Details navigation, a working light-theme switch, and `/health` 200. The catalogue API reported 989 movies. This does not substitute for a physical phone or a private laptop browser.

**Release blocker:** public `/health` reports migration `a3d1f8b72c44`, while the current source's local PostgreSQL target is at `d9a6f2c1e508`. The public Details DTO for an imported movie has neither `providers` nor `watchOptionsUrl` for US, GB or SG. The public Details UI has no Country selector and no TMDb watch-options action. The [public desktop Details image](public-detail-desktop.png) and [mobile emulation](public-detail-mobile-emulated.png) show this. The actual Render deployed source SHA is **unverified**; the schema/API observations prove the required candidate is not fully deployed, without identifying its exact old SHA. Do not mark the regional-provider or final public gate accepted on this deployment.

## Reproducible local checks

Windows, Python 3.12.10, Node 24.15.0 and a temporary isolated PostgreSQL **18.1** server on loopback were used. The native `psql` query returned `server_version = 18.1`. Runtime examples used two labelled synthetic movies from the disposable T06 recovery fixture; no public or Neon database was mutated by the local suites. Local Edge used the production frontend bundle and a loopback FastAPI process. [Local browser/API observations](local-probe.json) show schema `d9a6f2c1e508`, the Country selector and API responses for US/GB/SG. Movie `movie-a` has an exact US TMDb URL ending `movie/101/watch?locale=US`, the analogous GB URL and SG no-data/null-link fallback. The visible US and GB actions use `_blank` and `noopener noreferrer`. [Local desktop](local-detail-desktop.png) and [mobile emulation](local-detail-mobile-emulated.png) images show the current component. These synthetic results are **not** claims about public regional data.

| Check | Actual result |
| --- | --- |
| `python -m pytest -q` | 40 P0 tests passed, zero skipped. The [existing case map](../../testing.md#2-test-cases-for-every-p0-story) covers normal, refusal and boundary cases for S01/S02/S03/S04/S12/S13; the trace script mapped 37 logical IDs to 40 collected cases. |
| Nine affected frontend suites, including regional providers, Details, account/navigation/media and Watchlist | 128 passed. |
| PostgreSQL T01 integration, with `TEST_POSTGRES_MAJOR=18` and a disposable database | 12 passed, zero skipped. Includes migration, target-override refusal, API isolation and concurrency. |
| PostgreSQL T06 dump/restore comparator, two disposable databases | 5 passed, zero skipped. See the prior [real Neon recovery handoff](../s5-t06-recovery/README.md) for source/restore counts and provider-link persistence. |
| Focused provider/CLI/health/production-serving backend selection | 154 passed; two symlink tests failed at setup on Windows `WinError 1314` because this account cannot create symlinks. A rerun in the alternate execution context hit temp-directory ACL errors. No application assertion failed in those two tests. |
| Python Ruff, frontend ESLint and production build | Passed. |
| Local account UI journey | [Two synthetic accounts](local-accounts.json): duplicate registration returned HTTP 409 with the UI refusal, A saved Action/4.5 stars/Watchlist and retained both after reload and later login, B saved Drama and saw neither A's rating nor Watchlist membership. |

The executed local commands were `python -m pytest -q`, `python scripts/verify_s4_t05_trace.py`, `python -m ruff check backend`, `npm.cmd --prefix frontend run lint`, `npm.cmd --prefix frontend run build`, and the nine-file Vitest selection listed in [T05's affected-suite command](../s5-t05-regional-ui.md#automated-verification). The PostgreSQL runs were `python -m pytest -q -c pytest.ini backend/tests/test_postgresql_t01.py` and `python -m pytest -q -c pytest.ini backend/tests/test_s5_t06_postgres_recovery.py`, with the disposable PostgreSQL URL variables set as those test files require. The browser scripts were `node scripts/s5-t07-public-probe.mjs` and, with explicit write opt-in, `node scripts/s5-t07-public-accounts.mjs` from `frontend/`. Their JSON artifacts identify the observed target and device class.

The required local business-rule mutation was real and temporary: change `PreferenceRequest.genreIds` maximum from 5 to 6, run `TC-P0-S01-007`, then restore the exact original bytes. The [red run](mutation-red.txt) failed because six genres returned HTTP 200 instead of the required 400; the [restored green run](mutation-restored-green.txt) passed. Exit codes were 1 then 0, and the source SHA-256 before/after matched `C3A5597679E891D620C4DE8B9C8327797A04C2BBBBB229BCB9300338B4E35F0F`.

The public account probe is **inconclusive**. Three separate attempts each created one unique synthetic account (HTTP 201), but the subsequent duplicate-email UI attempt displayed `Email is required` and sent no second registration request in the final diagnostic. The script's temporary credentials were not written to the repository or retained after each run, so later-login/A–B checks were not established on public. [Last diagnostic](public-accounts.json). This is not yet evidence of a server duplicate-email defect; rerun with a stable, approved review account after the deployment is corrected. No further public accounts should be created just to debug the probe.

## Two authentic M3/current UI comparisons

1. [M3 Home](../s3-m3-p0-handoff/latest/live/live-first-screen.png) → [current public Home](public-home-desktop.png). The old first screen placed navigation as a set of buttons beside a plain catalogue. The current screen has an explicit Home header, separate Start/Explore actions, catalogue sort and poster cards. The current public Home is real deployed UI, but it is still missing the T05 release on Details.
2. [M3 Details](../s3-t28-backdrop-acceptance/live/live-1280.png) → [current local Details](local-detail-desktop.png). The old view foregrounded the backdrop and basic metadata. The current source adds the regional availability section beside existing trailer/rating/Watchlist areas. This is a **layout comparison**: the M3 image uses a real imported movie, whereas the local current image uses a synthetic movie with no poster/backdrop.

The defended design choice is a Country selector inside each movie's availability block: country is visible next to the groups and URL, and the frontend keys results by movie and country so rapid switches cannot display a previous movie's link under the new label. The focused frontend suite exercises storage fallback, request races, invalid/missing/stale URLs, logo fallback, keyboard and theme behavior. The lesson from this run is that green source CI cannot establish a public release: checking the deployed DTO and migration exposed a version gap immediately. The plan is to deploy the reviewed source, verify its exact Render SHA/schema, then repeat the public UI/data checks.

## Twelve-minute rehearsal card (not yet rehearsed)

| Time | Speaker slot and action |
| --- | --- |
| 0:00–1:00 | Member 1: candidate SHA, two M3/current comparisons, owned PR/test/rule. |
| 1:00–6:00 | Member 2: Home → six P0 journeys, actionable refusal, account A/B persistence; explain owned PR/test/rule. |
| 6:00–8:00 | Member 3: US/GB/SG selector, exact TMDb movie/country link, missing/stale fallback and original-tab context; owned PR/test/rule. |
| 8:00–10:00 | Member 4: PostgreSQL 18, health/source identity, T06 restart/recovery and focused red/green; owned PR/test/rule. |
| 10:00–12:00 | Member 5: design choice, lesson, remaining risk/plan and PO decision; owned PR/test/rule. |

Assign the five real members and their actual merged PRs before rehearsal. The speaking plan has **not** been timed with the team.

## Required before acceptance/PR closure

- Deploy the reviewed candidate to the supplied public origin and obtain the actual Render deployed SHA. Confirm it matches a green reviewed source, `/health` migration is at the current head, and imported regional records are present. Recheck all US/GB/SG Details DTOs, exact movie/country URLs, groups, nullable/no-data/stale/invalid cases and new-tab/original-tab behavior against genuine data plus labelled deterministic fixtures.
- Run all six P0 journeys from Home in a private laptop browser **and physical phone**, including real account persistence, an actionable server refusal, Search/Similar, ratings, Watchlist/reset, media, themes, pagination and responsive navigation. Reproduce affected T03/T06 recovery checks on the deployed candidate. Record devices, browsers, timestamps and source identity.
- Rehearse the five speaking sections with all members, collect actual PO acceptance and an eligible independent substantive review. Record the instructor-selected P0 mapping and actual results. No approval, deployment identity or rehearsal is inferred from this preparation.
