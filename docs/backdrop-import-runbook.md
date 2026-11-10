# S3-T27 backdrop import and details contract

Task [#130](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/130);
storage handoff [#129](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/129).

## Data and API

The normal bounded TMDb catalogue import now copies `backdrop_path` from each
popular movie record. If that record needs a movie-detail request for genres,
the importer can also use its backdrop field. A valid one-segment provider
filename is stored; explicit JSON `null` clears a prior path. Missing or invalid
media leaves the prior value intact. Reimports retain internal movie IDs and
all account and catalogue transaction guarantees.

`GET /api/movies/{movieId}` adds required nullable `backdropUrl: string | null`
to `data.movie`. The base is the reviewed server configuration
`https://image.tmdb.org/t/p` and the only supported backdrop size is `w780`.
The server accepts a single `/filename.jpg`, `.jpeg`, `.png` or `.webp` segment
with ASCII letters, digits, `_` or `-` (maximum 128 filename characters).
Full URLs, nested paths, traversal, query strings, encoded separators and SVG
are rejected. Even a bad value left in an older database produces `null`.
The detail route uses only local database rows and this cached configuration;
it never makes a TMDb request. No token, TMDb source ID or raw path is in the
DTO. List and recommendation DTOs do not change. T37 can use this nullable
typed field and supply its own missing/broken-image fallback.

TMDb's [image URL guide](https://developer.themoviedb.org/docs/image-basics)
describes the base, size and file-path construction. Changing the configured
base or size requires another review; no provider-supplied host or size is
accepted by the URL builder.

## Bounded enrichment for an existing active catalogue

From the repository root, after applying the current Alembic head and using
the existing private server token and database:

```powershell
.\.venv\Scripts\python.exe -m app.cli.import_tmdb_catalogue --enrich-backdrops --all
```

`--all` snapshots all active `source=tmdb` movie IDs and visits every selected
movie once, with at most 300 details requests per committed batch. It does not
cap a 1,000-movie catalogue at 300. Optionally use `--all --limit 50` for smaller
batches. There are no popular-page or genre requests. Without `--all`, the
1–300 limit is deliberately one pass over the sorted prefix; repeating that
bounded command does not move to another page. Image `--all` has no persistent
attempt marker: another invocation refreshes the whole selected catalogue.

The all-mode output reports `active_revision`, `eligible`, `processed`, `remaining`, `updated`, `cleared`,
`unchanged`, `missing` and `invalid`. `cleared` is included in `updated`.
Missing and invalid provider media never erase a prior value. Any request or
database failure rolls back the current batch, prints a sanitized error and
stops; earlier committed batches remain. The summary counts committed work
only. An active-catalogue change also stops processing. Successful media-only updates do not create or
activate a catalogue revision, touch the catalogue source-fetch timestamp, or
invalidate a revision-keyed recommendation/TF-IDF corpus. A normal core
reimport still creates a new catalogue revision and follows its existing
version rules.

Never reseed or reset an account database to add images. Keep the token in the
server's private `.env`/environment and omit `.env`, payloads and database dumps
from a PR. The automated tests use synthetic offline payloads. A live backdrop
smoke and independent review belong to [#131](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/131),
before the full feature is accepted.

## Reviewer commands

```powershell
$env:PYTHONPATH='backend'
.\.venv\Scripts\python.exe -m pytest backend/tests/test_tmdb_import.py backend/tests/test_tmdb_import_cli.py backend/tests/test_movies_api.py backend/tests/test_backdrop_storage.py -q
.\.venv\Scripts\python.exe -m ruff check backend
git diff --check
```

Check the actual test result and source SHA in the PR. Core live import smoke
for [#128](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/128)
remains separate from CI. This backend task can close after its own review;
T37 UI and #131 acceptance remain independent work.
