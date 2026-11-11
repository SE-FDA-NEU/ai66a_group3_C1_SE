# S5-T05 regional-provider UI verification

Issue [#252](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/252),
PR [#263](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/263).
Verified on **11 November 2026**, Asia/Saigon. UI source is
`3ee9d76335689ad5247f0d644722dc5be96b4a96`, extending original candidate
`ebdf3411bb1f1a42a2fd66ddfba9fb294309a25e` and main `7a198ff`.
The verification used Windows, Node 24, a production frontend build served by
FastAPI locally, and the restricted `cineai_runtime` role against the existing
Neon `cineai_development` catalogue. Execution was Codex automation in the
PO-authorized environment. Final independent teammate review remains pending.
[Structured results and screenshot hashes](s5-t05-regional-ui/verification.json)

## Implementation

Details requests the selected US/GB/SG market through T04's API. US is the
default. A compact accessible selector stores valid choices under
`cineai-watch-country`, restores them on reload/another movie, and falls back
to US for invalid or blocked storage. Cached UI/request state is scoped to
movie and country. Superseded responses are ignored and a different returned
country is rejected.

The section displays Stream/Rent/Buy/Free/With ads groups, readable provider
names with optional logos, independent check/freshness states, market-context
wording and visible TMDb/JustWatch attribution. The single validated TMDb
watch-options anchor has the required label, new-tab hint, target and rel.
Badges-only, link-only and empty responses follow the independent group/link
contract.

A stale warning now appears for **every stale result**, including a prior
empty snapshot with either a valid retained link or a null link. It includes
the last successful date when supplied. Two regression cases failed before
this correction and pass afterward. Existing trailer, half-star rating,
Watchlist, session and detail-return protections are covered by affected tests.

## Automated verification

```powershell
npm.cmd --prefix frontend test -- src/tests/movie-watch-providers.test.tsx src/tests/movie-detail-acceptance.test.tsx src/tests/movie-detail-rating.test.tsx src/tests/movie-detail-return.test.tsx src/tests/movie-backdrop.test.tsx src/tests/auth-catalogue-handoff.test.tsx src/tests/movie-trailer.test.tsx src/tests/watchlist.test.tsx src/tests/list-context-invalidation.test.tsx
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run build
```

| Check | Actual result |
| --- | --- |
| Provider suite, including empty stale link/null cases | 42 cases pass |
| All selected affected suites | 9 files, 128 cases pass |
| ESLint | Pass |
| TypeScript and production build | Pass |
| Empty stale regressions before the correction | 2 fail |

CI runs the focused 42-case regional-provider suite in the frontend job.
The tests cover storage/defaults, loading, country and movie request races,
region mismatch, retry, exact link attributes, group/link combinations,
not-checked/error/no-data/stale states, logo failure, long names and affected
media/account/navigation behavior.

## Genuine stored Neon data in the browser

The review used a new headless Chromium context and the real same-origin
backend at a loopback-only address. Health was 200 at schema
`d9a6f2c1e508`, with active revision
`1ee08003-bc00-4888-b35c-8c6cbe599062` and **989 imported movies**.
Runtime TMDb metadata networking was disabled on the review backend.

Two imported movie IDs were exercised. `(500) Days of Summer`
(`2626f71e-8458-491c-a1f4-c2017d8f684b`) supplied real data for all three
countries. `0.0MHz` (`311ba592-b894-4a79-be34-186d6cb03a0d`) supplied the
representative genuine SG no-data/null-link state. Provider names, membership
counts and selected-country watch URLs were compared with the actual API.

- Default US, US → GB → SG, reload persistence and another movie with persisted
  SG all passed. A corrupt stored VN value fell back to US.
- Genuine SG no-data displayed the neutral message and omitted the action.
- Keyboard country selection, focus and Enter activation passed. The TMDb
  destination URL opened in a new tab and the original detail route remained.
- The external page body was replaced by controlled HTML during the navigation
  probe. The assertion verifies the destination/new-tab behavior.
- Both themes at 375px, 768px and 1280px had no horizontal document overflow.
  Screenshots below capture the real GB provider groups and their attribution.

| Viewport | Dark | Light |
| --- | --- | --- |
| 375px | [Screenshot](s5-t05-regional-ui/providers-375-dark.png) | [Screenshot](s5-t05-regional-ui/providers-375-light.png) |
| 768px | [Screenshot](s5-t05-regional-ui/providers-768-dark.png) | [Screenshot](s5-t05-regional-ui/providers-768-light.png) |
| 1280px | [Screenshot](s5-t05-regional-ui/providers-1280-dark.png) | [Screenshot](s5-t05-regional-ui/providers-1280-light.png) |

## Explicit synthetic fallback evidence

The browser then overlaid two controlled API responses for an empty stale
snapshot. The original movie identity and GB selection remained, with either
the valid GB link or null. Both displayed the stale warning and last successful
date with zero badges. These overlays affected browser responses only.

[Stale empty snapshot with link](s5-t05-regional-ui/stale-empty-with-link.png),
[stale empty snapshot with null link](s5-t05-regional-ui/stale-empty-no-link.png)

Other deterministic missing/logo/error/race states are covered by the focused
UI suite. The original implementation record's SQLite fixture exercise remains
historical evidence at commit `ebdf341`; the current genuine runtime results
above were obtained from stored Neon data.

## Operator command and completion

After loading the confirmed operator database, token and TLS settings, use
T04's whole-catalogue command when provider enrichment is needed.

```powershell
.\.venv\Scripts\python.exe -m app.cli.import_tmdb_catalogue --enrich-providers --all --countries US GB SG --limit 300
```

`--limit 300` is the committed movie-batch size. The UI verification reused the
existing imported snapshot. Provider import and rollout ordering are documented
in the [T04 operator contract](../api.md#14-s5-t04-regional-providers-and-tmdb-watch-options-251).

The remaining issue steps are a substantive formal review and approval from a
non-contributing teammate, then protected-main merge. The reviewer should
inspect the current source, real/synthetic evidence and CI results. T07 owns
subsequent public-product acceptance after deployment.
