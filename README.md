# AI Movie Recommendation System

For university students facing choice overload, this system turns a small set of
genre preferences and optional ratings into transparent movie recommendations,
rather than giving every viewer the same generic popularity list.

## Team and Sprint 1 roles

| Member           | GitHub                                                       | Sprint 1 responsibility                                   |
| ---------------- | ------------------------------------------------------------ | --------------------------------------------------------- |
| Nguyen Xuan Kiet | [`@kietxuan`](https://github.com/kietxuan)                   | Product Owner; C01 backlog refinement                     |
| Tran Minh Hoang  | [`@hoang3003`](https://github.com/hoang3003)                 | Scrum Master; C02 Sprint 1 wrap-up                        |
| Tran Tuan Anh    | [`@anotify-vie`](https://github.com/anotify-vie)             | C03 user research, personas, and scenarios                |
| Vu Quoc Huy      | [`@vu-huzy`](https://github.com/vu-huzy)                     | C04 M1 requirements-document integration                  |
| Nguyen Tuan Anh  | [`@NguyenTuanAnh0608`](https://github.com/NguyenTuanAnh0608) | C05 repository readiness, rules, routes, and traceability |

## Project management

- Repository: [SE-FDA-NEU/ai66a_group3_C1_SE](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE)
- Project board: [@group3_c1_se — Project 9](https://github.com/orgs/SE-FDA-NEU/projects/9)
- Product backlog: 14 Story Issues, #17–#24, #30–#33, #44 and #45 (54 points).
  The six P0 Stories are S01–S04, S12 and S13; S06 is P1.

## Requirements references

- [Product scope](docs/product-scope.md)
- [Business rules with worked examples](docs/business-rules.md)
- [Route and Story traceability](docs/traceability.md)
- [M2 architecture and ownership contract](docs/architecture.md)
- [M2 auth, catalogue, and recommendation API contract](docs/api.md)
- [Definition of Done](docs/definition-of-done.md)
- [Sprint log](docs/sprint-log.md)

## Definition of Done

A Story is Done only when every acceptance criterion passes, the feature runs from
a clean clone using this README, an automated test covers the changed behaviour, CI
is green, a teammate who did not author the change approves the PR, the PR is merged
to `main`, no secret or database dump is committed, and traceability is updated when
a route or screen changes. The full checklist is in
[docs/definition-of-done.md](docs/definition-of-done.md).

## Setup

The C03 architecture contract selects the intended Sprint 2 stack and command
interface in [docs/architecture.md](docs/architecture.md). At the current base
commit, the repository still contains requirements and delivery-process
scaffolding only: no application manifest, source directory, migration, or
verified runtime command exists. S2-C04 (#70) must create and independently
verify those runtime outputs before this section can present them as working.

```bash
git clone https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE.git
cd ai66a_group3_C1_SE
```

# AI Movie Recommendation System (Sprint 2)

## Overview

Sprint 2 C04 bootstraps the shared runtime and development environment for the project.

The selected stack is:

### Backend

- Python 3.12
- FastAPI
- Pydantic
- Uvicorn
- SQLAlchemy
- Alembic
- SQLite

### Frontend

- Node.js 24
- React
- TypeScript
- Vite
- React Router

### Testing

- pytest
- Vitest
- React Testing Library

During local development, Vite proxies `/api` requests to the FastAPI server.


## Requirements

Install the following before running the project:

- Python 3.12
- Node.js 24
- npm

Check the installed versions.

### macOS/Linux

```bash
python3.12 --version
node --version
npm --version
```

### Windows PowerShell

```powershell
py -3.12 --version
node --version
npm --version
```


## Environment Setup

The project uses a local `.env` file for runtime configuration.

### macOS/Linux

From the repository root:

```bash
cp .env.example .env
mkdir -p data
```

### Windows PowerShell

From the repository root:

```powershell
Copy-Item .env.example .env
New-Item -ItemType Directory -Force data
```

The default local configuration is:

```env
DATABASE_URL=sqlite:///./data/app.db
TMDB_READ_ACCESS_TOKEN=
```

`TMDB_READ_ACCESS_TOKEN` is only required for server-side TMDb import functionality.

Do not commit:

- `.env`
- TMDb access tokens
- API keys
- SQLite database files
- database dumps


## Backend Setup

### 1. Create a virtual environment

#### macOS/Linux

```bash
python3.12 -m venv .venv
source .venv/bin/activate
```

#### Windows PowerShell

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 2. Install locked backend dependencies

After activating the virtual environment:

```bash
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.lock.txt
python -m pip install -e "./backend[dev]" --no-deps
```

`backend/requirements.lock.txt` contains pinned third-party Python dependencies used for reproducible installation.

The lockfile must not contain an editable Git reference to the project itself. The final command installs the local backend package in editable mode without resolving dependencies again.


## Frontend Setup

Install frontend dependencies from the lockfile:

```bash
npm --prefix frontend ci
```

The frontend uses `frontend/package-lock.json` to keep dependency versions reproducible.


## Database Setup

The local SQLite database is stored at:

```text
data/app.db
```

If the `data` directory was not created during environment setup, create it first.

### macOS/Linux

```bash
mkdir -p data
```

### Windows PowerShell

```powershell
New-Item -ItemType Directory -Force data
```

Apply all database migrations:

```bash
python -m alembic -c backend/alembic.ini upgrade head
```

C04 only bootstraps the shared migration system. Feature-specific schemas, such as account and catalogue tables, are owned by their corresponding Sprint tasks.


## Run the Backend

From the repository root with the Python virtual environment activated:

```bash
python -m uvicorn app.main:app --app-dir backend --reload
```

The backend runs at:

```text
http://127.0.0.1:8000
```

FastAPI documentation is available at:

```text
http://127.0.0.1:8000/docs
```

Keep this terminal running while developing or testing the frontend against the backend.


## Health Check

Apply the database migrations before starting the backend.

After the backend is running, open:

```text
http://127.0.0.1:8000/health
```

The health endpoint verifies database connectivity by reading the Alembic migration state from the database.

Example response:

```json
{
  "status": "ok",
  "database": "connected",
  "migrationVersion": "<current-migration-revision>"
}
```

`migrationVersion` should contain the currently applied Alembic revision and should not be `null` after migrations have been applied.


## Run the Frontend

Open a second terminal from the repository root while keeping the backend running.

Start the Vite development server:

```bash
npm --prefix frontend run dev
```

The frontend runs at:

```text
http://localhost:5173
```

During local development, requests beginning with:

```text
/api
```

are proxied by Vite to:

```text
http://127.0.0.1:8000
```

Frontend code should therefore use relative API paths such as:

```ts
fetch("/api/auth/me")
```

instead of hardcoding the backend host.


## Run Backend Tests

Make sure the virtual environment is activated and database migrations have been applied.

```bash
python -m pytest backend/tests -v
```

The backend test suite includes runtime and database-backed health verification.


## Run Frontend Tests

```bash
npm --prefix frontend test
```


## Lint Backend

```bash
python -m ruff check backend
```

Expected result:

```text
All checks passed!
```


## Lint Frontend

```bash
npm --prefix frontend run lint
```


## Build Frontend

```bash
npm --prefix frontend run build
```

The production frontend output is generated under:

```text
frontend/dist/
```

The generated `frontend/dist/` directory should not be committed.


## Full Local Verification

The following sequence reproduces the development environment from a clean clone.

### macOS/Linux

#### 1. Create the environment configuration and local data directory

```bash
cp .env.example .env
mkdir -p data
```

#### 2. Create and activate the Python virtual environment

```bash
python3.12 -m venv .venv
source .venv/bin/activate
```

#### 3. Install locked backend dependencies

```bash
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.lock.txt
python -m pip install -e "./backend[dev]" --no-deps
```

#### 4. Install frontend dependencies

```bash
npm --prefix frontend ci
```

#### 5. Apply database migrations

```bash
python -m alembic -c backend/alembic.ini upgrade head
```

#### 6. Run backend lint

```bash
python -m ruff check backend
```

#### 7. Run backend tests

```bash
python -m pytest backend/tests -v
```

#### 8. Run frontend lint

```bash
npm --prefix frontend run lint
```

#### 9. Run frontend tests

```bash
npm --prefix frontend test
```

#### 10. Build the frontend

```bash
npm --prefix frontend run build
```

### Windows PowerShell

#### 1. Create the environment configuration and local data directory

```powershell
Copy-Item .env.example .env
New-Item -ItemType Directory -Force data
```

#### 2. Create and activate the Python virtual environment

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
```

#### 3. Install locked backend dependencies

```powershell
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.lock.txt
python -m pip install -e "./backend[dev]" --no-deps
```

#### 4. Install frontend dependencies

```powershell
npm --prefix frontend ci
```

#### 5. Apply database migrations

```powershell
python -m alembic -c backend/alembic.ini upgrade head
```

#### 6. Run backend lint

```powershell
python -m ruff check backend
```

#### 7. Run backend tests

```powershell
python -m pytest backend/tests -v
```

#### 8. Run frontend lint

```powershell
npm --prefix frontend run lint
```

#### 9. Run frontend tests

```powershell
npm --prefix frontend test
```

#### 10. Build the frontend

```powershell
npm --prefix frontend run build
```

If all commands pass, the local runtime matches the checks used by CI.

To run the application after verification, use two terminals:

**Terminal 1 — Backend**

```bash
python -m uvicorn app.main:app --app-dir backend --reload
```

**Terminal 2 — Frontend**

```bash
npm --prefix frontend run dev
```


## CI

GitHub Actions runs automatically on pushed branches and pull requests.

The CI workflow verifies the following.

### Stack Detection

- `backend/pyproject.toml`
- `frontend/package.json`

### Backend

- Python 3.12 setup
- locked dependency installation
- database migration
- Ruff lint
- pytest

### Frontend

- Node.js 24 setup
- `npm ci`
- frontend lint
- Vitest tests
- frontend production build

### Repository Safety

CI also checks that obvious credentials and forbidden local files are not committed.

The repository must not contain tracked:

```text
.env
*.db
*.sqlite
*.sqlite3
*.dump
```


## Verify No Local Database or Environment Files Are Tracked

### macOS/Linux

```bash
git ls-files | grep -E '(^|/)\.env$|\.db$|\.sqlite$|\.sqlite3$|\.dump$'
```

Expected result: no output.

### Windows PowerShell

```powershell
git ls-files | Select-String -Pattern '(^|/)\.env$|\.db$|\.sqlite$|\.sqlite3$|\.dump$'
```

Expected result: no output.


## Verify TMDb Credentials Are Not Committed

Run:

```bash
git grep "TMDB_READ_ACCESS_TOKEN"
```

It is valid for the environment-variable name to appear in:

- `.env.example`
- runtime configuration
- CI configuration
- project documentation

A real TMDb token must never appear in the repository.


## Project Structure

The C04 runtime bootstrap provides the following shared structure:

```text
.
├── backend/
│   ├── alembic/
│   │   ├── versions/
│   │   ├── env.py
│   │   └── script.py.mako
│   ├── app/
│   │   ├── db/
│   │   │   ├── __init__.py
│   │   │   └── database.py
│   │   ├── __init__.py
│   │   └── main.py
│   ├── tests/
│   ├── alembic.ini
│   ├── pyproject.toml
│   └── requirements.lock.txt
│
├── frontend/
│   ├── src/
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.ts
│
├── data/
│   └── .gitkeep
│
├── .env.example
├── .gitignore
└── README.md
```

Feature-specific backend modules and user-facing UI are implemented by their corresponding Sprint tasks and should not be added to C04 simply to extend the bootstrap scope.