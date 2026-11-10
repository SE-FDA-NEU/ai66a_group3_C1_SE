# T20 full-catalogue media and embedded-player audit — 2026-10-31

PR [#242](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/242),
Refs [#215](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/215).
Final executable commit: `23e655cd8a531f1662767838cc4cf1b6a9303185`.
Full backend run: `eb4ee332c08aa65e792616cbb99d61a91292811c`; backend source/tests
are byte-equivalent at the final executable commit. The later executable change
fixes the independently reproduced Search transition race and adds its tests.
The following evidence commit changes documentation/results/screenshots only.

Tester: Codex assisting the implementer, Windows, 2026-10-31. This is author
verification. Independent teammate review remains required; no merge or issue
closure is claimed. G4 Go and the embedded-player amendment were authorized by
the user. See [source identity and comparison](media-setup-results/source-sha256.json).

## Problems found and corrected

1. Poster/backdrop repair selected only the first 300 movies. Repeating it could
   revisit the same sorted prefix. Both modes now accept `--all`: one fixed
   active-ID snapshot is processed once per invocation in committed batches.
2. Fresh setup imported popular metadata but never fetched movie videos. Both
   platform sequences now migrate, import 50 pages, enrich all pending trailers,
   then rebuild/check the overview index and prepare the review account.
3. Setup health guidance referred to an old task's head and treated connectivity
   as schema readiness. It now compares `alembic current`/`heads`, upgrades before
   restart and checks movie endpoints; it explains the missing-trailer-column 503.
4. Current handoffs/runbooks still described external-tab playback. They now
   describe the button below the poster, unavailable caption and on-page player.
   Historical evidence remains tied to its original executable SHA.
5. Full T01 acceptance exposed a pre-existing Search transition race. Browser
   history can advance before React commits Home, allowing an old success/error
   to navigate back. The fix checks browser pathname/query/page scope as well as
   cancellation before applying a response. Four deterministic cases failed
   before the fix and passed afterwards. No unrelated assertion was removed.

## Commands and limits

For an existing accepted catalogue, after a consistent backup:

```powershell
.\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini upgrade head
.\.venv\Scripts\python.exe -m app.cli.import_tmdb_catalogue --enrich-posters --all
.\.venv\Scripts\python.exe -m app.cli.import_tmdb_catalogue --enrich-backdrops --all
.\.venv\Scripts\python.exe -m app.cli.import_tmdb_catalogue --enrich-trailers --all
```

These are separate modes, chosen as needed. With `--all`, 300 is the maximum
batch budget, not the whole-catalogue cap; `--all --limit 50` uses smaller batches.
Without `--all`, the existing 1–300 one-pass semantics are deliberately retained.
Fresh popular imports already retain available image paths, so a fresh clone
does not need two extra image-detail sweeps just to obtain its initial images.

Images snapshot all active TMDb IDs and refresh each once. Missing/invalid fields
preserve prior values; explicit null clears the selected path. Errors roll back
the current batch and stop with a nonzero exit and committed-only progress.
Earlier commits remain. A changed active catalogue also stops processing.
Another image `--all` invocation starts a full refresh; there is no persisted
image attempt marker. Trailer `--all` keeps its existing pending-only/resume
semantics. There are no new migrations, packages or runtime metadata requests.

The standard 50-page import targets approximately 1,000 raw rows; live valid
counts vary with TMDb/deduplication. It does not promise exactly 980 or 1,000.
Null image/trailer data is a valid provider result, not a reason to use a demo
catalogue or another movie's media.

## Automated verification

| Check | Result | Output |
|---|---|---|
| Full default backend at `eb4ee33` (unchanged at final code) | 818 passed, 1 inherited skip, 210 subtests passed | [backend](media-setup-results/backend.txt) |
| Full frontend at final code | 467 passed, 41 files | [frontend](media-setup-results/frontend.txt) |
| Real API/SQLite T20 browser | 6 passed; 24 media/theme/width cases plus 6 modal layouts | [T20](media-setup-results/t20.txt) |
| Full existing T01 browser | 16 passed, 1 live-only skip; owned DB removed | [T01](media-setup-results/t01.txt) |
| Search RED | 4 failures on the old Search implementation with the new regression cases | [RED](media-setup-results/search-red.txt) |
| Search GREEN and existing movie unit tests | 31 passed; included in the final 467 | [GREEN](media-setup-results/search-green.txt) |
| Ruff, C03, LF/CRLF and T05 traceability | Passed; 37 P0 IDs mapped to 48 nodes | [static](media-setup-results/static.txt) |
| Frontend lint / build | Passed | [lint](media-setup-results/lint.txt), [build](media-setup-results/build.txt) |
| Alembic | One head: `a3d1f8b72c44` | [clean backend](media-setup-results/clean-backend.txt) |

Image tests exercise **1,000 movies for both modes**, using both the default
300 batch budget and an explicit 127. They assert exactly one request per ID,
all images updated, and equality of every other database field/table including
IDs, revision, account/preferences/half-star ratings/watchlist, other images,
trailer metadata and corpus text. Additional tests cover missing/invalid/null/
unchanged values, provider/auth/database errors, rollback of a partially written
batch, committed-only counts and catalogue changes. A new documentation test
parses the actual CLI arguments from README/SETUP/runbooks with networking
disabled and verifies the fresh setup ordering on both platforms.

The first full T01 run at `eb4ee33` failed Search → Home (15 passed, 1 failed,
1 skipped). The deterministic RED cases established the cause, and the full
suite passed after the fix. Repeated clean-checkout execution below additionally
checks that race five times; this is a fix, not a retry-only acceptance claim.

## Separate clean-checkout verification

A new local clone used `--no-hardlinks`, a new venv and new `node_modules`,
without copying `.env`, app data or dependency directories. Locked dependencies
were installed at `eb4ee33`; the clean checkout was then advanced to the final
executable commit before tests. Requirements/package locks are unchanged between
those commits. Pip download cache and the host's installed Playwright Chromium
were reused. [Installation/build output](media-setup-results/clean-install.txt).

- Pip check, npm ci and production build: passed.
- P0 + media/import/CLI/documentation/migration tests: **124 passed**.
- T20 browser using default Chromium: **6 passed**, owned DB removed.
- Existing T01 Search delayed-response case repeated five times: **5 passed**,
  owned DB removed.

See [clean backend](media-setup-results/clean-backend.txt),
[clean browser](media-setup-results/clean-browser.txt),
[T20 report](media-setup-results/clean-t20-summary.json) and
[repeated Search report](media-setup-results/clean-t01-summary.json).
This is offline provider-boundary acceptance; it is not a claim that a new
token-free machine downloaded a live TMDb catalogue.

`npm ci` reported the existing 18 development-dependency advisories (4 high);
the lockfile is unchanged. The earlier production-only audit reported 0. No
dependency upgrades are bundled into this change. The inherited Starlette/httpx
deprecation warning remains recorded in backend output.

## Live local playback and screenshots

The read-only live check at `eb4ee33` used the running application and imported
980-movie catalogue, without replacing or enriching the personal database.
The UI/player files are unchanged at the final executable commit. Spider-Man's
stored official trailer played inside the modal: `currentTime > 0.5`,
`paused=false`, `readyState=4`; URL unchanged, one tab, frame removed on close.
The real no-trailer movie displayed its caption on mobile.
[Observed playback state](media-setup-results/live-playback.json).

- [Real trailer action below the poster](embedded-screenshots/real-trailer-below-poster.png).
- [Real video playing inside the app](embedded-screenshots/real-embedded-trailer.png).
- [Real unavailable caption on mobile](embedded-screenshots/real-unavailable-mobile.png).
- [Screenshot hashes](media-setup-results/screenshot-sha256.json).

Only that selected video's playback is demonstrated. YouTube still controls
per-video embedding and availability; unavailable videos are not substituted.
Offline browser fixtures test UI transitions/layout, not decoding external video.
No token, `.env`, database dump, auth cookies or personal backup is published.

Hosted results are on [PR checks](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/242/checks).
Keep `Refs #215` and obtain substantive non-author review/rerun of the final
candidate before merge/closure; author automation is not that independent review.
