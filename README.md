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

Use the live references below to check the current version. This section does
not freeze a commit that would become outdated at the next deployment.

| Item | Current source of truth |
| --- | --- |
| Running application | [Open CineAI](https://cineai-o9tf.onrender.com/) |
| Deployed commit | [Render service / Deploys](https://dashboard.render.com/web/srv-dbp96kp42hec73bv94j0): inspect the deployment marked **Live** and its full commit SHA; workspace access is required |
| M5 release | [Release v1.0](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/releases/tag/v1.0): inspect the tag's target commit and compare it with Render Live |
| Latest main CI | [ci.yml runs on main](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/workflows/ci.yml?query=branch%3Amain): select the latest main run and confirm success; a green PR run alone is not the final main check |
| Runtime and operational guidance | Render Free/Singapore with Neon PostgreSQL 18; [setup](docs/SETUP.md) and [operations](docs/operations.md) |

The required M5 release identity is **running app commit = v1.0 target**.
Merging a PR does not prove deployment or update an existing release tag.
After deploying a new reviewed green-main candidate, verify the Live SHA,
repeat affected acceptance checks, and reconcile the release before submission.
Record the actual Live SHA, matching CI run and acceptance date in the release
notes and submission. Keep documentation-main identity separate when it differs.

[C02 evidence](docs/evidence/s5-c02/README.md) and the
[C02 wrap-up](docs/s5-c02-wrap-up.md) retain dated deployment, data-count and
acceptance observations; these historical records do not certify a later
deployment. C02 is closed; remaining administrative/operational/submission
evidence is still disclosed there. The free service may take about a minute
to wake after inactivity.

[Health endpoint](https://cineai-o9tf.onrender.com/health) returns HTTP 200 when
the database/schema/required-table checks pass, otherwise 503. It does not
report the application commit. See the
[release policy](docs/s5-c02-wrap-up.md#deploy-first-document-afterward--po-amendment).
Keep the site available until grades are published and the group's longer
retention commitment is fulfilled; [owners and schedule](docs/operations.md#5-maintenance-plan).

## Sprint history

Each table records the member's role and general work in that Sprint. PO and SM
also contributed to delivery; implementation, fixes and reviews were shared.
The linked Sprint records and pull requests retain the detailed evidence.

### Sprint 1 — Requirements and product backlog

Defined the student problem/personas, scope, business rules, Stories, priorities,
traceability and Definition of Done. PO: @kietxuan; SM1: @hoang3003.

| Member | Role | Main responsibilities |
| --- | --- | --- |
| Nguyen Xuan Kiet | Product Owner | Define product scope and priorities; refine the backlog and agree the Sprint commitment. |
| Tran Minh Hoang | Scrum Master | Coordinate the team's process, track progress and consolidate Sprint outcomes and wrap-up. |
| Tran Tuan Anh | Developer | Research student needs; develop personas and usage scenarios to inform the requirements. |
| Vu Quoc Huy | Developer | Prepare the requirements dossier and connect requirements, Stories and acceptance criteria through traceability. |
| Nguyen Tuan Anh | Developer | Establish repository readiness, business-rule and route conventions, and the Definition of Done. |

[Scope](docs/product-scope.md) · [Business rules](docs/business-rules.md) ·
[Traceability](docs/traceability.md) · [Sprint 1 record](docs/sprint-log.md#sprint-1---repository-activity-recorded-2026-09-08-to-2026-09-20).

### Sprint 2 — Design and walking skeleton

Established architecture/module/API contracts, catalogue/account persistence,
server-side TMDb import and the initial frontend/backend/CI walking skeleton.
PO: @kietxuan; SM2: @NguyenTuanAnh0608.

| Member | Role | Main responsibilities |
| --- | --- | --- |
| Nguyen Xuan Kiet | Product Owner | Refine scope; implement catalogue storage, server-only TMDb import and reproducible seed/bootstrap support; define explanation and attribution content. |
| Tran Minh Hoang | Developer | Define architecture/data/API contracts; implement session endpoints, the recommendations landing and explanation page; verify the detail walking skeleton. |
| Tran Tuan Anh | Developer | Implement sign-in/navigation, catalogue cards and details, and the popular/cold-start API; prepare database setup and runtime CI. |
| Vu Quoc Huy | Developer | Implement registration and public catalogue/detail endpoints; verify account boundaries and integrated journeys; assemble the design dossier. |
| Nguyen Tuan Anh | Scrum Master | Coordinate Sprint delivery and wrap-up; implement account/password storage, registration form and server sessions; verify explanation navigation. |

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

| Member | Role | Main responsibilities |
| --- | --- | --- |
| Nguyen Xuan Kiet | Product Owner | Refine and accept scope; implement preference validation, recommendation empty/error states and genre filtering; deliver real TMDb import, backdrop storage/compatibility checks and the rating widget. |
| Tran Minh Hoang | Developer | Implement personalised recommendation endpoints, Popular UI and verification, reset backend and backdrop details UI; reconcile API/schema contracts and rating account-switch checks. |
| Tran Tuan Anh | Developer | Implement preference save/restore UI, cold-start transitions and popular catalogue endpoints; deliver rating storage/API verification, integrated P0 acceptance and the UI/accessibility dossier. |
| Vu Quoc Huy | Scrum Master | Coordinate Sprint delivery and wrap-up; implement preference storage, genre ranking, recommendation cards and rating API; verify details/mobile controls and show TMDb popularity. |
| Nguyen Tuan Anh | Developer | Prepare deterministic fixtures and preference isolation tests; implement Home genre controls, retry/race handling, detail-return context and backdrop enrichment; verify clean-clone setup and isolated CI. |

### Sprint 4 — Discovery, interface and tested business rules

Planning: 20 October; reported Review/Retro: 1 November 2026.
PO: @kietxuan; SM4: @anotify-vie.
Added rating-aware ranking, shared TF-IDF Search/Similar, persistent Watchlist,
Profile/reset preserving Watchlist, light/dark redesign, posters, half-star
explicit-save ratings and embedded official trailers. Preserve each feature's
recorded acceptance boundaries rather than treating this summary as new evidence.
[Planning](docs/sprint4-backlog-refinement.md) · [Testing dossier](docs/testing.md) ·
[Sprint 4 record](docs/sprint-log.md#sprint-4--wrap-up-cutoff-1-november-2026).

| Member | Role | Main responsibilities |
| --- | --- | --- |
| Nguyen Xuan Kiet | Product Owner | Refine and accept scope; redesign shared UI, onboarding, themes, posters and rating controls; implement reset concurrency, Profile UI and detail-return verification; improve search pagination and discovery presentation. |
| Tran Minh Hoang | Developer | Implement account-owned rating signals and deterministic ranking oracles, Profile API and persistent Watchlist, reset invalidation and official trailer import; reconcile contracts. |
| Tran Tuan Anh | Scrum Master | Coordinate Sprint delivery and wrap-up; implement personalised ranking/fallback and Search UI; verify filtering/pagination, cold-start/account isolation and core readiness. |
| Vu Quoc Huy | Developer | Implement rating-save ranking refresh/explanations and Similar API/UI; verify full reset, later-login persistence and accessible recovery; compile the testing dossier. |
| Nguyen Tuan Anh | Developer | Implement the shared versioned TF-IDF index and title/overview Search API; verify rating/ranking privacy and TDD evidence; integrate trailer UI and prepare build/index/persistence recovery. |

### Sprint 5 — Public deployment, regional availability and release

**5–12 November 2026**, Planning 6 November; PO/SM5: @kietxuan.
Moved public persistence to PostgreSQL 18/Neon, deployed to Render, added
US/GB/SG availability and validated TMDb watch-options links, and prepared
monitoring/recovery/operations and the M5 handoff. C01/T01–T08 and C02 are now
Closed, following the C02 documentation merge. Issue closure does not replace
the remaining administrative/operational/submission evidence disclosed in the
wrap-up; PO acceptance and v1.0 publication are recorded separately.

| Member | Role | Main responsibilities |
| --- | --- | --- |
| Nguyen Xuan Kiet | Product Owner / Scrum Master | Lead Planning, scope and team commitment; accept the public candidate; reconcile final audit, Sprint metrics, README, release and submission handoff. |
| Tran Minh Hoang | Developer | Verify PostgreSQL 18 compatibility and migrations; prepare and test backup, restore and rollback procedures. |
| Tran Tuan Anh | Developer | Prepare CI/protected-main requirements and Render deployment; implement regional provider enrichment and validated movie/market watch-options links. |
| Vu Quoc Huy | Developer | Implement the regional Where to watch interface; prepare monitoring, portable setup, README and operations documentation. |
| Nguyen Tuan Anh | Developer | Provision and verify Neon, imported TMDb data and NLP startup; prepare public acceptance checks and the final verification handoff. |

[Planning](docs/sprint5-backlog-refinement.md) · [Operations](docs/operations.md) ·
[C02](docs/s5-c02-wrap-up.md) ·
[Five-Sprint metrics](docs/sprint-log.md#c02-current-delivery-and-five-sprint-reconciliation--11-november-2026).

## Application behaviour

- On phones/tablets, open the three-line navigation button beside the theme
  toggle to find the pages and account actions. Close with the × button, the
  backdrop or Escape. Wider screens retain the expanded navigation.
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
For the compact menu and mobile layout check, see the
[focused verification and screenshots](docs/evidence/mobile-navigation/README.md).

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
The Sprint tables above summarise every member's work; the Sprint log contains
the detailed role/output records and metrics. The current team/release entry
remains at the top for reviewers opening the repository.

The backend lives in `backend/app`, migrations in `backend/alembic`, the React
frontend in `frontend/src`, and verification in `tests`, `backend/tests` and
feature-specific frontend scripts. Keep `.env`, service credentials, database
files/dumps and generated submission PDFs out of Git. The published application
review login is intentionally approved demo data, not a real-service secret.
