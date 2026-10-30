# Optional TMDb trailer enrichment (#19)

Run after the required TMDb catalogue import and migration. The command uses
the same private server-side `TMDB_READ_ACCESS_TOKEN`; it does not change the
active revision, core catalogue rows or account data. Run from the repository
root with the backend virtual environment active:

```powershell
python -m alembic -c backend/alembic.ini upgrade head
python -m app.cli.import_tmdb_catalogue --enrich-trailers --limit 300
```

`--limit` accepts 1–300 and defaults to 300. A run selects at most that many
active `source=tmdb` movies in source-ID order and makes at most one
`/movie/{id}/videos` request per selected movie. Repeat the command after
fixing a provider problem or to refresh metadata. The command prints `eligible`,
`fetched`, `remaining`, `updated`, `cleared`, `unchanged` and `failed` counts.
The exit code is nonzero when any movie fails or authentication is rejected.
Authentication failure stops further requests. Database write failure rolls
back the pass. Do not publish the token, `.env` or a database dump.

Only videos with `site=YouTube`, `type=Trailer`, `official=true` and a valid
11-character key are eligible. Selection prioritizes English (`iso_639_1=en`),
then the newest valid `published_at`, then lexicographically smallest key.
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
