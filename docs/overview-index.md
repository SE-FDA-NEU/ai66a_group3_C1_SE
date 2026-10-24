# Shared overview index (S4-T06, #201)

The backend builds one local TF-IDF index from the **active SQLite catalogue**.
It contains only opaque movie IDs and overview-derived text vectors; it does
not contain accounts, ratings, preferences, provider tokens, image metadata or
raw TMDb responses. Search and Similar can import
`app.recommendations.overview_index.load_active_index`, then use
`vector_for`, `has_usable_vector`, `transform_query` and `cosine_similarity`
without fitting on a request. Their HTTP routes are separate tasks.

## Build and readiness

After configuring `DATABASE_URL` and migrating/importing the catalogue, run
from the repository root with the project's Python environment:

```powershell
$env:PYTHONPATH = 'backend'
.\.venv\Scripts\python.exe -m app.cli.rebuild_overview_index rebuild
.\.venv\Scripts\python.exe -m app.cli.rebuild_overview_index check
```

The default artifact is `data/overview-tfidf-v1.json` under the repository
root. Set `NLP_INDEX_PATH` or pass `--path <file>` to put it beside a persistent
database volume. The file is generated locally and ignored by Git. The command
is offline and requires no TMDb token. `check` exits 0 and prints `ready=true`
plus revision, fingerprints and counts when usable; it exits 1 if the active
catalogue or artifact is absent, stale, corrupt or unreadable. Run `rebuild`
after a text, ID or preprocessing change. A successful build with no usable
overviews reports zero documents/vocabulary and is **ready**.

The builder first checks the current artifact. If the text/config key is
unchanged, it reuses the fitted state. Otherwise it builds a new JSON payload
in a temporary file in the target directory, flushes it, and atomically
replaces the artifact. A failed build retains the previous file. That old file
is still **unready** when the active text/config changed. The CLI checks
readiness again through a fresh DB session after replacement. Restarting the
process loads the persisted vocabulary, IDF, vectors and movie ID mapping; it
does not refit them.

## Compatibility and failure policy

`corpusDigest` hashes canonical JSON of `[internalMovieId,
normalizedOverview]` for every active movie, ordered by opaque ID. Null and
empty text normalize to the same value. This detects direct overview edits
under the same catalogue revision and added/removed movie IDs. Media-only
updates leave the digest unchanged. `configFingerprint` hashes the explicit
`overview-tfidf-v1` rules: NFKC, casefold, Unicode word tokens, fixed English
stop words, term frequency, smoothed IDF and cosine. Changing implementation
semantics requires updating that model version/config before rebuilding.

The JSON includes a checksum covering its manifest, vocabulary, IDF, vectors
and ordered ID mapping. A checksum validates file integrity, while the live DB
digest validates freshness. Readers validate both before an NLP read. Missing,
stale and broken artifacts raise `IndexUnavailable`; future HTTP consumers map
that to `503 INDEX_UNAVAILABLE` with the public message from
[api.md](api.md#132-shared-nlp-search-and-similar-reads). They must not report
such failures as an empty Search result or a missing-overview fallback.
Empty or stop-word-only overviews have no usable vector. A usable vector with
cosine 0 is a distinct valid state.

## Reproduce the focused verification

Run the focused tests with synthetic catalogue rows and temporary local databases:

```powershell
.\.venv\Scripts\python.exe -m pytest backend/tests/test_overview_index.py -v
.\.venv\Scripts\python.exe -m ruff check backend/app/recommendations/overview_index.py backend/app/cli/rebuild_overview_index.py backend/tests/test_overview_index.py
```

The tests cover restart/load, opaque mapping, query transform, empty corpus,
text/config and ID invalidation, media-only reuse, checksum damage and failed
atomic replacement. The full migrated backend suite is a separate regression
check via `backend/scripts/run_isolated_tests.py -q`. Story #24 Similar and
#30 Search HTTP/UI criteria remain for their
respective tasks. Independent review, PR/merge and issue closure need actual
reviewer evidence; this implementation document does not claim those events.
