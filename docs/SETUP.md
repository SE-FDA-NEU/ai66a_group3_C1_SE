# Setup

From Sprint 3 these steps prepare the application with a required TMDb-imported
catalogue. Running the importer needs a valid private Read Access Token and
network access to TMDb. Automated checks use synthetic fixtures/mocks and no
live token/provider network. The decision is in [design.md](design.md); manual
smoke/provenance and verification ownership are in the [runbook](tmdb-sprint3-runbook.md).

## Prerequisites

| Tool | Version | Check (macOS/Linux) | Check (Windows PowerShell) |
|---|---|---|---|
| Git | Any recent version | `git --version` | `git --version` |
| Python | 3.12 | `python3.12 --version` | `py -3.12 --version` |
| Node.js | 24 | `node --version` | `node --version` |
| npm | Installed with Node.js | `npm --version` | `npm --version` |

Backend dependencies are pinned in `backend/requirements.lock.txt` and frontend dependencies in `frontend/package-lock.json`.

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
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.lock.txt
python -m pip install -e "./backend[dev]" --no-deps

npm --prefix frontend ci

python -m alembic -c backend/alembic.ini upgrade head
python -m app.cli.import_tmdb_catalogue
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
must not fall back to seed. T29 owns any missing guidance/checks.

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

Use two terminals, both opened in the repository root. The backend terminal needs the virtual environment active (`source .venv/bin/activate` or `.\.venv\Scripts\Activate.ps1`).

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
the expected Sprint 3 TMDb catalogue. New Sprint 3 routes still require their
own implementation and acceptance evidence.

## Verify

With the virtual environment active:

```bash
python -m pytest backend/tests -v
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

Historical results on commit `4bfae7c`: 100 backend tests passed and 2 skipped,
and 41 frontend tests passed across 5 files. These are not current-candidate
results. For automated verification use a separate test database with migrations
applied (`test_health` reads its migration table), a blank token and synthetic
provider fixtures/mocks. No live import is part of CI; manual live smoke remains
required separately for dev/staging/demo acceptance.

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

### `No module named 'app'` when running the bootstrap command

The command ran outside the virtual environment, or the backend package is not installed in it. Activate `.venv` and install the backend in editable mode:

```bash
python -m pip install -e "./backend[dev]" --no-deps
```

