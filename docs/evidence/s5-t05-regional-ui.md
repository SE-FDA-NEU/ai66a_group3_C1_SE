# S5-T05 regional providers UI — implementation evidence

Issue [#252](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/252)
(Details regional-provider UI, amended 10 November 2026). Built on `main`
at `7a198ff` (T04 merged). No commit, PR, review or merge is recorded here:
those remain pending and must not be inferred from this file.

## What changed

- `getMovie(movieId, country, signal?)` requests
  `GET /api/movies/{id}?country=<US|GB|SG>`.
- `watchCountry.ts`: the three supported countries, default US, guarded
  `localStorage` persistence (`cineai-watch-country`, corrupt/blocked → US),
  logo URL check and a client-side watch-link check that mirrors the T04
  contract (HTTPS, TMDb host, `/movie/<id>[-slug]/watch`, single matching
  `locale`, no credentials/fragment/extra parameters).
- `MovieWatchProviders.tsx`: compact labelled country `<select>` inside the
  Where-to-watch section, `Where to watch in <country>` heading, Stream/Rent/
  Buy/Free/With ads groups, readable names when a logo is missing/broken,
  neutral not_checked/no_data/error messages, stale warning with last-checked
  date, retryable load failure, TMDb/JustWatch attribution and market-context
  note, and the single `View watch options on TMDb ↗` anchor
  (`target="_blank"`, `rel="noopener noreferrer"`, described as opening in a
  new tab) only for a valid link.
- Results are keyed by country within a movie (the component is keyed by movie
  ID). A superseded request is aborted and ignored, a response whose
  `providers.country` differs from the request is rejected, and the previous
  region's badges/link are not shown while another country loads.
- `MovieDetailPage` seeds the section from its own country-aware load; rating,
  Watchlist, trailer, backdrop, Similar and return-context code is untouched.

## Verification actually run (Windows, Node via npm, this worktree)

| Check | Result |
| --- | --- |
| `npx vitest run` (all frontend suites) | 42 files, 507 tests passed (467 before; 40 new in `movie-watch-providers.test.tsx`) |
| `npx tsc -b`, `npx eslint .`, `npm run build` | Passed |
| Existing detail tests | URL mocks updated to `?country=US`; no behaviour assertions weakened |

The new tests cover default US, persisted GB/SG, corrupt/blocked storage,
saving a choice, loading state clearing the old region, rapid US→GB→SG with a
late response, region mismatch rejection, failure and Retry, movie switch with a
pending request, exact link label/href/target/rel, null and six invalid links,
link-only, badges-only, not_checked/error/no_data, missing provider fields,
stale, group order, logo validation/broken logo, long names and the URL helper.

## Runtime check

The real FastAPI application ran against a migrated temporary SQLite database
with **synthetic** regional rows (honestly labelled fixtures; no live TMDb
data, no Neon) behind the Vite dev proxy, viewed in the in-app browser:

- US shows all five groups, a validated link and the long provider name wrapped;
  GB shows a badge with no link; SG (`no_data`, valid link) shows the neutral
  message plus the action; movie B showed `error` (SG, no link) and `stale`
  (US, warning, badges and link).
- Selecting SG persisted `SG`; a reload and a second movie reused it. Five
  rapid switches ended on the last selection with matching heading and link.
- At 375px width there was no horizontal overflow and the action filled the row.

Not covered: real imported Neon data in the UI, light-theme/tablet screenshots,
Playwright acceptance specs, public deployment, and the independent review
required before merge.
