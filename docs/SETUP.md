# Setup

From Sprint 3 these steps prepare the application with a required TMDb-imported
catalogue. Running the importer needs a valid private Read Access Token and
network access to TMDb. Automated checks use synthetic fixtures/mocks and no
live token/provider network. The decision is in [design.md](design.md); manual
smoke/provenance and verification ownership are in the [runbook](tmdb-sprint3-runbook.md).

Earlier clean-clone baseline tested by: Codex, Sprint 3, 2026-10-18, Windows PowerShell,
Python 3.12.6 / Node.js 24.19.0 / Microsoft Edge 155.0.4283.62, committed
application and verification-code SHA
`05dda34900fd0fa80cfff323b353a8d4c220a4d8`.
A fresh clone with new locked dependencies, a new TMDb database and an actual
browser/process-restart journey passed for that earlier candidate. Its original
documentation follow-up did not change executable code. See the [clean-clone record](evidence/s3-c04-clean-clone.md)
for the source fingerprint, provenance, screenshots, CI links and independent-review gate.

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
python -m app.cli.import_tmdb_catalogue
python -m app.cli.create_review_account --confirm-local-demo
```

### Windows PowerShell

```powershell
git clone https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE.git
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
.\.venv\Scripts\python.exe -m app.cli.import_tmdb_catalogue
.\.venv\Scripts\python.exe -m app.cli.create_review_account --confirm-local-demo
```

To use a larger catalogue, run `python -m app.cli.import_tmdb_catalogue --pages 13`
instead of the default import command (roughly 260 movies; 1–15 pages allowed).
Back up an existing database first. Reuse `--pages 13` on subsequent refreshes;
omitting it returns to a one-page active snapshot. Accounts, preferences and
ratings are retained, and runtime list limits remain unchanged. See the
[TMDb runbook](tmdb-sprint3-runbook.md) for the bounded import contract.

To add backdrops to an already imported active TMDb catalogue without changing
its revision or accounts, use the bounded
[backdrop enrichment command](backdrop-import-runbook.md#bounded-enrichment-for-an-existing-active-catalogue).

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

Before accepting the environment, verify provider/source=tmdb, source IDs,
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
{"status":"ok","database":"connected","migrationVersion":"c6f8a2d4e901"}
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
If it already has saved preferences, it may open personalised results rather
than cold start; that is persistence, not failed setup. Do not clear existing
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
   opens recommendations; a new account sees **Popular** / **Not personalised**.
3. Select **Enter preferences →**. Select one to five genres and choose **Save
   preferences**. Expect **Recommended for you** and matching movie cards.
   From the home page the equivalent entry is **Start**; from recommendations
   use **Change my genres**. There is no **My preferences** control.
4. Open **View details** on a recommendation card. Confirm the movie title,
   genres and overview; missing optional fields use **Information unavailable**.
5. Select `4 / 5` under **Your rating (1 to 5)** and choose **Save rating**.
   Wait for **Your saved rating: 4/5** and **Rating saved.**; a selected draft
   alone is not proof of persistence.
6. Use **Back to recommendations**, then **Change my genres**. Confirm the saved
   selections remain checked; use **Back to recommendations** to return.
7. Select **Sign out**, which returns to the public home page. Stop the backend
   and frontend with Ctrl+C in their own terminals. Start both again using the
   commands above, on the **same database**. Do not reseed, reimport or reset it.
8. In a fresh browser session, open the home page, select **Sign in**, and sign
   in as the same account. Use **Change my genres** to confirm restored choices;
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

With the virtual environment active:

```bash
python backend/scripts/run_isolated_tests.py -v
python -m ruff check backend
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run build
```

For the S3-T33 rating UI/API/database acceptance journey, after installing both
locked runtimes, also run from the repository root:

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

The backend command creates and migrates a temporary SQLite database, clears the
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

## Troubleshooting

### `/health` returns 503, or `test_health` fails with 503

The database has no migration table, so the migrations have not been applied.
The response is `503` with the code `SERVICE_UNAVAILABLE`. Apply migrations:

```bash
python -m alembic -c backend/alembic.ini upgrade head
```

Then open `/health` again. `migrationVersion` should be `c6f8a2d4e901`.

This is the Sprint 3 head through T26 nullable backdrop storage, extending T30
rating storage. Existing checkouts must apply the upgrade before restarting
the application with the new model. No dependency reinstall, token or catalogue
reimport is needed for this storage-only upgrade; preserve the existing `.env`
and back up valuable data consistently first. Existing backdrop values remain
null until #130 imports them, so no image is expected on screen from T26 alone.
See [the storage handoff](backdrop-storage-contract.md) for focused tests.
Verify the actual head if later migrations are added. A healthy database alone does not
prove catalogue readiness; dev/staging/demo still needs the successful TMDb
import and provenance smoke.

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

