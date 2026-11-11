**Running app: [https://cineai-o9tf.onrender.com/](https://cineai-o9tf.onrender.com/)**

[![CI](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/workflows/ci.yml)

# CineAI — AI Movie Recommendation System

Movie discovery for university students: browse real TMDb movies, choose genres
and use optional ratings to receive explainable recommendations.

**Public test account:** `kietxuan@gmail.com` / `123456789` — application user,
the only app role. These PO-approved credentials are for this project's demo
only. For registration/cold-start checks, choose **Create account** instead.

**Team 03:** Nguyen Xuan Kiet (11247306, [@kietxuan](https://github.com/kietxuan));
Tran Minh Hoang (11247292, [@hoang3003](https://github.com/hoang3003));
Tran Tuan Anh (11247264, [@anotify-vie](https://github.com/anotify-vie));
Vu Quoc Huy (11247301, [@vu-huzy](https://github.com/vu-huzy));
Nguyen Tuan Anh (11247260, [@NguyenTuanAnh0608](https://github.com/NguyenTuanAnh0608)).
**Product Owner and Sprint 5 Scrum Master: @kietxuan.**

<a id="sprint-3-review--start-here"></a>

## P0 stories — start from Home

Use the public URL above and visible buttons; no feature URL needs to be typed.
Signing in normally returns to Home; choose Preferences or My recommendations
when you want them. Protected destinations may return you to the requested page.

| P0 Story | Start from Home and click |
| --- | --- |
| [S01 — Select favourite genres #17](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/17) | Sign in → Start or Preferences → select 1–5 genres → Save preferences |
| [S02 — Get personalised recommendations #18](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/18) | Save preferences → My recommendations; inspect reasons, filters and pages |
| [S03 — View movie details #19](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/19) | View details on a visible movie card → return to the originating list |
| [S04 — Explore without preferences #20](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/20) | Popular movies without login; for the account cold-start path, create/sign in to an account without saved genres → My recommendations → Popular / Not personalised |
| [S12 — Register an account #44](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/44) | Create account → enter valid email/password → submit |
| [S13 — Sign in and sign out #45](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/45) | Sign in → use the signed-in navigation → Sign out |

[Setup guide](docs/SETUP.md) · [Operations](docs/operations.md) ·
[P0 test cases](docs/testing.md#2-test-cases-for-every-p0-story) ·
[Project board](https://github.com/orgs/SE-FDA-NEU/projects/9)

## Current public release and M5 status

Verified on **11 November 2026**: Render Free/Singapore, live application commit
`acc49243e4db404438b00521c2f7a6234377fb18`, Neon PostgreSQL 18.6,
989 active TMDb movies and 2,967 US/GB/SG availability checks.
[Source CI](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/43025094939)
and [deployment/data evidence](docs/evidence/s5-c02/README.md) identify that
observation; later documentation commits do not automatically identify the app.

Kiet reports phone/private-laptop checks OK and explicitly accepts acc4924;
[release v1.0](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/releases/tag/v1.0)
targets that running commit. Branch-protection evidence, durable recovery
handoff, final documentation review and manual submission remain tracked in
[C02 #256](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/256) and the
[C02 wrap-up](docs/s5-c02-wrap-up.md). This README does not claim M5 is finished.
The free service may take about a minute to wake after inactivity.

[Health endpoint](https://cineai-o9tf.onrender.com/health) returns HTTP 200 when
the database/schema/required-table checks pass, otherwise 503. The required
release identity is **running app commit = v1.0 target**. After a docs-only merge,
record the latest documentation-main SHA/CI separately; see
[release policy](docs/s5-c02-wrap-up.md#deploy-first-document-afterward--po-amendment).
Keep the site available until grades are published and the group's longer
retention commitment is fulfilled; [owners and schedule](docs/operations.md#5-maintenance-plan).

## Sprint history

### Sprint 1 — Requirements and product backlog

Defined the student problem/personas, scope, business rules, Stories, priorities,
traceability and Definition of Done. PO: @kietxuan; SM1: @hoang3003.
[Scope](docs/product-scope.md) · [Business rules](docs/business-rules.md) ·
[Traceability](docs/traceability.md) · [Sprint 1 record](docs/sprint-log.md#sprint-1---repository-activity-recorded-2026-09-08-to-2026-09-20).

### Sprint 2 — Design and walking skeleton

Established architecture/module/API contracts, catalogue/account persistence,
server-side TMDb import and the initial frontend/backend/CI walking skeleton.
PO: @kietxuan; SM2: @NguyenTuanAnh0608.
[Design](docs/design.md) · [Architecture](docs/architecture.md) ·
[API](docs/api.md) · [Sprint 2 record](docs/sprint-log.md#sprint-2---repository-activity-recorded-2026-09-24-to-2026-10-02).
These living design documents also contain explicitly dated later amendments.

### Sprint 3 — Usable P0 journeys and real movie data

**05–18 October 2026**, PO-confirmed; PO: @kietxuan; SM3: @vu-huzy.
Delivered integrated preferences/recommendations, authenticated persistence,
filtering/pagination/return context, ratings storage/UI, real TMDb catalogue
and movie-detail backdrops. Historical board date labels are not the confirmed
Sprint dates. [UI dossier](docs/ui.md) ·
[Planning/reconciliation](docs/sprint3-backlog-refinement.md) ·
[Sprint 3 record](docs/sprint-log.md#sprint-3---2026-10-05-to-2026-10-18).

### Sprint 4 — Discovery, interface and tested business rules

Planning: 20 October; reported Review/Retro: 1 November 2026.
PO: @kietxuan; SM4: @anotify-vie.
Added rating-aware ranking, shared TF-IDF Search/Similar, persistent Watchlist,
Profile/reset preserving Watchlist, light/dark redesign, posters, half-star
explicit-save ratings and embedded official trailers. Preserve each feature's
recorded acceptance boundaries rather than treating this summary as new evidence.
[Planning](docs/sprint4-backlog-refinement.md) · [Testing dossier](docs/testing.md) ·
[Sprint 4 record](docs/sprint-log.md#sprint-4--wrap-up-cutoff-1-november-2026).

### Sprint 5 — Public deployment, regional availability and release

**5–12 November 2026**, Planning 6 November; PO/SM5: @kietxuan.
Moved public persistence to PostgreSQL 18/Neon, deployed to Render, added
US/GB/SG availability and validated TMDb watch-options links, and prepared
monitoring/recovery/operations and the M5 handoff. C01/T01–T08 are Closed;
C02 remains Open for the remaining administrative/operational/submission
gates; PO acceptance and v1.0 publication are now recorded.
[Planning](docs/sprint5-backlog-refinement.md) · [Operations](docs/operations.md) ·
[C02](docs/s5-c02-wrap-up.md) ·
[Five-Sprint metrics](docs/sprint-log.md#c02-current-delivery-and-five-sprint-reconciliation--11-november-2026).

## Application behaviour

- Home browses the imported catalogue by title A–Z or Z–A; Popular orders by
  TMDb popularity. Recommendations rank eligible account results before genre
  filtering and pagination. Details returns to the retained list context.
- Ratings use 0.5–5 stars and an explicit Save rating action. Watchlist is
  account-owned and persistent; adding a movie does not alter ranking. Reset
  clears the account's genres/ratings and keeps its Watchlist.
- Search runs on submit, with pagination over all eligible title/overview
  matches. Similar uses the shared versioned overview TF-IDF index.
- Details uses actual TMDb posters/backdrops with honest image fallbacks,
  plus an optional official YouTube trailer below the poster, played in-page.
  Missing trailers are described rather than replaced with unrelated videos.
- Where to watch supports **US (default), GB and SG**, with a browser-persisted
  country selector. Provider badges are informational. One validated movie/market
  action opens **View watch options on TMDb** in a new tab. Missing availability
  means unknown data, not "nowhere to watch". TMDb/JustWatch attribution stays visible.
- Metadata comes from the imported database at runtime. Private TMDb credentials
  are used by operator CLIs, never frontend variables or per-page metadata fetches.

To demonstrate validation, use the genre picker with no genres selected and
choose Save preferences. Expected message:
`Select at least one genre (up to 5), then choose Save preferences.`
For a server-side refusal, register a duplicate synthetic email and inspect its
actionable response. Use the full [P0 normal/error/boundary map](docs/testing.md).

## Setup

Use [docs/SETUP.md](docs/SETUP.md) for the maintained, platform-specific steps,
expected output and troubleshooting. It distinguishes **SQLite local development**
from the **PostgreSQL 18 / Neon / Render public runtime**. Local databases and
accounts are separate from the hosted demo; the public test login is not
implicitly provisioned into every fresh local database.

```bash
git clone https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE.git
cd ai66a_group3_C1_SE
```

Use Python **3.12** and Node.js **24**. Create/activate `.venv` and prepare the
private root `.env` as described in SETUP. Then, from the repository root:

```bash
python -m pip install -r backend/requirements.lock.txt
python -m pip install -e "./backend[dev]" --no-deps
npm --prefix frontend ci
python -m alembic -c backend/alembic.ini upgrade head
python -m app.cli.import_tmdb_catalogue --pages 50
python -m app.cli.import_tmdb_catalogue --enrich-posters --all
python -m app.cli.import_tmdb_catalogue --enrich-backdrops --all
python -m app.cli.import_tmdb_catalogue --enrich-trailers --all
python -m app.cli.import_tmdb_catalogue --enrich-providers --all --countries US GB SG --limit 300
python -m app.cli.rebuild_overview_index rebuild
python -m app.cli.rebuild_overview_index check
```

Before migration/import, verify that `DATABASE_URL` targets the intended **local**
database, not production. Operator commands need a private `TMDB_READ_ACCESS_TOKEN`
and network access. Fifty pages target roughly 1,000 raw results; the actual
valid/deduplicated total varies. With `--all`, `--limit 300` is a batch size, not
a total cap. Do not reimport the accepted catalogue just to enrich providers.
The M2 seed command is historical/offline test support, not M3–M5 demo data.

Run the backend and frontend in separate activated terminals:

```bash
python -m uvicorn app.main:app --app-dir backend --reload
```

```bash
npm --prefix frontend run dev
```

Open **http://localhost:5173** and use Create account to create a local user,
or follow [review-user provisioning](docs/SETUP.md#disposable-test-account-and-p0-journey).
Vite proxies relative `/api` calls to **http://127.0.0.1:8000**.
For production migration/grants, TLS, startup and index recovery, follow the
[Neon/Render runbook](docs/SETUP.md#postgresql-18-neon-and-render-public-runtime)
rather than copying local SQLite commands into a production terminal.

## Tests, CI and review

The default milestone suite is the compact **40-case P0 suite**:

```bash
python -m pytest -v
```

It uses isolated fixtures and does not need a real TMDb token or production DB.
[P0 case map, normal/refusal/boundaries and mutation evidence](docs/testing.md).
Optional feature/browser suites are documented with their individual features;
they are not prerequisites for taking a screenshot of the compact M4 test run.

[ci.yml](.github/workflows/ci.yml) checks stack selection, Python lint/P0/affected
backend paths, authenticated PostgreSQL 18/native recovery, frontend lint/focused
tests/build and forbidden credentials/files. See
[CI jobs and protected-main evidence](docs/operations.md#2-continuous-integration-and-protected-main)
for required contexts, latest recorded green-main run and remaining admin work.
Another member must review changes with a substantive comment and approval
before merge. CI metadata alone does not prove an independent review.

## Documentation and ownership

| Need | Source |
| --- | --- |
| Scope, rules, traceability, DoD | [Scope](docs/product-scope.md), [rules](docs/business-rules.md), [traceability](docs/traceability.md), [DoD](docs/definition-of-done.md) |
| Setup and public deployment | [SETUP](docs/SETUP.md), [T03](docs/s5-t03-deployment.md) |
| Architecture, modules and contracts | [Architecture](docs/architecture.md), [design](docs/design.md), [API](docs/api.md) |
| M3 UI / M4 tests | [UI](docs/ui.md), [testing](docs/testing.md) |
| Release, monitoring, risks and maintenance | [Operations](docs/operations.md), [PostgreSQL recovery](docs/s5-t06-postgresql-recovery.md) |
| Sprint history, metrics and final submission | [Sprint log](docs/sprint-log.md), [C02](docs/s5-c02-wrap-up.md), [manual M5 block](docs/s5-t08-c02-handoff.md#manual-submission-block) |

Product Owner: @kietxuan. Scrum Master rotation: **Sprint 1 @hoang3003 →
Sprint 2 @NguyenTuanAnh0608 → Sprint 3 @vu-huzy → Sprint 4 @anotify-vie →
Sprint 5 @kietxuan**. C01 is PO-owned; C02 is SM-owned. GitHub's
[Project 9](https://github.com/orgs/SE-FDA-NEU/projects/9) tracks the work.
Historical role/output records live in the Sprint log instead of competing
with the current team/release information at the top of this README.

The backend lives in `backend/app`, migrations in `backend/alembic`, the React
frontend in `frontend/src`, and verification in `tests`, `backend/tests` and
feature-specific frontend scripts. Keep `.env`, service credentials, database
files/dumps and generated submission PDFs out of Git. The published application
review login is intentionally approved demo data, not a real-service secret.
