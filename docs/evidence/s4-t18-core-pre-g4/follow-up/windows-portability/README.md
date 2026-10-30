# Windows assertions and resumed live TMDb acceptance

30 October 2026, Asia/Ho_Chi_Minh. Runner: **Codex, author verification**.
PR #239 executable source: **`6aa1941dd506f6ce6a3c683f4580c748f75125f4`**.
PR #240 executable source: **`058a36794637d38635099a89fd0d6d85f27ba53d`**.
The subsequent delivery commit adds evidence only. The [source manifest](resumed-tested-source.sha256)
pins 319 executable/test/support files. All 157 production files under
`backend/app`, `backend/alembic` and `frontend/src` are equal between these two
candidates. This run reused the installed venv and frontend dependencies; it
is **not** another fresh-clone installation or independent human review.

## Windows regression correction in both PRs

The subprocess probe now compares SQLAlchemy URL objects:
`engine.url == make_url(os.environ["DATABASE_URL"])`. This permits SQLAlchemy's
Windows-path escaping without weakening database identity. The collection-failure
case additionally requires `intentional collection failure` in captured output.
Migration/health/import errors can no longer satisfy that failure case merely
by returning pytest exit code 2. `/health` remains a separate passing assertion.

| Candidate / command | Observed |
|---|---|
| #239, `python -m pytest tests/test_pytest_setup.py backend/tests/test_health.py -v` | **4 passed**; [log](resumed-focused-t18.log) |
| #240, same four nodes in its own worktree | **4 passed**; [log](resumed-focused-early.log) |
| #239, `python -m pytest -v` | **765 passed, 1 skipped, 210 subtests passed**, 149.93s; [log](resumed-module-pytest.log) |
| #240, `python -m pytest -v` | **765 passed, 1 skipped, 210 subtests passed**, 150.42s; [log](resumed-early-module-pytest.log) |

Environment: macOS, Python **3.12.4**, SQLite **3.45.3**, pytest **9.1.1**,
Node **v24.21.0**, Chromium **156.0.8078.4**. Full pytest runs had permission
to bind fixture-owned localhost sockets. These are macOS executions of the
Windows-portable correction; no native Windows execution is claimed.

The interrupted work's [plain pytest log](plain-pytest.log) remains a **failed**
attempt: 760 passed, 1 skipped, five auth-server fixture errors. Its
[import log](live-import.log) also remains a failed timeout. They are retained
as history and are superseded by the successful `resumed-*` observations below.

## Successful real import, provenance and index

The production CLI fetched **50 TMDb popular pages** over verified HTTPS with
the existing server-side token. There was no fixture/seed or provider mock in
this import. The database is a new operator-owned smoke database:
`/private/tmp/s4-t18-live-resume-20261030/catalogue.db`. The configured developer
database and index were not replaced. The earlier zero-movie database was a
separate failed smoke, not evidence that the developer catalogue was lost.

| Check | Actual result |
|---|---|
| Fresh migrations | **Exit 0**, head `f2c7e4a91b60`; [log](resumed-live-migrations.log) |
| Import `--pages 50` | **Exit 0**; inserted **964**, updated **0**, rejected **36**; [log](resumed-live-import.log) |
| Active SQL provenance | **964 movies, 964 distinct source IDs, source/provider `tmdb`, 964 finite popularity values, 19 associated genres, 964 fetch timestamps**; [JSON](resumed-live-provenance-api.json) |
| Active revision | `00a9831b-1c3a-489b-a8cf-51d36424e702` |
| Source fetched / imported, UTC | `2026-10-30T08:06:16.043516Z` / `2026-10-30T08:06:43.080794Z` |
| Overview index rebuild and check | Both **exit 0, ready=true**, same active revision; **964 movies, 962 usable documents, 7,718 vocabulary terms**; [rebuild](resumed-live-index-rebuild.log), [check](resumed-live-index-check.log) |
| Corpus digest | `3ac90bf45649bba63965b0ff9b723d9588c00a64c58a7a204029aa80a19aca1e` |
| Config fingerprint | `41785781f34ba44091ac64f3b1c0503402ee760c518af1429d0acb94bbc31c99` |

