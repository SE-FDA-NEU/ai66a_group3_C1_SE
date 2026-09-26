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

# AI Movie Recommendation System (Spint 2)

## Overview

Sprint 2 C04 bootstraps the shared runtime and development environment for the project.

The selected stack is:

### Backend

* Python 3.12
* FastAPI
* Pydantic
* Uvicorn
* SQLAlchemy
* Alembic
* SQLite

### Frontend

* Node.js 24
* React
* TypeScript
* Vite
* React Router

### Testing

* pytest
* Vitest
* React Testing Library

During local development, Vite proxies `/api` requests to the FastAPI server.


## Requirements

Install the following before running the project:

* Python 3.12
* Node.js 24
* npm

Check installed versions:

```bash
python3.12 --version
node --version
npm --version
```


## Environment Setup

From the repository root, create the local environment file:

```bash
cp .env.example .env
```

The local configuration uses:

```env
DATABASE_URL=sqlite:///./data/app.db
TMDB_READ_ACCESS_TOKEN=
```

`TMDB_READ_ACCESS_TOKEN` is only required for server-side TMDb import functionality.

Do not commit:

* `.env`
* TMDb access tokens
* API keys
* SQLite database files
* database dumps


## Backend Setup

### 1. Create a virtual environment

From the repository root:

```bash
python3.12 -m venv .venv
```

Activate it on macOS/Linux:

```bash
source .venv/bin/activate
```

### 2. Install locked backend dependencies

```bash
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.lock.txt
python -m pip install -e "./backend[dev]" --no-deps
```

`backend/requirements.lock.txt` contains the resolved Python dependency versions used for reproducible installation.


## Frontend Setup

Install frontend dependencies from the lockfile:

```bash
npm --prefix frontend ci
```

The frontend uses `frontend/package-lock.json` to keep dependency versions reproducible.


## Database Setup

The local database is stored at:

```text
data/app.db
```

Create the local data directory if it does not already exist:

```bash
mkdir -p data
```

Apply all database migrations:

```bash
python -m alembic -c backend/alembic.ini upgrade head
```

C04 only bootstraps the migration system.

Feature-specific schemas such as account and catalogue tables are owned by their corresponding Sprint tasks.


## Run the Backend

From the repository root:

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


## Health Check

After migrations have been applied and the backend is running, open:

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

The migration revision value depends on the current Alembic migration.


## Run the Frontend

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

The generated build directory should not be committed.


## Full Local Verification

From a clean clone, the following sequence should reproduce the development setup.

### 1. Create environment configuration

```bash
cp .env.example .env
```

### 2. Create the Python virtual environment

```bash
python3.12 -m venv .venv
source .venv/bin/activate
```

### 3. Install backend dependencies

```bash
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.lock.txt
python -m pip install -e "./backend[dev]" --no-deps
```

### 4. Install frontend dependencies

```bash
npm --prefix frontend ci
```

### 5. Create the local database directory

```bash
mkdir -p data
```

### 6. Apply database migrations

```bash
python -m alembic -c backend/alembic.ini upgrade head
```

### 7. Run backend lint

```bash
python -m ruff check backend
```

### 8. Run backend tests

```bash
python -m pytest backend/tests -v
```

### 9. Run frontend lint

```bash
npm --prefix frontend run lint
```

### 10. Run frontend tests

```bash
npm --prefix frontend test
```

### 11. Build the frontend

```bash
npm --prefix frontend run build
```

If all commands pass, the local runtime matches the checks used by CI.


## CI

GitHub Actions runs automatically on pushed branches and pull requests.

The CI workflow verifies:

### Stack Detection

* `backend/pyproject.toml`
* `frontend/package.json`

### Backend

* Python 3.12 setup
* locked dependency installation
* database migration
* Ruff lint
* pytest

### Frontend

* Node.js 24 setup
* `npm ci`
* frontend lint
* Vitest tests
* frontend production build

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

Run:

```bash
git ls-files | grep -E '(^|/)\.env$|\.db$|\.sqlite$|\.sqlite3$|\.dump$'
```

Expected result:

```text
no output
```


## Verify TMDb Credentials Are Not Committed

Run:

```bash
git grep "TMDB_READ_ACCESS_TOKEN"
```

It is valid for the environment-variable name to appear in:

* `.env.example`
* runtime configuration
* CI configuration
* project documentation

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

Feature-specific modules and UI are implemented by their corresponding Sprint tasks and should not be added to C04 simply to extend the bootstrap scope.

