# S4-T01 UI and poster handoff — reconciled with merged C03

Refs [#195](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/195).
Built early with PO authorization on 2026-10-24 against main
`3078a9c6fd3dff1f0b8576bc7411f469c7a98fdf`. C03
[#217](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/217) subsequently
merged through PR #222 at main `37c2f66`. This candidate incorporates that main
and reconciles the approved contract without rewriting the original T01 commits.
**Independent final-diff review and required CI remain merge conditions.**

## Delivered scope and preserved boundaries

Existing React/TypeScript Home, Popular, register/sign-in, Preferences,
Recommendations, details and the exact three-step explanation share a compact
cinematic violet style inspired by the supplied CineAI ZIP. No ZIP scripts,
mock statistics, hard-coded movie artwork or fake success actions are copied.
Home defaults to A–Z and offers the PO-authorized Z–A title sort; Popular remains finite popularity descending with existing
tie-breakers; recommendations keep the current algorithm. Filtering still
applies to the whole result set before pagination. Existing request-generation,
account/movie guards and safe detail-return context are retained.

No live Search/Similar/Profile/Watchlist/trailer/provider functionality is added
here, and no dead navigation link advertises it. Owners #205/#203/#208/#207/#215
integrate those features later using this UI. #199 owns rating-based ranking
and score explanations; T01 does not change the rating API or ranking formula.

## Reusable frontend contract

### PO-authorized Home/navigation amendment (2026-10-24)

The Home hero replaces the old visible "Choose Start to pick up to 5 favourite
genres" paragraph with compact discovery copy and Start / Explore Catalogue
actions. The latter is a local, keyboard-focusable catalogue anchor, not a new
sort, TMDb request or separate recommendation shelf. The later title-sort amendment
below adds a separate labelled selector. Home keeps deterministic title/ID order
and its existing page totals/revision/detail-return semantics.

My recommendations is one persistent active-state link in the shared navbar,
visible to guests and members. The account region does not duplicate it. Guest,
checking, authenticated, error/retry and sign-out states retain the backend
session as their authority. No unfinished Search/Profile/Watchlist feature is
advertised by a non-functional link.

Default sign-in from Home or direct /login lands on Home. Authentication alone
does not fetch, select or save personalisation. Explicit Start/Preferences
opens the real picker; a guest signs in first and returns to /preferences.
Explicit My recommendations returns to /recommendations; an account without
genres retains the existing Popular / Not personalised guidance, without
forcing the picker. Saving valid genres still waits for the real successful
server response before opening recommendations.

RequireAuth carries only an explicit internal destination in router state.
Sign-in and registration preserve that intent, including safe page/filter/hash,
without carrying old-account result/cache state. The allowlist is the existing
protected routes (/preferences, /recommendations, /profile); external, malformed,
auth-loop or absent destinations fall back to Home. This is a navigation hint,
never authentication or permission to read another account's data.

The picker retains dynamic catalogue-backed checkboxes, restored account
selections, its 1–5 limit/counter, validation, pending/retry and request identity.
Styling follows the ZIP's violet card/chip treatment, not hard-coded genres,
invented AI percentages or pixel-identical copied HTML/scripts.

This authorized amendment supersedes the old unconditional sign-in landing in
S13; it does not change password/session APIs or S01's Start label. The live
Story #45 currently contains both the new Home AC and old unconditional
/recommendations AC. PO must replace the obsolete AC (not retain contradictory
checked claims) before T01 merge. The local C03 and T01 requirements now agree.
Historical M3 submissions,
screenshots/diagrams and evidence retain their original tested scope rather
than being rewritten as newly executed Sprint 4 evidence.

| Component / file | Consumer responsibility and invariant |
|---|---|
| `AppFrame` | Shared brand/navigation/session UI, skip link and footer. Session writes remain in AuthProvider. Public lists restore the session; existing protected/rating boundaries retain ownership of initial checks. Static explanation starts no API request. No second header per page. |
| `AppFrame` S4-T10 extension | One active-state `Search` link points to public `/search`. `SearchPage` reuses `MovieGrid`/`MovieCard`, `MoviePoster`, semantic theme tokens, shared button/status styles and safe detail-return context. The labelled search form supports Enter and its native Search submit button. |
| `AppFrame` S4-T12 extension | One `My watchlist` link in the existing main navigation points to protected `/watchlist`. Detail mounts the account-scoped watchlist action beside the existing rating widget. `MoviePoster`, `PageControls`, `useFeedback`, theme tokens and safe detail-return state are reused. No new theme, notification, rating or navigation system is introduced. |
| `AppFrame` S4-T13 extension | A signed-in `Profile` link uses the existing protected `/profile` registry entry. `ProfilePage` reuses `ConfirmDialog`, button links, semantic theme tokens and `useFeedback`. It displays its API summary and distinguishes confirmed reset, documented rejection and unconfirmed response/reconciliation. Shared post-reset invalidation remains T14; no new auth/cache/theme/notification store is introduced. |
| S4-T14 reset invalidation | A validated committed reset discards the current Profile summary, calls the account-guarded `invalidatePersonalisationAfterReset` helper, then rereads Profile through its existing client. The helper advances the shared recommendation generation and rotates its navigation scope. Preferences and per-movie ratings are route-local, abort on unmount and refetch through their existing clients when reopened. Rejection, cancellation and ambiguous responses do not invalidate early. Auth and watchlist state stay intact. |
| `SimilarMovies` (S4-T08) | `{movieId,returnTo,returnContext?}`; one active public read of `/api/movies/{id}/similar` per movie and retry. Keyed by movie and aborted on change; late completions are ignored. Renders `MovieGrid`/`MovieCard`, so poster fallback, tokens and the 5/4/3/2-column layout are reused. Never reads account, rating or watchlist state. Loading, empty and error/Retry stay inside its own section; the source details are never hidden. |
| `ThemeProvider` / `ThemeToggle` | Dark default; only `dark`/`light`; local key `cineai-theme`. Inline pre-paint bootstrap and provider use the same key. Blocked/corrupt storage is safe. Toggling changes tokens, never keys/remounts, auth, URL, draft, filter or page. |
| `MoviePoster` | `{movieId,title,posterUrl?,eager?}`; strict w500 HTTPS CDN URL only; width/height 500/750 and fixed 2:3 region; lazy list images, eager detail poster; labelled missing/error fallback; failure state resets on movie or URL change. |
| `StarRating` | Controlled half-step `RatingValue|null` (0.5–5); five visual stars with ten native labelled radios, Arrow/Space/touch; left half/midpoint selects the half step, right end the whole step; selection/hover/focus never writes. Consumer owns explicit Save, pending/error/retry and committed value. Existing `MovieRating` keeps account/movie isolation. |
| `ConfirmDialog` | Consumer controls `open`, pending and real mutation. Label/description, focus trap, initial safe Cancel focus, Escape cancel when idle, restore trigger. Pending blocks duplicate/cancel actions. No reset API is wired by T01. |
| `ExternalTrailerLink` | Example primitive only: validated YouTube watch URL or unavailable text; new tab with noopener/noreferrer; no iframe/autoplay/fake player. #215 owns real backend selection and live integration. |
| `ProviderBadges` | Example primitive only: deduplicated non-clickable provider names. Future provider task owns region, missing data and JustWatch attribution before mounting it. |

The new header keeps existing product naming within the page copy; CineAI is a
visual wordmark, not a claim about new AI capabilities. `TMDb popularity`, saved
`Your rating`, and future `Ranking score for you` must remain distinct. Only
existing real data appears. Unrated is null; there is no score 0. The PO-authorized T16 amendment adds half-star input.

## Design tokens and accessibility

`index.css` owns semantic `--page-bg`, `--surface`, `--surface-raised`, `--text`,
`--muted`, `--border`, `--control-border`, `--accent`, `--primary`, `--focus`, `--error`, `--success`
and `--star` tokens in both themes. New feature UIs should reuse these variables
and common card/action/status/dialog classes instead of fixed dark-only colors.
System font fallbacks work offline; no new external font dependency is required.

Poster grid adapts to 375px/tablet/desktop, header/actions wrap, title text wraps,
minimum action targets are 44px, visual stars 48px with approximately 24x48px half targets. Keyboard focus is visible;
errors have readable text, not color alone. Reduced-motion disables transitions.
Backdrop retains its dark overlay even in light theme so its title stays legible.
Browser and unit evidence is linked below; these checks are not a full WCAG
certification or a substitute for the final C04 accessibility audit.

## Poster persistence / reconciled API

Migration `d8a4e6f20195` follows `c6f8a2d4e901`; adds only nullable Text
`catalog_movies.poster_path`, no binary media. Fresh and populated upgrades are
tested. Never run a downgrade against valuable data just to try this branch.
Rebase the migration parent against the actual merged head before merge if
other owners add migrations concurrently. Future watchlist/NLP data stays owned
by its tasks; this migration must not recreate their tables or reset accounts.

Summaries, recommendations and detail responses add nullable `posterUrl`.
Backend builds `https://image.tmdb.org/t/p/w500/<filename>` from a validated flat
path (1–128 alphanumeric/underscore/hyphen characters + jpg/jpeg/png/webp).
Frontend validates the same allowlist. Backdrops retain the w780 allowlist;
the later T16 carousel amendment below also exposes them on movie summaries.
No token, source/provider ID or raw path is added to the browser DTO.

Normal bounded TMDb imports retain the available poster field without adding
one details call per card. `--enrich-posters --limit 300` is a separate bounded,
atomic media-only pass for the current active TMDb catalogue. It preserves its
revision, IDs, overview, popularity, genres, backdrops, preferences and ratings.
Missing/invalid poster fields retain the old value; explicit null clears it;
provider failure rolls back all writes. Repeating a small limit processes the
same sorted prefix, not an implicit next page. Runtime API reads are local-only;
the browser can fetch public image bytes, not TMDb metadata.

Poster-only changes do not change NLP corpus/config/revision inputs. T01 does
not implement or certify the future index invalidation system (#201/C03).
CDN failure is local image fallback, not catalogue failure.

## Reconciliation and review checklist

- [x] C03 #217 merged; compare DTO nullability/size, theme key, header ownership,
  radio save semantics, common components and future feature boundaries.
- [x] Merged C03 adds no migration; the single T01 head is `d8a4e6f20195`,
  following `c6f8a2d4e901`. Fresh/populated upgrade tests cover this chain.
- Future C05 root `tests/` / default-pytest M4 infrastructure remains owned by
  #219 and is not a new T01 dependency. Current
  backend suite plus browser/unit tests are not proof of all six P0 M4 cases or
  per-member authored-pytest requirements.
- [ ] If a future Content-Security-Policy disallows inline scripts, include an
  approved hash/nonce for the pre-paint theme bootstrap; do not silently break it.
- [ ] Independent final-diff review by Hoàng / another non-author using GitHub
  Review changes, with substantive feedback, then rerun CI.
- [ ] Only after reconciliation/review may PO decide this issue is merge-ready.

Commands and actual local results: [T01 evidence](evidence/s4-t01-ui.md).

## Post-merge onboarding/discovery polish

### PO-authorized action buttons and Home title sort (2026-10-24)

Navigation CTAs use `button-link button-secondary` (including the shared
MovieCard View details, detail returns, preferences/recommendation actions and
auth cross-links). They remain semantic links with unchanged labels, routes,
safe return state and native open-in-new-tab behaviour. Footer attribution
links are not globally converted into buttons. Shared hover/focus, both themes,
wrapping and a minimum 44px touch target apply.

Home alone gains a labelled Sort by title control: A–Z by default or Z–A.
The API allowlists `title_asc`/`title_desc`, sorts all active rows before
paging and keeps the ID ascending for exact-title ties. Omitted sort preserves
the previous API request. Popular and recommendation ranking are unchanged.
Sort is URL-backed, resets page 1 on change, remains part of request identity,
and survives pagination/reload/retry/revision recovery/details return.
Page controls retain the current hash. No migration or TMDb import is needed.

This later amendment extends the presentation-only follow-up described below.
New checks are recorded separately in
[button/title-sort evidence](evidence/s4-t01-buttons-title-sort.md).

The follow-up after PR #220 reuses these contracts: two-column auth presentation,
genre descriptions/cards, a real-poster Home hero and an initial Popular page-one
#1 spotlight (superseded by the T16 carousel below). That earlier change altered
no API DTO, database schema, ranking, result totals or genre
selection rule. Featured details use the existing list-return state. Decorative
auth artwork is CSS, not a screenshot of another app or a new remote dependency.

`ActionFeedback` / `useFeedback` provide shared, centered, non-modal notifications.
Use `announce` for a new action, then `update` its returned ID only after the real
result. Stale IDs cannot overwrite newer actions; component cleanup dismisses
only its own pending ID. Keep detailed errors inline, preserve drafts and never
declare server success from a timer or local toggle. Do not add feedback state
to auth authority, API query keys or ranking inputs.

Actual checks, screenshots and review limits:
[onboarding/discovery follow-up evidence](evidence/s4-t01-onboarding-polish.md).

## S4-T10 Search integration and keyboard submit (2026-10-27)

The delivered T10 extension adds public `/search` to the existing shell and
safe detail-return allowlist. The URL-backed `q` survives reload and details
return along with unrelated query parameters and the fragment. Existing session
restoration does not require sign-in or add private account reads to Search.

Typing edits a local draft only. A native labelled search form submits
with Enter or the Search button without a document reload. A new query
updates the URL and resets page 1; resubmitting the same query retries the
current page. Both paths trim the query and require at least two Unicode characters.
Short queries show `Enter at least 2 characters` and issue no search request.
Tab reaches Search after the input, then the result links; Shift+Tab reverses
that order. Focus remains on the submitted control.

Search retains the server's global order and all matches across pages, with distinct loading,
empty, error and Retry states. Every new read, including explicit submit, aborts
the previous one and ignores late success/error completions. It reuses the
existing poster fallback, responsive grid and light/dark tokens. Inline status
and alerts report search reads; no additional feedback or theme store is added.
See [T10 acceptance and keyboard follow-up](evidence/s4-t10-search/README.md).

## S4-T08 Similar movies integration (2026-10-27)

The details page mounts `SimilarMovies` below the existing body, after the
rating and watchlist widgets, in its own `Similar movies` section. It keeps one
active public read for the current movie and shows loading, up to five distinct cards
in the server's order, `No similar movies are available`, or an inline alert
with `Retry similar movies`. The source movie, rating and watchlist are not
hidden, delayed or coupled to this read in any state.

Each card is the shared `MovieCard` link to `/movies/<selected id>`. It carries
the details page's already validated return destination and list context, so
the return link on the selected movie still reads `Back to search`,
`Back to recommendations` and so on, and an unsafe or absent destination falls
back to the catalogue. Saved genres and ratings are never read or written. See
[T08 acceptance and evidence](evidence/s4-t08-similar-ui/README.md).

In development React StrictMode may start and abort a duplicate request during
effect setup/cleanup. The T01 browser gate matches the exact Similar movie
endpoint and a test request tag, accepts those duplicate or cancelled attempts,
and releases every held response in cleanup. It still checks visible loading,
source details, server order, selected-ID navigation and stale-response safety.
The Windows fixture runner owns its server processes and removes only its own
temporary SQLite database after the browser command exits. See the
[T14 gate correction evidence](evidence/s4-t14-reset-invalidation.md#browser-gate-correction-and-final-local-checks-uncommitted).

## S4-T16 detail-return and request boundaries (2026-10-27)

Current S03 return semantics are page/query/sort/filter/fragment preservation
when the source context remains valid. A new catalogue revision returns public
lists to page 1 (keeping Home's chosen title sort); Recommendations also clears
its stale `genreId`, preserving unrelated source/query/fragment values. A
changed account or preference scope discards the old recommendation context.
A historical Watchlist context belonging to another account is replaced with
that account's page 1 before its private list request; the old page/revision
is not sent under the new account.

Rating saves retain valid same-account navigation context but refresh the
ranking only after a confirmed response. Membership changes never change the
ranking. Details, rating, watchlist and Similar have independent read/error
states; a membership service error leaves the source and other widgets usable.
Late reads/writes must not populate a new movie/account, announce stale success,
invalidate its ranking, or redirect it on an old 401. Watchlist removal reconciles
actual totals and the remaining valid page, keeping a safe return destination.
The existing shared buttons/themes and keyboard behaviour remain unchanged.

The concurrency follow-up keeps SQLite membership writes in a synchronous
FastAPI worker handler, with raw-body presence read by a separate async
dependency after account authentication. A waiting COMMIT therefore cannot
block the ASGI loop needed to close another list read snapshot. Wire payload,
auth-before-validation, reservation/commit/rollback and UI acknowledgement
semantics are unchanged; no retries or timeout increases hide a failed write.

See [T16 execution and review handoff](evidence/s4-t16-detail-boundaries.md).

## T16 submit-only Search amendment

Keep typed Search drafts local. Enter/Search commits `q`; valid deep links,
Back and detail-return restore that submitted query. Reuse current components,
themes, feedback and API ordering. Rating half steps retain explicit Save and
account/movie request boundaries; do not introduce a second feedback system.

## S4-T16 full-result Search paging

Reuse `PageControls`, `resultSummary` and the safe list-view context with
route `/search`. Keep `q`, page, unrelated query parameters and hash on details
return. Read metadata from the actual API; never invent a total of ten.
Catalogue revision changes reset page 1; do not mix two snapshots. Both title
and description modes rank/select globally before pagination. No new auth,
theme, request-generation or feedback store is introduced.

## S4-T16 Popular carousel and collection headings (2026-10-27)

`CollectionHeading` gives Popular, Search and My watchlist a compact icon,
single h1, short description and existing action. It uses current theme tokens
and keeps the existing page routes, Search submit-only behavior, list totals
and account protections. Home and Recommendations retain their existing layout.

On every nonempty Popular page, `PopularSpotlight` presents the first three
movies supplied by that page's API response, or fewer on the last page. The
badge is the catalogue rank `(page - 1) * limit + slide + 1`; the counter is
the local slide position, e.g. rank #12 and `2 / 3` on page 2. Never call the
page's first entry the catalogue's #1. Keep all entries in the grid below.

Previous/Next arrows are visibly centered on the left/right edges (48px desktop,
44px mobile). Dots and ArrowLeft/ArrowRight also select slides, wrapping at both
ends. There is no autoplay. A single entry hides unnecessary controls. The
current slide uses the existing safe history state `featuredMovieId`, so app
return and browser Back restore it without adding a history entry per click.
Changing pages selects that page's first movie; stale IDs safely select first.

Use the validated summary `backdropUrl`, never an unrelated poster as a backdrop.
Missing, unsafe or failed images leave the theme-safe gradient and readable
title/actions. Poster failure keeps the existing poster fallback. Selection
does not refetch metadata, modify ranking, save preferences or write account
data. No migration, catalogue import or NLP rebuild is required.

See [execution, real captures and review handoff](evidence/s4-t16-spotlight.md).

## T14/T16 integration (2026-10-28)

Keep T14's committed-reset invalidation, Profile refresh, account guard and
Windows server ownership together with every T16 consumer amendment above.
The isolated test gate has one matcher: `{method, path, requestTag?}`. It
supports exact detail/rating/membership reads and membership writes as well
as Search, Similar and Recommendations. Request tags isolate browser requests
from API oracles; cancelled StrictMode requests are counted and drained before
cleanup. T16 helpers observe `pending`, not the superseded `active` field.
Search test actions explicitly submit; the UI still sends nothing on typing.

The original T14 runner/configuration is retained, including external-server
ownership on Windows and verified removal of its own temporary database.
Linux browser acceptance jobs pin Ubuntu 24.04 after the previous floating
runner exceeded its installation budget. Assertions, test deadlines, retries
and skips are unchanged. Current merged-candidate results are in the
[integration evidence](evidence/s4-t16-t14-reconciliation.md).

## S4-T20 official trailer detail integration (2026-10-31)

`MovieTrailer` appears between Overview and the existing rating/watchlist
widgets. It accepts only the local detail response's official YouTube Trailer
with an 11-character key and a matching canonical HTTPS watch URL. A missing,
null, invalid, mismatched or unofficial selection shows `Trailer unavailable`
and no actionable link. The shared `ExternalTrailerLink` provides one keyboard
focusable `Watch trailer` link with `target="_blank"`,
`rel="noopener noreferrer"` and an accessible new-tab explanation. There is no
iframe or playback request in the app.

The media panel uses existing theme variables and button styles and wraps at
mobile widths. The existing detail response guard removes the prior movie's
panel while another ID loads, and ignores late responses. Backdrop image
validation, failure fallback and rating/Similar/return controls are unchanged.
No backend, migration, account or ranking interface changes are needed beyond
the merged S4-T19 trailer DTO. See [T20 implementation and verification](evidence/s4-t20/README.md).

The T20 acceptance command uses the shared S04 server/temporary-DB lifecycle.
Its API responses are generated by production routes from migrated SQLite.
Successful offline backdrop artwork and a separate 404 fixture prove all four
media combinations, while response gates exercise real pending/stale replies.
Browser selection follows SETUP's Playwright default with optional channel or
executable overrides. Screenshots normally stay under ignored test-results;
published captures are explicitly regenerated. The dedicated T20 CI job runs
this browser suite and the existing T01 regression, preserving the core UI.
