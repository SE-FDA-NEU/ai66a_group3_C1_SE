# Setup

These steps take a fresh clone to a running application with ten movie cards on the home page. They need no TMDb token and no network access beyond downloading packages. The design behind them is in [design.md](design.md).

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

Copy it to `.env` and leave the token empty. `TMDB_READ_ACCESS_TOKEN` is read only by the optional TMDb importer. `.env` is ignored by Git and must not be committed.

## Steps

Run every command from the repository root.

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

python -m app.cli.bootstrap_m2_catalogue
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

python -m app.cli.bootstrap_m2_catalogue
```

## Expected seed count

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
{"status":"ok","database":"connected","migrationVersion":"8c1e2f4a7b90"}
```

Open `http://localhost:5173/`. The page shows the heading "Find your next movie" and ten movie cards, starting with Northstar Protocol (2024) and ending with Orbit of Us (2020). Each card has a "View details" link. The list matches the screenshot in [design.md](design.md#4-walking-skeleton).

## Verify

With the virtual environment active:

```bash
python -m pytest backend/tests -v
python -m ruff check backend
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run build
```

Expected on commit `4bfae7c`: 100 backend tests passed and 2 skipped, Ruff reports "All checks passed!", and 41 frontend tests passed across 5 files. Lint and build exit with code 0. Run the bootstrap command first, because `test_health` reads the migration table of the configured database.

## Troubleshooting

### `/health` returns 503, or `test_health` fails with 503

The database has no migration table, so the migrations have not been applied. The response is `503` with the code `SERVICE_UNAVAILABLE`. Run the bootstrap command from the steps above, or apply the migrations alone:

```bash
python -m alembic -c backend/alembic.ini upgrade head
```

Then open `/health` again. `migrationVersion` should be `8c1e2f4a7b90`.

### `No module named 'app'` when running the bootstrap command

The command ran outside the virtual environment, or the backend package is not installed in it. Activate `.venv` and install the backend in editable mode:

```bash
python -m pip install -e "./backend[dev]" --no-deps
```

