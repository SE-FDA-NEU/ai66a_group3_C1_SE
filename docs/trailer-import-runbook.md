# Optional TMDb trailer enrichment (#19)

Run after the required TMDb catalogue import and migration. The command uses
the same private server-side `TMDB_READ_ACCESS_TOKEN`; it does not change the
active revision, core catalogue rows or account data. Run from the repository
root with the backend virtual environment active:

```powershell
python -m alembic -c backend/alembic.ini upgrade head
python -m app.cli.import_tmdb_catalogue --enrich-trailers --all
```

`--all` processes every active TMDb movie with no `trailer_attempted_at`.
It commits batches of at most 300 movies, making at most one videos request
per movie. `--limit 1..300` may accompany `--all` to choose a smaller batch
size. A single invocation never revisits a movie, even when a provider request
fails. Run the same command again after an interruption to continue pending
movies; failed movies already attempted are skipped, avoiding an infinite
retry loop. For an intentional refresh or retry, use the bounded command
`python -m app.cli.import_tmdb_catalogue --enrich-trailers --limit 300`.

Without `--all`, `--limit` accepts 1–300 and defaults to 300. A run selects at most that many
active `source=tmdb` movies, first those with no `trailer_attempted_at`, then
the oldest attempted movies, with `source_id` breaking ties. Each selected
movie makes at most one `/movie/{id}/videos` HTTP request, so the pass stays
within 300 requests. Repeat the command to continue through a catalogue
larger than 300 movies or to refresh the oldest results. The command prints
`eligible`, `fetched`, `remaining`, `updated`, `cleared`, `unchanged` and
`failed` counts. `remaining` counts movies never attempted after this pass;
it reaches zero after every active movie has been attempted at least once.
The exit code is nonzero when any movie fails or authentication is rejected.
Authentication failure stops further requests. Database write failure rolls
back the current batch. Earlier `--all` batches stay committed, and the
rolled-back batch remains pending for the next invocation. A process
interruption has the same transaction boundary. An authentication failure
records an `error` or `stale` attempt in the current committed batch, then
stops without requesting later movies. Ordinary provider failures retain the
last successful trailer, record a safe status, and do not block later movies.
The `--all` summary prints `active_revision`, `eligible`, `processed`,
`with_trailer`, `without_trailer`, `failed`, and `remaining`. `processed` counts
only movies committed during this invocation; `with_trailer` includes any
retained trailer after a failed request, so `failed` overlaps those counts.
`remaining` counts active movies still never attempted. On a database error,
the summary includes only earlier committed batches. Do not publish the token,
`.env` or a database dump.

Only videos with `site=YouTube`, `type=Trailer`, `official=true` and a valid
11-character key are eligible. Selection prioritizes English (`iso_639_1=en`),
then the newest valid `published_at`, then lexicographically smallest key.
The request explicitly sets `language=en-US` and supplies a bounded, live
checked fallback language set plus `null` in `include_video_language`, so
English and those other tagged videos can be ranked from one response. A live
probe found that an indiscriminate 185-code list returned zero videos for a
movie whose default query returned 42; do not expand the list without another
TMDb response check. Languages outside the configured set may still be missed.
TMDb's [movie videos reference](https://developer.themoviedb.org/reference/movie-videos)
documents the `en-US` default but does not currently list
`include_video_language` for this movie endpoint; the offline HTTP adapter
test proves the outgoing query and selector behavior, not TMDb's live response.
Verify a non-English-only movie in the live smoke before claiming complete
multilingual coverage.

Missing or invalid dates sort after valid dates. An eligible empty result clears
the previous trailer. A malformed results envelope or failed request keeps the
last successful metadata and sets `trailer_status` to `stale` (or `error` if
there has been no successful fetch). `trailer_attempted_at` and
`trailer_succeeded_at` record those separate events. No provider error body is
stored or printed.

The public details response adds nullable `trailer` with site, key, name, type,
official, language, publishedAt and a server-built YouTube URL. The browser
shows a link only when a trailer is present. It never calls TMDb for details.

Offline verification, with a synthetic provider and isolated SQLite:

```powershell
python -m pytest backend/tests/test_trailer_enrichment.py backend/tests/test_tmdb_import_cli.py backend/tests/test_movies_api.py -q
python -m ruff check backend
cd frontend
npm run test -- --run src/tests/visual-primitives.test.tsx
npm run build
```

For a live environment, record the tested executable SHA, run counts, the
active TMDb revision, a nullable and a populated details response, and the
reviewer's independent result. A live import and an independent review are
separate from the offline checks above.

For an isolated local smoke, set `DATABASE_URL` to a new ignored database path
before running migration, catalogue import, and `--enrich-trailers --all` in
that order. This keeps the configured personal database untouched. Then run
`scripts/verify_tmdb_trailer_language_live.py` with the same `DATABASE_URL`;
it compares the expanded and default movie videos responses and reports a
real movie with only non-English eligible official trailers if one is found.
Record the executable SHA, UTC time, active revision, counts, details API
responses, and browser screenshots separately from the existing synthetic
screenshots. The live script makes additional read-only TMDb requests outside
the enrichment request budget.