The count is the actual accepted 50-page snapshot after validation, rather than
an assumed older 200–300 movie range. No smaller import was used to satisfy a
legacy assertion. Real source-ID samples and fetch timestamps are in the SQL
summary. Tokens, provider payloads, database dumps and session cookies are not
included in the committed evidence.

## API and real browser observations

[API smoke](resumed-live-api.log): **217 successful expected-status assertions**
against a migrated SQLite backup of the real imported catalogue. All **97 pages**
of each alphabetical order were traversed: no missing/duplicate IDs, complete
SQL membership, reverse title order, `meta.total=964` and the correct revision.
Health, detail, Popular and Similar returned 200. Description query
`the stakes in` has **zero title matches in SQL** and returns nonempty indexed
results, proving the description fallback was exercised. Private unauthenticated
reads returned 401. A disposable account exercised cold-start order, personalised
recommendations, 4.5-star persistence and reset with watchlist preservation.

[Browser smoke](resumed-live-browser.json): **PASS**, using the production
Uvicorn application and Vite development server on owned ports 8014/5174, an independent
SQLite backup, real Chromium, and real image CDN loads. No API responses or
network failures were mocked. The app ran with a blank token and
`TMDB_NETWORK_DISABLED=1` after import. Observations include:

- Home's SQL/API count and revision, first two distinct pages, loaded posters,
  dark desktop 1440px and light mobile 375px.
- Popular pages 1 and 2 with the current carousel's matching top movie and
  a loaded real backdrop. Page 2 retains the carousel under the current contract.
- Explicit description Search submission, populated results, detail navigation
  and restoration of the submitted query when returning.
- Real detail poster and local-index Similar at tablet 768px.
- A's saved genre, personalised list, 4.5-star rating and watchlist through UI.
  B's independent session sees none of A's preferences/rating/watchlist.
- Backend process restart plus logout/login preserves A's saved data.
- Confirmed Profile reset through UI clears A's genres/rating, preserves the
  watchlist and restores popular cold start.

There were **zero page errors and zero browser TMDb metadata requests**.
[Server output](resumed-live-servers.log) and [command output](resumed-live-browser.log)
record the actual requests and shutdown of owned processes. The first browser
attempt used an incorrect test selector on Preferences; its
[failure](attempt-1-browser.json) is retained. Correcting the smoke script and
running on a fresh database backup passed without production changes.

Screenshots: [Home desktop](live-home-1440-dark.png),
[Home mobile](live-home-375-light.png), [Popular](live-popular-375-light.png),
[description Search](live-description-search-375-light.png),
[detail / Similar](live-detail-similar-768-light.png),
[watchlist](live-watchlist-768-light.png), [reset](live-profile-after-reset-768-light.png).

## Reproduction and remaining gates

Use a **new** operator-owned directory, set `DATABASE_URL`/`NLP_INDEX_PATH` for
it, create its parent directory, and run the four production CLI commands in
[SETUP](../../../../SETUP.md): migrate, import `--pages 50`, index rebuild, index
check. Keep the token server-side. Record the new import's own counts/revision;
they may differ from this snapshot.

From the repository root, with locked dependencies and installed Chromium:

```text
python docs/evidence/s4-t18-core-pre-g4/follow-up/windows-portability/verify_live_api.py --database <catalogue.db> --index <overview-index.json> --output <evidence-directory>
node docs/evidence/s4-t18-core-pre-g4/follow-up/windows-portability/verify_live_browser.cjs <browser.db> <overview-index.json> <evidence-directory>/resumed-live-provenance-api.json <evidence-directory>
```

The API script opens the supplied catalogue read-only and creates `api.db` and
`browser.db` backups beside it, refusing to replace prior backups. The browser
script uses the supplied disposable `browser.db`, creates synthetic accounts
and resets only its own account, refuses occupied ports, and stops its servers.
Use a fresh backup for each browser rerun; its account registration must return
201. Neither script belongs to offline default pytest or CI.

The two requested source corrections and **author-executed live TMDb smoke are
complete**. **T18/#213 is still not accepted or closed**: independent execution
on the final candidate, confirmed implementation/review/regression capacity,
the early-setup PR's merge, and an explicit PO/SM Go/Defer record remain their
own gates. Hosted review checks or past approvals do not supply human command,
machine and expected/actual evidence. No merge, independent execution, capacity
or G4 decision is invented by this follow-up.
