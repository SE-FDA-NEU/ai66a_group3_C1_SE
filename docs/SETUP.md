# Setup

From Sprint 3 these steps prepare the application with a required TMDb-imported
catalogue. Running the importer needs a valid private Read Access Token and
network access to TMDb. Automated checks use synthetic fixtures/mocks and no
live token/provider network. The decision is in [design.md](design.md); manual
smoke/provenance and verification ownership are in the [runbook](tmdb-sprint3-runbook.md).

Tested by: Codex, Sprint 3, 2026-10-18, Windows PowerShell,
Python 3.12.10 / Node.js 24.15.0, base SHA
`86a758eb2468f3e23357b69adf3c3183e5110a40` plus uncommitted changes on
`chore/s3-c04-clean-clone-ci-135`; [clean-clone results and remaining review checks](evidence/s3-c04-clean-clone.md).

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

For an instructor on a new machine, the instructor or staging operator signs in
to their own TMDb account, opens **Settings → API**, requests API access if
needed, and copies the **API Read Access Token** into their private root `.env`.
TMDb documents this in its [API authentication guide](https://developer.themoviedb.org/v4/docs/authentication-application)
and [API key FAQ](https://developer.themoviedb.org/docs/faq). This is the Bearer
read token, not the v3 API key. The machine must be able to reach
`https://api.themoviedb.org` over HTTPS during import. If the instructor cannot
obtain a token or reach TMDb, an operator can prepare a private staging backend
with an accepted imported catalogue for review; do not share a team token or
claim that a token-free clean clone has completed the live-import check.

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
```

### Windows PowerShell

```powershell
git clone https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE.git
cd ai66a_group3_C1_SE

Copy-Item .env.example .env
New-Item -ItemType Directory -Force data

py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.lock.txt
.\.venv\Scripts\python.exe -m pip install -e "./backend[dev]" --no-deps

npm.cmd --prefix frontend ci

.\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini upgrade head
.\.venv\Scripts\python.exe -m app.cli.import_tmdb_catalogue
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
replace `python` in backend commands with `.\.venv\Scripts\python.exe`.

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

Use a new local database and a disposable email address you control. In the
browser, open **Create account** (`/register`), enter that address and a unique
password of at least eight characters, then sign in at `/login`. Keep the
password private and do not publish it as a demo credential. From the visible
home navigation, open **My preferences**, save genre choices, open **My
recommendations**, view a movie's details and use its return link. Refresh and
restart both servers, sign in again, and confirm the saved preferences and any
ratings you entered remain. Use a separate account to check that personal data
does not appear for another user. The account is disposable with the local
database; for instructor review, create a new account during the session or
arrange private credentials for a staging-only account.

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

