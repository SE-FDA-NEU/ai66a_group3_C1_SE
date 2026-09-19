# Spike result: movie data and initial recommendation approach

- Related issue: [#16](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/16)
- Owner: @kietxuan
- Timebox: 4 hours
- Status: authenticated smoke test completed; teammate review required before the issue is closed
- Scope: choose a catalogue source and a deterministic MVP recommendation
  approach. This Spike does not implement the application.

## Question

Which movie data source provides the movie ID, title, genres, summary, and
rating-related fields required by the product? Is that source suitable for the
cold-start flow and the rules for matching, popularity, ratings, similar
movies, and title search?

## Decision

Use **TMDb API** as the external movie-catalogue provider for the MVP. Keep a
small **synthetic local fixture** for automated tests. Store a viewer's 1--5
movie rating in this application; do not treat TMDb's aggregate vote values as
that viewer's rating.

MovieLens is useful as a possible later research or offline-evaluation data
set, but it is not the primary MVP catalogue. Its core files provide movie
titles, genres, historical ratings, and links to TMDb/IMDb, but not a complete
movie overview or a product popularity field suited to the current screens.

## Decision criteria

| Criterion | Why it matters | TMDb API | MovieLens latest-small | Decision |
|---|---|---|---|---|
| Stable movie identifier | Opens the correct details page and prevents duplicate records | Movie ID is available from movie-list and detail responses | `movieId` is available | Both pass |
| Title and genre data | Supports preference matching, filtering, similar movies, and search | Title plus genre IDs/list are available | Title and pipe-separated genres are available | Both pass |
| Summary/overview | Required for S03's essential movie details | Movie detail data includes an overview | Not supplied as a core movie field | TMDb passes |
| Popularity ordering | Supports cold start and popular browsing | Popular-movie endpoint is ordered by popularity | Historical ratings are not a live popularity contract | TMDb passes |
| Search by title | Supports S08 | Movie search endpoint searches movie titles | Would need an in-application search over a downloaded file | TMDb is simpler |
| Rating use | Separates an external aggregate from the viewer's own feedback | Provides aggregate `vote_average`/`vote_count`; personal rating stays local | Provides historical anonymous ratings, not this viewer's rating | Keep personal ratings local |
| M1/MVP complexity | Keeps implementation and explanation small | One provider and documented endpoints | Requires file import and, for summaries, a second source/join | TMDb passes |
| Operational constraints | Must be safe and lawful | Private credential, terms, and attribution required | Dataset terms must be reviewed before use or redistribution | Record both constraints |

## Evidence reviewed

The decision is based on the official documentation below. The authenticated
test records only non-sensitive response facts; the team API credential is not
recorded in this repository.

| Evidence | Finding used in this Spike |
|---|---|
| [TMDb getting started](https://developer.themoviedb.org/docs/getting-started) | An API credential and acceptance of TMDb terms are required. |
| [TMDb movie genres](https://developer.themoviedb.org/reference/genre-movie-list) | Provides the official movie-genre list used to map genre IDs to names. |
| [TMDb popular movies](https://developer.themoviedb.org/reference/movie-popular-list) | Provides a movie list ordered by popularity. |
| [TMDb movie details](https://developer.themoviedb.org/reference/movie-details) | Retrieves top-level movie details by movie ID. |
| [TMDb movie search](https://developer.themoviedb.org/reference/search-movie) | Searches movie titles. |
| [TMDb FAQ](https://developer.themoviedb.org/docs/faq) | Non-commercial use requires TMDb attribution in an About/Credits-type area. |
| [MovieLens datasets](https://grouplens.org/datasets/movielens/) | Provides development and research datasets; their README/terms must be reviewed before use. |
| [MovieLens latest-small README](https://files.grouplens.org/datasets/movielens/ml-latest-small-README.html) | Documents `movies.csv`, `ratings.csv`, `links.csv`, and the link from MovieLens IDs to TMDb IDs. |

## Authenticated smoke-test evidence

The Spike owner ran an authenticated local test on **2026-09-19** using a TMDb
API Read Access Token supplied only to the PowerShell session. No token, `.env`
file, request header, or credential-bearing URL was written to the repository.

| Endpoint | Observed result |
|---|---|
| `GET /3/genre/movie/list?language=en-US` | Returned **19** movie genres. |
| `GET /3/movie/popular?language=en-US&page=1` | Returned **20** movies; the first result was `Spider-Man: Brand New Day`. |
| `GET /3/movie/550?language=en-US` | Returned `Fight Club` with **2** genres. |
| `GET /3/search/movie?query=Inception&language=en-US` | Returned **12** results; the first result was `Inception`. |

All four authenticated requests completed successfully. This validates that
TMDb is reachable from the owner's environment and supplies genre, popular
catalogue, detail, and title-search data for the MVP investigation. The field
mapping in the data contract below remains the implementation contract:
`id`, `title`, genre data, `overview`, `popularity`, `vote_average`, and
`vote_count` must be mapped explicitly by the Sprint 2 provider adapter.

If a later provider-adapter check finds a required field unavailable, the team
must reopen this decision instead of silently substituting another value.

## Data contract for the MVP

The application should convert external data into this provider-neutral model.
`popularityScore` is the numeric TMDb `popularity` value captured when the
catalogue is fetched or imported. It is not calculated from `vote_average` or
`vote_count`.

```text
CatalogMovie
  id: string                    // TMDb movie ID, stored as a string in the app
  title: string
  releaseYear: number | null    // derived from release date when available
  genreIds: number[]
  genreNames: string[]
  overview: string | null
  popularityScore: number
  voteAverage: number | null    // external aggregate only; not the user's rating
  voteCount: number | null      // external aggregate only
  source: "tmdb"
  sourceFetchedAt: ISO-8601 timestamp

ViewerRating
  sessionId: string
  movieId: string
  value: 1 | 2 | 3 | 4 | 5
```

This separation means that changing data providers later does not require the
product rules or UI to depend directly on TMDb field names.

## Initial recommendation approach

### 1. Personalised cold start

1. The viewer chooses 1--5 genres.
2. Select catalogue movies sharing at least one selected genre.
3. Remove duplicate IDs.
4. Apply the rating adjustment only when the viewer has saved ratings.
5. Sort by adjusted score descending, then `title` A--Z for ties.
6. Return at most 10 movies and state the matched genre as the recommendation
   reason.
7. If there are no matching movies, show the no-match state and up to 10
   popular alternatives.

### 2. Cold start without preferences

1. Use the same catalogue but do not claim that results are personalised.
2. Sort by `popularityScore` descending, then title A--Z for equal scores.
3. Return at most 10 unique movies.
4. Offer an action to choose genres.

### 3. Rating-informed ranking

For the MVP, calculate a small deterministic genre signal from the viewer's
saved local ratings:

| Rating | Signal for the rated movie's genre(s) |
|---:|---:|
| 4 or 5 | +1 |
| 3 | 0 |
| 1 or 2 | -1 |

For each candidate movie:

```text
adjustedScore = popularityScore + sum(signals for genres shared with candidate)
```

The tie-breaker remains title A--Z. Thus, with Action and Comedy candidates
both at base popularity 80, an Action rating of 5 produces Action 81 and
Comedy 80; an Action rating of 1 produces Action 79 and Comedy 80. A rating of
3 changes neither score. This is deliberately transparent, small enough for
the MVP, and satisfies the agreed acceptance examples without claiming to be
machine-learning personalisation.

### 4. Similar movies and title search

- Similar movies: exclude the source movie, keep candidates sharing at least
  one genre, order by `popularityScore` descending then title A--Z, and return
  at most 5.
- Title search: reject a query shorter than 2 characters; otherwise use a
  case-insensitive match against the local catalogue title and return at most
  10 results. TMDb search remains a future provider capability, not the
  deterministic automated-test oracle.

## Deterministic test fixtures

Automated tests must not call the live API. The API's catalogue and popularity
values can change, credentials can expire, and a network failure should not
make a unit test fail. Use synthetic local movies such as these instead:

| ID | Title | Genres | popularityScore |
|---|---|---|---:|
| `m1` | Action One | Action, Thriller | 90 |
| `m2` | Bravo Comedy | Comedy | 80 |
| `m3` | Cinema Comedy | Comedy | 80 |
| `m4` | Documentary Zero | Documentary | 70 |
| `m5` | Action Two | Action | 60 |

The fixtures support the required tests below.

| Test | Expected result |
|---|---|
| Select Action | `m1` and `m5` may be recommended; `m4` may not be recommended. |
| No preferences | Order begins `m1`, `m2`, `m3`; the 80-point tie is title A--Z. |
| Action filter over `[m1, m2, m3, m5]` | Exactly `m1` and `m5` remain. |
| Similar to `m1` | `m1` is excluded; `m5` is eligible because it shares Action. |
| Search `co` and `CO` | Both return the same matching titles, up to 10. |
| Action rating 5 with base-score tie | An Action candidate ranks above an otherwise tied Comedy candidate. |
| Action rating 1 with base-score tie | An Action candidate ranks below an otherwise tied Comedy candidate. |

## Rule-number crosswalk

Issue #16 was created before backlog refinement. At that time, the old
traceability draft used BR11 for rating signals and BR12 for popularity order.
The current C05 business-rule draft assigns those behaviours to BR9 and BR5.
The implementation must follow the rule wording, not an obsolete number.

| Behaviour affected by this Spike | Legacy reference in issue #16 / old traceability | Current C05 rule draft | Related Story |
|---|---|---|---|
| Genre match | BR2 | BR2 | #18 / S02 |
| Popular/fallback ordering | BR12 | BR5 | #20 / S04 and #31 / S09 |
| Viewer-rating ranking signal | BR11 | BR9 | #22 / S05b |
| Unique movie details | BR5 | BR6 | #19 / S03 |
| Similar-movie genre relation | BR9 | BR11 | #24 / S07 |
| Title search | not originally covered | BR12 | #30 / S08 |

When C04 prepares `docs/requirements.md`, use the approved C05 wording and
numbers in `docs/business-rules.md`. Update the older
`docs/traceability.md`/dossier references in the same requirements PR; do not
renumber the new C05 rules.

## Impact on backlog and ownership

| Story | Impact of the decision | Owner action before implementation |
|---|---|---|
| S01 / #17 | Needs the official genre list or a local mapped subset. | Decide whether the MVP exposes the full list or a curated set. |
| S02 / #18 | Matches selected genres against `genreIds`; returns at most 10 unique movies. | Implement provider-neutral catalogue filtering and a match reason. |
| S03 / #19 | Needs ID, title, year, genres, and overview. | Map a missing overview to an intentional unavailable state, never another movie. |
| S04 / #20 | Uses TMDb-derived `popularityScore`; title resolves equal-score ties. | Use synthetic A=90/B=80/C=80 test data. |
| S05a / #21 | Personal ratings are local whole integers from 1 to 5. | Do not send the rating to TMDb. |
| S05b / #22 | Uses the documented +1/0/-1 local signal. | Implement the two required 80-point tie examples. |
| S06 / #23 | Filters the already displayed local list by genre. | Test exactly 2 Action and 3 Comedy movies. |
| S07 / #24 | Finds candidates sharing a genre and omits the source movie. | Limit output to 5. |
| S08 / #30 | Uses local, case-insensitive title search for deterministic MVP behaviour. | Reject queries below 2 characters. |
| S09 / #31 | Uses `popularityScore` as the source of rank. | Provide the exact no-data state if catalogue data is absent. |
| S10 / #32 | Must disclose the simple genre/rating approach and TMDb attribution. | Add TMDb attribution to `/about-recommendations`. |
| S11 / #33 | Clears local preferences and `ViewerRating` records for the session. | Ensure reset does not change external catalogue data. |

## Risks and controls

| Risk | Control |
|---|---|
| API token appears in Git history | Keep it only in a local environment variable or server-side secret; review every diff before commit. |
| A browser-only client exposes a bearer token | Put TMDb calls behind a server-side provider or use a pre-imported catalogue for the frontend-only MVP. |
| Live data changes make tests flaky | Use synthetic local fixtures for all automated tests. |
| TMDb is unavailable | Show a catalogue-unavailable state or use a previously imported fixture; do not fabricate a recommendation. |
| TMDb attribution is missed | Add the prescribed attribution and approved logo/notice to `/about-recommendations` before the first TMDb-backed release. |
| MovieLens terms are assumed rather than read | Do not download, redistribute, or include MovieLens data unless the assigned member has read and recorded the applicable terms. |

## Completion checklist for issue #16

- [x] Compared TMDb and MovieLens against the fields needed by the agreed MVP.
- [x] Chosen one catalogue provider and documented why the other is not the MVP choice.
- [x] Defined the provider-neutral movie and viewer-rating data contract.
- [x] Defined deterministic behaviour for matching, popularity, ratings,
  similar movies, and title search.
- [x] Defined synthetic fixtures and expected outcomes for future tests.
- [x] Identified security, attribution, availability, and licence constraints.
- [x] Documented the legacy/current business-rule number crosswalk.
- [x] Owner ran the authenticated smoke test locally and recorded successful
  endpoint checks without exposing credentials.
- [ ] A teammate reviewed the report and confirmed the team accepts the
  decision.

Only the teammate-review check remains. After that review, the owner should
update the Result field of issue #16, open a PR with `Closes #16`, and move the
card to Done after that PR is merged.
