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
| `SimilarMovies` (S4-T08) | `{movieId,returnTo,returnContext?}`; one public read of `/api/movies/{id}/similar` per movie and retry. Keyed by movie and aborted on change; late completions are ignored. Renders `MovieGrid`/`MovieCard`, so poster fallback, tokens and the 5/4/3/2-column layout are reused. Never reads account, rating or watchlist state. Loading, empty and error/Retry stay inside its own section; the source details are never hidden. |
| `ThemeProvider` / `ThemeToggle` | Dark default; only `dark`/`light`; local key `cineai-theme`. Inline pre-paint bootstrap and provider use the same key. Blocked/corrupt storage is safe. Toggling changes tokens, never keys/remounts, auth, URL, draft, filter or page. |
| `MoviePoster` | `{movieId,title,posterUrl?,eager?}`; strict w500 HTTPS CDN URL only; width/height 500/750 and fixed 2:3 region; lazy list images, eager detail poster; labelled missing/error fallback; failure state resets on movie or URL change. |
| `StarRating` | Controlled integer `RatingValue|null`; five native labelled radios, Arrow/Space/touch; selection/hover/focus never writes. Consumer owns explicit Save, pending/error/retry and committed value. Existing `MovieRating` keeps account/movie isolation. |
| `ConfirmDialog` | Consumer controls `open`, pending and real mutation. Label/description, focus trap, initial safe Cancel focus, Escape cancel when idle, restore trigger. Pending blocks duplicate/cancel actions. No reset API is wired by T01. |
| `ExternalTrailerLink` | Example primitive only: validated YouTube watch URL or unavailable text; new tab with noopener/noreferrer; no iframe/autoplay/fake player. #215 owns real backend selection and live integration. |
| `ProviderBadges` | Example primitive only: deduplicated non-clickable provider names. Future provider task owns region, missing data and JustWatch attribution before mounting it. |

The new header keeps existing product naming within the page copy; CineAI is a
visual wordmark, not a claim about new AI capabilities. `TMDb popularity`, saved
`Your rating`, and future `Ranking score for you` must remain distinct. Only
existing real data appears. There is no score 0 or half-star input.

## Design tokens and accessibility

`index.css` owns semantic `--page-bg`, `--surface`, `--surface-raised`, `--text`,
`--muted`, `--border`, `--control-border`, `--accent`, `--primary`, `--focus`, `--error`, `--success`
and `--star` tokens in both themes. New feature UIs should reuse these variables
and common card/action/status/dialog classes instead of fixed dark-only colors.
System font fallbacks work offline; no new external font dependency is required.

Poster grid adapts to 375px/tablet/desktop, header/actions wrap, title text wraps,
minimum action targets are 44px, star targets 48px. Keyboard focus is visible;
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
Frontend validates the same allowlist. Existing backdrop remains w780/detail-only.
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
genre descriptions/cards, a real-poster Home hero and a Popular page-one #1
spotlight. It changes no API DTO, database schema, ranking, result totals or genre
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

Results update as the user types. A native labelled search form also submits
the current query with Enter in the input or the Search button; submission
prevents a document reload and repeats the current read without changing the
URL. Both paths trim the query and require at least two Unicode characters.
Short queries show `Enter at least 2 characters` and issue no search request.
Tab reaches Search after the input, then the result links; Shift+Tab reverses
that order. Focus remains on the submitted control.

Search retains the server's order and first ten movies, with distinct loading,
empty, error and Retry states. Every new read, including explicit submit, aborts
the previous one and ignores late success/error completions. It reuses the
existing poster fallback, responsive grid and light/dark tokens. Inline status
and alerts report search reads; no additional feedback or theme store is added.
See [T10 acceptance and keyboard follow-up](evidence/s4-t10-search/README.md).

## S4-T08 Similar movies integration (2026-10-27)

The details page mounts `SimilarMovies` below the existing body, after the
rating and watchlist widgets, in its own `Similar movies` section. It issues one
public read for the current movie and shows loading, up to five distinct cards
in the server's order, `No similar movies are available`, or an inline alert
with `Retry similar movies`. The source movie, rating and watchlist are not
hidden, delayed or coupled to this read in any state.

Each card is the shared `MovieCard` link to `/movies/<selected id>`. It carries
the details page's already validated return destination and list context, so
the return link on the selected movie still reads `Back to search`,
`Back to recommendations` and so on, and an unsafe or absent destination falls
back to the catalogue. Saved genres and ratings are never read or written. See
[T08 acceptance and evidence](evidence/s4-t08-similar-ui/README.md).
