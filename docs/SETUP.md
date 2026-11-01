# Setup

From Sprint 3 the application setup steps prepare a required TMDb-imported
catalogue. Running the importer needs a valid private Read Access Token and
network access to TMDb. Automated checks use synthetic fixtures/mocks and no
live token/provider network. For the fast P0 tests, only the Python virtual
environment and Python installs are needed; see [Verify](#verify). The decision
is in [design.md](design.md); manual
smoke/provenance and verification ownership are in the [runbook](tmdb-sprint3-runbook.md).

Earlier clean-clone baseline tested by: Codex, Sprint 3, 2026-10-18, Windows PowerShell,
Python 3.12.6 / Node.js 24.19.0 / Microsoft Edge 155.0.4283.62, committed
application and verification-code SHA
`05dda34900fd0fa80cfff323b353a8d4c220a4d8`.
A fresh clone with new locked dependencies, a new TMDb database and an actual
browser/process-restart journey passed for that earlier candidate. Its original
documentation follow-up did not change executable code. See the [clean-clone record](evidence/s3-c04-clean-clone.md)
for the source fingerprint, provenance, screenshots, CI links and independent-review gate.

Current review-account follow-up tested by: Codex, Sprint 3, 2026-10-18,
Windows PowerShell, Python 3.12.6 / Node.js 24.19.0 / Edge 155.0.4283.62,
committed application/test candidate
`326aadf3ee32342c4e91297ee9e885663eccf565`. A new clone with new locked
dependencies imported real TMDb data, created the documented account in the
same `data/app.db`, and passed real-browser login/BR1/preferences/details/rating
and process-restart checks. The existing 255-film development database also
passed idempotent account verification without changes. See the
[current follow-up evidence](evidence/s3-c04-review-account.md), including the
initial provider timeout and the successful documented default import.

## Prerequisites

| Tool | Version | Check (macOS/Linux) | Check (Windows PowerShell) |
|---|---|---|---|
| Git | Any recent version | `git --version` | `git --version` |
| Python | 3.12 | `python3.12 --version` | `py -3.12 --version` or the full path below |
| Node.js | 24 | `node --version` | `node --version` |
| npm | Installed with Node.js | `npm --version` | `npm.cmd --version` |

Backend dependencies are pinned in `backend/requirements.lock.txt` and frontend dependencies in `frontend/package-lock.json`.
On Windows PowerShell, `npm.cmd` avoids execution-policy restrictions on
`npm.ps1`. The Windows commands below call the virtual-environment Python
directly, so `Activate.ps1` is not required. The commands require Python 3.12;
another Python version is not a substitute for the final clean-clone check.
If `py -3.12` reports no suitable runtime even though Python 3.12 is installed,
locate its `python.exe` (for example, with `Get-Command -All python.exe`), verify
`& "<full-path-to-python.exe>" --version` reports 3.12, and use that full path
instead of `py -3.12` for the virtual-environment creation command below.

## Environment file

`.env.example` contains two settings:

```env
DATABASE_URL=sqlite:///./data/app.db
TMDB_READ_ACCESS_TOKEN=
```

On a fresh clone copy it to the root `.env` and privately enter your valid
`TMDB_READ_ACCESS_TOKEN` before running the importer. Do not overwrite an existing
configured `.env`. Only the server importer reads the token; never put it in
frontend variables, logs, screenshots, Git or group messages. Tests use a blank
token and isolated test configuration. A teammate consuming an already-imported
backend does not need a token. `.env` is ignored by Git.

Before review, the PO/operator must arrange a valid TMDb Read Access Token and
privately configure it on the review machine. Do not make obtaining an API
account an undocumented surprise for the instructor. Alternatively the
instructor can use their own token: sign in to TMDb, open **Settings → API**,
request access if needed, and enter the **API Read Access Token** in root `.env`.
TMDb documents this in its [API authentication guide](https://developer.themoviedb.org/v4/docs/authentication-application)
and [API key FAQ](https://developer.themoviedb.org/docs/faq). This is the Bearer
read token, not the v3 API key. The machine must be able to reach
`https://api.themoviedb.org` over HTTPS during import. If the instructor cannot
obtain a token or reach TMDb, an operator can prepare a private staging backend
with an accepted imported catalogue for review; do not share a team token or
claim that a token-free clean clone has completed the live-import check.
The public application test login below is not a TMDb token. Never paste the
token into this document, a command line, GitHub, screenshots or frontend
settings. Rotate any token disclosed in chat or another shared channel.

## Steps

Run every command from the repository root.

After the copy step in either platform sequence below, edit the local `.env`
to configure the token before the final import command. The commands create
and migrate the database directly; the M2 seed is not a prerequisite.

### macOS and Linux

```bash
git clone https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE.git
cd ai66a_group3_C1_SE

cp .env.example .env
mkdir -p data

python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.lock.txt
python -m pip install -e "./backend[dev]" --no-deps

npm --prefix frontend ci

python -m alembic -c backend/alembic.ini upgrade head
python -m app.cli.import_tmdb_catalogue --pages 50
python -m app.cli.import_tmdb_catalogue --enrich-trailers --all
python -m app.cli.rebuild_overview_index rebuild
python -m app.cli.rebuild_overview_index check
python -m app.cli.create_review_account --confirm-local-demo
```

### Windows PowerShell

```powershell
git clone -c core.longpaths=true https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE.git
cd ai66a_group3_C1_SE

Copy-Item .env.example .env
New-Item -ItemType Directory -Force data
$env:PYTHONUTF8 = "1"

py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.lock.txt
.\.venv\Scripts\python.exe -m pip install -e "./backend[dev]" --no-deps

npm.cmd --prefix frontend ci

.\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini upgrade head
.\.venv\Scripts\python.exe -m app.cli.import_tmdb_catalogue --pages 50
.\.venv\Scripts\python.exe -m app.cli.import_tmdb_catalogue --enrich-trailers --all
.\.venv\Scripts\python.exe -m app.cli.rebuild_overview_index rebuild
.\.venv\Scripts\python.exe -m app.cli.rebuild_overview_index check
.\.venv\Scripts\python.exe -m app.cli.create_review_account --confirm-local-demo
```

The Windows clone command saves `core.longpaths=true` in this clone only;
some historical image paths are long. For an existing Windows clone in a
deep directory, use `git config core.longpaths true` if Git reports spurious
changes or cannot read those paths. No global Git setting is required.

For the standard review catalogue, run `python -m app.cli.import_tmdb_catalogue --pages 50`
as shown above (up to about 1,000 raw movies; 1–50 pages allowed).
Back up an existing database first. Reuse `--pages 50` on subsequent refreshes;
omitting it also uses the 50-page budget. Accounts, preferences and
ratings are retained, and each UI page remains limited to ten movies. See the
[TMDb runbook](tmdb-sprint3-runbook.md) for the bounded import contract.

To add backdrops to an already imported active TMDb catalogue without changing
its revision or accounts, use the bounded
[backdrop enrichment command](backdrop-import-runbook.md#bounded-enrichment-for-an-existing-active-catalogue).

### Existing catalogues: migrate and enrich every movie

After pulling changes, back up valuable SQLite data consistently and run
`alembic upgrade head` before restarting the backend. Compare `alembic current`
with `alembic heads`; use the actual repository head, not an old task's revision.

Fresh `--pages 50` imports now also retain valid TMDb `poster_path` fields in
the existing catalogue import. For an **existing** accepted catalogue, do not
re-import or shrink its snapshot just to obtain posters. With the same root
`.env`, run these media-only commands from the repo root as needed:

```powershell
.\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini upgrade head
.\.venv\Scripts\python.exe -m app.cli.import_tmdb_catalogue --enrich-posters --all
.\.venv\Scripts\python.exe -m app.cli.import_tmdb_catalogue --enrich-backdrops --all
.\.venv\Scripts\python.exe -m app.cli.import_tmdb_catalogue --enrich-trailers --all
```

POSIX: replace `.\.venv\Scripts\python.exe` with `python` in those commands.
These need the private server-side token. **300 is a batch limit, not a total
catalogue limit when `--all` is present.** `--all --limit 50` optionally uses
smaller committed batches while still processing the full selected catalogue.
Poster/backdrop modes snapshot every active TMDb movie ID and visit each once
per invocation. They preserve catalogue revision, IDs, core metadata, the other
media field, trailers and account data. Missing/invalid paths retain old values;
explicit null clears the selected image. A provider/database failure rolls back
the current batch, stops with a nonzero exit and reports earlier committed
progress. Re-running an image `--all` command refreshes the full snapshot again;
images have no persistent attempt marker. Trailer `--all` instead resumes movies
never attempted; see [the trailer runbook](trailer-import-runbook.md).

Without `--all`, `--limit` intentionally selects only one bounded pass. Repeating
a poster/backdrop pass repeats its deterministic prefix. Use `--all` for a
catalogue larger than one batch. Fresh popular imports already retain available
poster/backdrop paths for all returned movies, so image enrichment is an optional
repair/refresh, not a prerequisite to every startup. The standard fresh setup
above explicitly enriches trailers because the popular import does not fetch
movie videos. A successful lookup can have no official trailer; that is not a
failed import. No image/video files are stored in SQLite.

Runtime pages use local API data and public image-CDN URLs; no metadata request
or token is sent from the browser. A missing or failed poster shows a labelled
fallback. Dark is the default theme; the header toggle persists only the theme
choice (`cineai-theme`), not credentials. Rating stars select 0.5–5 in 0.5 steps;
**Save rating** still performs the existing server-confirmed write.

Detailed handoff, test commands and merge caveats:
[reconciled T01 UI handoff](s4-t01-ui-contract.md) and
[historical T01 evidence](evidence/s4-t01-ui.md). Later feature verification is
recorded separately, including [the current trailer/media handoff](evidence/s4-t20/embedded-preview.md).

Home now has a compact Start / Explore Catalogue hero and a persistent
**My recommendations** navbar entry. Ordinary sign-in from Home or direct
`/login` returns to Home; it does not automatically open or save preferences.
Choose **Start** or **Preferences** when ready to select 1–5 genres. A guest
Start attempt signs in first and then returns to Preferences, including when
registration is needed. Only a confirmed **Save preferences** opens personalised
results. **My recommendations** is a separate explicit action; without saved
genres it retains the existing **Popular / Not personalised** guidance.
Safe protected-route page/filter/hash intent is retained through sign-in; unsafe
or absent destinations fall back to Home. Session, password and API rules are
unchanged. This PO-authorized S13 landing amendment matches merged C03 section
13.5; the live Story #45 AC must carry the same noncontradictory rule.

All commands and both application processes must use the **same**
`DATABASE_URL` from root `.env` (normally `sqlite:///./data/app.db`). On an
existing checkout with a successful TMDb import, keep its configured URL and
catalogue; run only the review-account command if that is all that is missing.
Do not switch to a separate demo database, reseed, or rerun an import merely
to create the account. A fresh clone creates its own database by migrations
and a real TMDb import; it does not copy the team's local database.

## Required import result and smoke

A successful import prints this shape, with actual counts depending on the
bounded TMDb snapshot:

```text
TMDb catalogue import complete
provider=tmdb
active_revision=<opaque UUID>
inserted=<count>
updated=<count>
rejected=<count>
movies=<count>
associated_genres=<count>
finite_popularity_movies=<count>
source_fetched_at=<UTC timestamp>
imported_at=<UTC timestamp>
sample_source_ids=<up to three TMDb source IDs>
```

Before accepting the environment, record the actual distinct active TMDb movie count
(target: about 1,000; up to 1,000 raw rows before deduplication/validation)
under `catalogue_state.active_revision_id`. Import exit code 0 alone does not
prove an exact count; investigate a material shortfall before claiming readiness. The
unfiltered Home endpoint's `meta.total` must equal this active count. Verify
provider/source=tmdb, distinct source IDs,
fetch/import timestamps and movie/genre/finite-popularity counts using the
[manual smoke](tmdb-sprint3-runbook.md#3-mandatory-manual-live-smoke-and-provenance).
The catalogue must support the committed flows, including ten distinct
finite-popularity movies for #31. Live smoke is outside CI. Missing-token or
failed import exits nonzero and preserves any previous valid snapshot; it
must not fall back to seed.

Keep the command output and the read-only SQL/API results described in the
runbook as sanitized local evidence. A fresh database with a failed import has
no accepted catalogue. On an existing database, the importer preserves the
previous valid catalogue; verify the active revision before reporting readiness.

## Historical M2 seed / offline support

Only for M2 reproduction or labelled offline/test work, in a separate database:

```text
python -m app.cli.bootstrap_m2_catalogue
```

Do not run this seed command on the accepted Sprint 3 database: it activates
the seed revision. It cannot supply Sprint 3 catalogue acceptance evidence.

The bootstrap command applies the migrations and loads the fixed local catalogue. It prints:

```text
M2 catalogue bootstrap complete
active_revision=<a UUID that differs on each new database>
movies=12
genres=8
movie_genres=22
```

Running it again prints the same revision and the same counts.

## Start the application

Use two terminals, both opened in the repository root. On macOS/Linux activate
the virtual environment with `source .venv/bin/activate`. On Windows PowerShell,
replace `python` in backend commands with `.\.venv\Scripts\python.exe`, use
`npm.cmd` for frontend commands, and set `$env:PYTHONUTF8 = "1"` in each terminal.

Terminal 1, backend:

```bash
python -m uvicorn app.main:app --app-dir backend --reload
```

Terminal 2, frontend:

```bash
npm --prefix frontend run dev
```

## Expected result

Open `http://127.0.0.1:8000/health`. The response is:

```json
{"status":"ok","database":"connected","migrationVersion":"e9b6f0a42c17"}
```

Open `http://localhost:5173/`. The existing home page reads its cards from the
imported SQLite catalogue, and each valid card has a "View details" link. Live
titles/popularity can change. The Northstar Protocol/Orbit of Us screenshot in
[design.md](design.md#4-walking-skeleton) is historical M2 seed evidence, not
the expected Sprint 3 TMDb catalogue. Use the live P0 journey below to verify
the current routes on the imported catalogue.

## Disposable test account and P0 journey

### Public application-only review account

The PO confirmed that the following credentials are **only for this project's
local demonstration**, are not a Gmail/service password, and may be published.

| Field | Review value |
|---|---|
| Email | `kietxuan@gmail.com` |
| Password | `123456789` |
| Purpose | Local M3 application review only; no administrator role |
| Database | The same configured SQLite database with its accepted TMDb catalogue |

After the successful import, the account command shown above creates the user
in that database with an Argon2id password hash. `--confirm-local-demo` opts
in to these public **account credentials**, not to a demo catalogue or another
database. It does not import/seed movies or create a parallel database. It
requires an existing migrated SQLite file with a nonempty active TMDb revision
and rejects a seed/no-catalogue or non-TMDb movie source.

Expected output is `Local review account: created`, or `already_exists` on a
repeat with matching credentials. Repeating it preserves the user ID, hash,
preferences, ratings, sessions and catalogue. If the email already exists
with a different password, it exits nonzero without resetting that password
or deleting data. Contact the account owner instead of overwriting the database.
The command requires explicit opt-in, refuses `APP_ENV=production`/`prod`,
does not run at application startup and must never be used on a public or
production deployment. Rotate/remove the demo account before such deployment.

The instructor can start at `/`, choose **Sign in**, and use this account.
After sign-in, Home stays open. Choose **My recommendations** to view results.
If the account already has saved preferences, those results may be personalised
rather than cold start; that is persistence, not failed setup. Do not clear existing
personal data merely to reproduce the new-account screenshot.

### Full P0 and persistence journey

For registration/cold-start/account-isolation checks, additionally create fresh
test users through the UI **in this same TMDb database**, using non-production
credentials. These test users do not require a different movie dataset or
database. Keep any personal/service passwords private.

1. Open only `http://localhost:5173/`. Select **Sign in**, then **Create an
   account** on the login page. Enter the disposable email and a unique password
   of at least eight characters; select **Create account**.
2. Registration returns to login. Sign in with the same account. The application
   opens Home. Choose **My recommendations**; a new account sees **Popular** /
   **Not personalised**. No genres are chosen or saved automatically.
3. Select **Enter preferences →**. Select one to five genres and choose **Save
   preferences**. Expect **Recommended for you** and matching movie cards.
   From the home page the equivalent entry is **Start**; from recommendations
   use **Change my genres**. There is no **My preferences** control.
4. Open **View details** on a recommendation card. Confirm the movie title,
   genres and overview; missing optional fields use **Information unavailable**.
5. Under **Your rating (0.5 to 5)**, select `2.5 / 5` by pressing the middle/left half of the third star (right half selects 3), then choose **Save rating**. Arrow keys move in 0.5 steps; selection alone never saves.
   Wait for **Your saved rating: 4/5** and **Rating saved.**; a selected draft
   alone is not proof of persistence.
6. Use **Back to recommendations**, then **Change my genres**. Confirm the saved
   selections remain checked; use **Back to recommendations** to return.
7. Select **Sign out**, which returns to the public home page. Stop the backend
   and frontend with Ctrl+C in their own terminals. Start both again using the
   commands above, on the **same database**. Do not reseed, reimport or reset it.
8. In a fresh browser session, open the home page, select **Sign in**, and sign
   in as the same account. From Home choose **Preferences** to confirm restored choices;
   return to recommendations and open the same movie. Its saved rating must
   still be `4/5` without another save.
9. Return to recommendations and sign out. Register/sign in as a second account
   through the same visible links. It has no saved genres and sees the popular
   cold start. Use **Browse the catalogue** and **View details** for the same
   movie: it shows **Not rated yet**, not the first account's rating.

Normal journeys use visible links rather than typed feature URLs. These accounts
are test users within the configured TMDb database. The documented public
review account can be used for sign-in; separate new test users exercise
registration and isolation without resetting that account's existing data.
The [latest live evidence](evidence/s3-c04-final/live/results.json) records an
actual process restart and a fresh browser context, not merely a page reload.

## Verify

Run the fast P0 check from the repository root after creating the Python 3.12
virtual environment, installing `backend/requirements.lock.txt`, and installing
the editable backend with `python -m pip install -e "./backend[dev]" --no-deps`.
That Python setup is sufficient: no npm install, running server, `.env`, real
database, TMDb token or live network is needed to execute these tests.

macOS/Linux (POSIX):

```bash
source .venv/bin/activate
python -m pytest -v
```

Windows PowerShell, without activating `Activate.ps1`:

```powershell
.\.venv\Scripts\python.exe -m pytest -v
```

Under the user-approved #219 amendment of 2026-11-01, both root `pytest` and
`python -m pytest -v` run **40 P0 cases only**, from
`tests/test_p0_acceptance.py` and `tests/test_s03_details.py`. Root `pytest.ini`
selects exactly those two files. Extended backend/frontend/browser/script and
volume regressions remain available explicitly; they are outside this default.

Main CI's `Python tests`, `Node build and tests` and secrets jobs remain
automatic: 40 P0 cases, a few affected storage/bootstrap tests, backend/frontend
lint, frontend build and secrets checks. The effective main-branch rules
require teammate approval only, with no required status contexts. Existing
feature/browser workflows keep their names and run only via `workflow_dispatch`.
The new `Optional extended regression` workflow uses `run_python` and
`run_vitest` boolean inputs to select broad suites. These regressions are not
mandatory on every push. Focused storage/startup
acceptance remains part of the [C05 release checks](s4-c05-release-storage.md#offline-release-checks-and-review).

For the local lint/build checks, install the locked frontend dependencies first
(`npm --prefix frontend ci`); on Windows use `npm.cmd`:

```bash
python -m ruff check backend
npm --prefix frontend run lint
npm --prefix frontend run build
```

### Optional regressions

Choose these broader checks explicitly when needed; they are not prerequisites
to the fast P0 command or mandatory on every push. From the repository root:

```bash
python -m pytest -c pytest.ini tests backend/tests scripts -v
npm --prefix frontend test
```

For backend-only coverage, the retained helper is
`python backend/scripts/run_isolated_tests.py -v`. Frontend/browser checks need
the locked npm install and, where specified below, a browser installation.
Use `npm.cmd` on Windows and the venv Python path if the venv is not active.
Feature-specific checks later in this document are also explicit/manual
regressions rather than additions to the root pytest default.

For the optional S3-T33 rating UI/API/database acceptance journey, after
installing both locked runtimes, run from the repository root:

```text
npm --prefix frontend run test:t33:integration
```

This separate jsdom suite forwards real UI requests to FastAPI TestClient and a
new migrated temporary SQLite database, with synthetic M2 fixtures and no live
TMDb token/network. It does not seed or change your existing database. It verifies
save/update, injected commit failure and rollback, retry, session restoration,
account isolation, unchanged preferences and unchanged Sprint 3 ranking. It is
not a browser-cookie or visual end-to-end test. The repository `.venv` is detected
automatically on Windows/Linux; set `T33_PYTHON` if using another installed Python
3.12 environment. See [T33 evidence](evidence/s3-t33-rating-control.md) for focused
commands and real-browser reviewer steps.

For the independent S3-T34 real-browser rating protection/recovery journey, stop
anything using ports 8000 and 5173, then run:

```text
python backend/scripts/verify_s13_rating_ui.py --evidence-dir docs/evidence/s3-t34-rating-acceptance
```

The runner starts real FastAPI/Vite/Chromium processes against a new migrated
temporary SQLite database. It verifies guest access, save/update, injected
transaction failure and retry, account/rating/recommendation isolation, delayed
responses, revoked/expired 401 recovery, optional ratings, and return context.
It deletes the temporary database/profile and never touches the configured
development database. Pass `--browser <absolute-path>` if Chrome/Chromium/Edge
cannot be detected. See [T34 evidence](evidence/s3-t34-rating-acceptance/README.md).

The backend-only helper creates and migrates a temporary SQLite database, clears the
token, disables real TMDb requests, runs pytest, and removes the database. It
ignores the developer's `DATABASE_URL` and token from the root `.env`. Provider
tests inject synthetic clients or HTTP mocks; CI never runs a live import. The
T16, T33, S04, T28 and T34 acceptance runners also use disposable databases
and blank tokens. Manual live smoke remains separate for dev/staging/demo.

For the S04 real-browser suite, first install Playwright Chromium from the
`frontend` directory with `npx playwright install chromium` (on Windows use
`npx.cmd`).
If Google Chrome is already installed locally, set `S04_BROWSER_CHANNEL=chrome`
to use it instead. CI uses the Playwright Chromium installation.

#### S4-T20 trailer/backdrop acceptance

After the locked installs above, install Playwright Chromium from `frontend`
with `npx.cmd playwright install chromium` on Windows (`npx` on macOS/Linux).
Run from the repository root:

```powershell
npm.cmd --prefix frontend run test:t20:ui
npm.cmd --prefix frontend run test:t01:ui
```

T20 reuses the S04 runner: it owns ports **8014/5174**, a new migrated SQLite
database and a separate Vite cache, then stops its servers and removes its
temporary directory. Existing services on those ports cause a clear refusal.
Production FastAPI routes read the synthetic fixture from real SQLite;
metadata API responses are not intercepted. Only external artwork and the
embedded YouTube player document use deterministic offline fixtures.
No live import, token, developer database or YouTube playback is required.

Chromium is the cross-platform default. To opt into installed Chrome in
PowerShell, use `$env:S04_BROWSER_CHANNEL='chrome'`; an explicit executable can
instead be supplied with `$env:T20_BROWSER='C:\path\to\chrome.exe'`. There is
no assumed Chrome installation path. `S04_PYTHON` may name another installed
project venv when using a worktree; a normal clone uses its local `.venv`.
The JSON report and screenshots default to ignored `frontend/test-results/`.
Set `T20_SCREENSHOT_DIR` only when deliberately regenerating published evidence.

## Troubleshooting

### Direct pytest / EARLY_TEST_SETUP (#219)

After the Python 3.12 venv, locked Python installation and editable backend
install above, run from the repository root. On macOS/Linux (POSIX):

```bash
source .venv/bin/activate
pytest
python -m pytest -v
```

On Windows PowerShell with script execution disabled, the equivalent direct
entry points work without activating `Activate.ps1`:

```powershell
.\.venv\Scripts\pytest.exe
.\.venv\Scripts\python.exe -m pytest -v
```

To type the literal `pytest` command in a fresh Windows venv without changing
the PowerShell execution policy, use its standard batch activator in one shell:

```powershell
cmd /c "call .venv\Scripts\activate.bat && pytest"
```

The same environment can run `python -m pytest -v` through `cmd /c`.

No `.env`, application database, manual migration, provider token, live network,
running server, npm install or `PYTHONPATH` export is required for these commands.
Root `pytest.ini` configures imports and selects **only the 40 P0 cases** in
`tests/test_p0_acceptance.py` and `tests/test_s03_details.py`. It does not discover
the other `tests/`, `backend/tests/` or script regressions by default; use the
[optional regression commands](#optional-regressions) to select them explicitly.
Root `conftest.py` replaces inherited database/token/index configuration and
migrates a temporary SQLite database **before collection/application imports**,
including the default engine used by `/health`. It cleans up after the session;
existing per-case fixtures retain their own isolation. Main CI executes the
same P0 default alongside automatic lint/build/secrets checks and a few affected
storage/bootstrap tests. Broad regressions and feature/browser workflows are
manual-only via `workflow_dispatch`; teammate approval is the main-branch
requirement, with no required status contexts.

This documents the 2026-11-01 #219 scope; final acceptance results belong in the
C05 evidence. The application setup/import/index steps above remain required
for live catalogue verification and are separate from token-free automated
tests. An earlier
`test_health` 503 was a missing pytest bootstrap; manually migrating the
developer DB is not an acceptable test workaround.

For the Sprint 4 final build, persistent SQLite, consistent WAL backup,
non-destructive restore, index readiness and restart sequence, follow the
[S4-C05 release/storage runbook](s4-c05-release-storage.md). The offline
focused rehearsal is `python -m pytest -c pytest.ini backend/tests/test_storage_snapshot.py -v`.
`python -m app.cli.storage_snapshot backup <existing-db> <new-backup>` uses
SQLite's online backup API; `restore <backup> <new-db>` never overwrites an
existing database. Both operations must reject an existing destination DB or
its `-wal`, `-shm` or `-journal` sidecars, even if the DB file itself is absent.
Keep the destination unused during the operation and the resulting backup
outside Git and the public site.

### Application health or movie requests fail after pulling code

`/health` reports database connectivity and its installed revision; HTTP 200
alone does not prove that revision matches the current application models.
For example, a pre-trailer database can answer health successfully while movie
queries fail with `SERVICE_UNAVAILABLE` because `trailer_site` is missing.
From the same repository root and `.env` as the running backend, compare and
upgrade the schema before restarting the application:

```bash
python -m alembic -c backend/alembic.ini current
python -m alembic -c backend/alembic.ini heads
python -m alembic -c backend/alembic.ini upgrade head
```

On Windows without an activated venv, use `.\.venv\Scripts\python.exe` instead
of `python`. Back up existing data first. After the upgrade, `current` must match
the single `heads` result and `/health` must report that same migration version.
Verify the movie list and details through the frontend proxy as well. A schema
upgrade preserves existing media/account rows but does not fetch missing media;
use the appropriate enrichment command above. New catalogues still need the
required TMDb import and overview-index rebuild/check.

### Missing token or failed TMDb import

Configure `TMDB_READ_ACCESS_TOKEN` privately in the root `.env` or server
environment and retry the bounded import. Record authentication/network/provider
failures as failures, keep existing valid data, and follow the runbook. Do not
run the seed as a workaround for Sprint 3 acceptance.

For an authentication failure, confirm the value is the API Read Access Token
and that no stale process environment variable overrides `.env`. For a timeout
or connection failure, check HTTPS/DNS access to `api.themoviedb.org`, then
retry. Do not paste the token into a diagnostic command or issue.

On Windows, `Resolve-DnsName api.themoviedb.org` and
`Test-NetConnection api.themoviedb.org -Port 443` distinguish name resolution
from HTTPS reachability without using a token. If the hostname resolves to
`127.0.0.1` or `::1`, check the local DNS filter, VPN, security software or
network DNS settings. Restore normal DNS resolution or use another permitted
network, then confirm port 443 connects before retrying the import. Do not pin
a TMDb CDN IP in the application or commit a token to work around this failure.

### `pydantic_core._pydantic_core` is missing in a Python 3.12 environment

Check `.venv\Scripts\python.exe --version` and the files under
`.venv\Lib\site-packages\pydantic_core`. A `cp314` binary in a Python 3.12
environment means packages from another Python version were reused. Create a
fresh Python 3.12 virtual environment and repeat the locked install and
editable backend install above. Reinstalling only `pydantic_core` may leave
other compiled packages incompatible.

### `No module named 'app'` when running the bootstrap command

The command ran outside the virtual environment, or the backend package is not installed in it. Activate `.venv` and install the backend in editable mode:

```bash
python -m pip install -e "./backend[dev]" --no-deps
```

## S4-T12 watchlist setup, backup and recovery

Apply the current single Alembic head reported by `alembic heads` before
starting a server with this code; `e9b6f0a42c17` was the historical T12 head,
not the current release head. On an existing SQLite database, stop writes and make a consistent
backup using SQLite's online backup API (or copy the database plus any `-wal`
and `-shm` files while writes are stopped), then run:

```powershell
.\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini upgrade head
.\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini current
```

The migration adds `user_movie_watchlist` and indexes. It does not rewrite
catalogue IDs, accounts, sessions, genres, ratings, posters or backdrops.
Restore the backed-up database as a whole if recovery is required; do not
downgrade a populated watchlist because the downgrade drops saved rows.
After recovery, run `upgrade head` again if the backup predates this migration.
Re-importing the same provider movie preserves its internal ID and membership.

Offline verification uses synthetic temporary SQLite files and no TMDb token:

```powershell
.\.venv\Scripts\python.exe -m pytest -c pytest.ini backend/tests/test_s4_t12_watchlist.py backend/tests/test_s4_t12_watchlist_migration.py -q
cd frontend
npm.cmd test -- src/tests/watchlist.test.tsx
npm.cmd run build
```

The protected `/watchlist` route and movie-detail Add/Remove action use the
authenticated cookie. After an uncertain network result, read membership
before repeating an action. A failed database read is an error, not an empty
watchlist. Profile summary is `GET /api/me/profile`; reset remains
`POST /api/me/profile/reset` with `{ "confirm": true }`.

## T11 candidate: reset/write verification (C03 reconciled)

This branch changes transaction coordination, not database schema or the TMDb
catalogue. No new migration, import, package or `.env` field is required for T11.
Keep the existing `DATABASE_URL` and accepted imported catalogue. Do not reset
the real review account or reseed its database merely to test this task.

Reset, preference replacement and rating writes use a request-local SQLite
`BEGIN IMMEDIATE` reservation before decision reads. The configured busy timeout
is 5 seconds and the existing journal mode is preserved. During writer
contention another account may queue; a bounded failure returns the existing
safe 503 error, without partial reset or invented success. Do not automatically
retry a destructive request after an ambiguous client timeout.

Offline verification creates its own migrated file databases and synthetic A/B
accounts, needs no running server or TMDb token, and exercises DELETE/WAL plus
a competing writer in a separate process:

```powershell
.\.venv\Scripts\python.exe -m pytest -c pytest.ini backend/tests/test_profile_reset_concurrency.py backend/tests/test_account_write_transactions.py backend/tests/test_profile_reset_api.py -v
.\.venv\Scripts\python.exe backend/scripts/run_isolated_tests.py -q
.\.venv\Scripts\python.exe -m ruff check backend
```

See [reset/concurrency contract](reset-concurrency-contract.md) and
[actual evidence](evidence/s4-t11-reset-concurrency.md). T11 does not implement a
new Profile screen; #207/#208/#209/#210 own the remaining summary/UI/watchlist
and browser acceptance. Merged C03 #217 section 13.4 / architecture section 9.1
are incorporated without changing those contracts. Obtain independent review
and passing required checks before merging. Final C05 root-pytest setup remains
its own task, not an additional T11 dependency.


## T16 Popular carousel and compact collection headings

Update this branch, then restart the backend and frontend so both consume the
additive nullable `backdropUrl` in movie summaries. This UI follow-up needs no
new migration, import or NLP index rebuild; existing imported backdrops work.
The first three movies on each Popular page form its manual carousel. Page 2
starts at catalogue rank #11 (with the normal ten-per-page setting).
Missing/failed artwork uses the gradient fallback. Search still runs only on
Enter/Search, and My watchlist remains account-owned and persistent.
See [the UI handoff and checks](evidence/s4-t16-spotlight.md).

## T16 consumer amendment: catalogue, half stars and explicit Search

The T16 half-star migration is `f2c7e4a91b60`, following watchlist revision
`e9b6f0a42c17`; later migrations extend it. Always resolve the current head with
`alembic heads`. Existing users, rating IDs, values/timestamps, preferences and
watchlists are preserved. Back up valuable SQLite databases before upgrading;
use SQLite's backup API (or stop both servers before copying the file). A
downgrade is deliberately refused while half-star ratings exist, rather than
silently rounding or deleting feedback. Never downgrade the working database
just to test the migration.

After every successful import, rebuild and check the shared overview index
as shown above before starting/restarting the backend. A changed catalogue
revision makes the old artifact stale. Runtime Search/Similar use this local
index; Next/Previous never import TMDb movies.

Search keeps typed text local. Press Enter or choose Search to commit the
query and fetch results; browser Back and return from details restore the last
submitted query. Direct links with a valid `q` still load their results.

Half-star feedback preserves the ranking thresholds: 0.5–2 are negative,
2.5–3.5 neutral, and 4–5 positive. Unrated remains `null`, never 0. A confirmed
Save is required; reload/login restore the server value.

Search now exposes every matching local movie through numbered pages,
Previous and Next (ten per page). The total counts matches, not all catalogue
movies. Enter/Search commits a query; typing does not fetch. A new query starts
at page 1, and returning from details restores the submitted query and page.
No migration, new dependency or re-import is needed for this Search change.
