# Spike — TF-IDF text similarity for movie discovery

## Question

Can TF-IDF and cosine similarity rank locally stored movie overview text
reliably enough for the MVP features S07 (similar movies) and S08
(description-based search)?

## Timebox and owner

- Timebox: 4 hours.
- Actual time: 2 hours
- Owner: @kietxuan.
- Scope: committed local fixture only. This Spike makes no TMDb request, uses no
  token, and changes no production route, database schema, migration, or UI.

TMDb remains the Sprint 3 catalogue source. The production application will
import TMDb data into local SQLite before serving requests; this experiment is
kept offline so that its result is repeatable and safe for CI.

## Reproducible evidence

The fixture is [nlp-spike-movies.json](fixtures/nlp-spike-movies.json). It
contains six unique movies plus an identical duplicate `night-train` fixture
row, which verifies duplicate removal by opaque ID.

Run from the repository root:

```powershell
.\.venv\Scripts\python.exe backend\scripts\run_nlp_spike.py
.\.venv\Scripts\python.exe -m pytest backend\tests\test_nlp_spike.py -v
```

Run twice to confirm the same output:

```powershell
$first = (& .\.venv\Scripts\python.exe backend\scripts\run_nlp_spike.py --json |
  Out-String)
$second = (& .\.venv\Scripts\python.exe backend\scripts\run_nlp_spike.py --json |
  Out-String)
if ($first -cne $second) { throw "Spike output changed between identical runs" }
"Deterministic output confirmed."
```

The experiment contains no HTTP client, database connection, TMDb credential,
or frontend dependency.

## Method

- Normalize with Unicode NFKC and case-insensitive `casefold()`.
- Tokenize Unicode words, remove a small fixed English stop-word set, and do
  not stem, translate, expand synonyms, or call an external NLP model.
- Build one TF-IDF corpus from every unique local fixture movie with a usable
  overview. IDF uses `ln((1 + N) / (1 + documentFrequency)) + 1`.
- Compare vectors with cosine similarity.
- The MVP language assumption is that an overview and a description query use
  the same catalogue language. The committed fixture uses English.

This is deliberately a deterministic text baseline, not a claim of semantic
understanding or a machine-learning recommendation model.

## S07 findings — similar movies

Candidate selection occurs before ranking:

1. Exclude the selected source movie.
2. Keep only movies sharing at least one canonical genre with it.
3. Remove duplicate candidate IDs.
4. Limit the final list to at most five movies.

When the source has usable overview text, candidates with usable overview text
rank by cosine descending, then popularity descending, title ascending, and ID
ascending. Candidates with no usable overview are appended afterward using
popularity descending, title ascending, then ID ascending.

Consequently, one missing overview never switches the entire list to
popularity. It cannot reorder text-ranked candidates. A usable overview with
cosine `0` remains a text-ranked candidate and still appears before a
missing-overview candidate; this is an explicit, testable contract choice.

If the source itself has no usable overview, cosine is unavailable. All
eligible candidates then use the popularity/title/ID fallback. This is a
fallback for the source record only, not a fallback caused by another
candidate's missing text.

The script records the observed numeric scores and order under
`s07NormalSimilarity` and `s07MissingSourceOverview`.

Observed local output on 2026-10-09:

| Scenario                                   | Final order                                                         | Evidence                                                                                                                                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source: `Railway Murder`                   | `Night Train Case`, `Zebra Case`, `Family Drama`, `Silent Platform` | The first two both score `0.530292`; popularity `80` places Night Train before Zebra (`70`). Family Drama has usable text but score `0.000000`, so it remains above Silent Platform, which has no overview. |
| Source: `Silent Platform` with no overview | `Railway Murder`, `Night Train Case`, `Zebra Case`, `Family Drama`  | All four use the source-text fallback and sort by popularity `90`, `80`, `70`, `60`.                                                                                                                        |

`City Escape` is excluded from S07 despite containing related terms because it
shares no genre with `Railway Murder`. The duplicated `night-train` fixture row
appears once only.

## S08 findings — description search

1. A trimmed query shorter than two characters is rejected before a search.
2. Literal, case-insensitive title substring matches take precedence and sort
   by title, then ID.
3. If there is no title match, search all usable overview vectors and retain
   only cosine scores greater than zero.
4. Description search has no popularity fallback. If every score is zero, the
   exact result message is `No movies found.`

The script records literal-title, positive description-vector, and zero-score
cases under `s08LiteralTitleSearch`, `s08DescriptionSearch`, and
`s08ZeroScoreSearch`.

Observed local output on 2026-10-09:

| Query                       | Final result                                                                                                          | Evidence                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `ZEBRA`                     | `Zebra Case`                                                                                                          | Literal case-insensitive title matching wins before TF-IDF is evaluated.                |
| `overnight detective train` | `Night Train Case` (`0.831016`), `Zebra Case` (`0.831016`), `Railway Murder` (`0.348928`), `City Escape` (`0.155194`) | Equal scores use title order; S08 does not restrict results to matching genres.         |
| `volcano jazz galaxy`       | `No movies found.`                                                                                                    | No overview receives a positive cosine score; popularity does not fill the result list. |

## Result

Local verification passed on 2026-10-09:

- `backend/scripts/run_nlp_spike.py` completed successfully.
- The JSON output matched across two independent executions.
- `pytest backend/tests/test_nlp_spike.py -v` passed: 2 tests.
- `ruff check backend/scripts/run_nlp_spike.py backend/tests/test_nlp_spike.py`
  passed.
- No live TMDb request, credential, database connection, application route,
  migration, or frontend artifact was used.

Record the owner's actual elapsed time in Issue #43 before closing it. The
issue also still needs an independent teammate review and a merged PR.

## Recommendation

Decision: **accept the deterministic TF-IDF/cosine baseline for MVP
implementation**.

The implementation tasks for S07 and S08 must preserve the rules in this
document. They must use local SQLite data only at request time; a browser must
never receive or call with a TMDb token.

## Limitations

- The fixture is intentionally small and synthetic; it proves ordering and
  fallback rules, not recommendation quality across the full TMDb catalogue.
- TF-IDF cannot understand synonyms, negation, plot meaning, multilingual
  intent, or semantic similarity beyond shared terms.
- Poor, empty, or differently-language overviews reduce usefulness.
- The experiment does not implement S07 or S08, modify current Story status,
  or claim that production NLP is complete.
