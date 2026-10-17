# S3-T37 movie-detail backdrop implementation and review handoff

Implementation task: [#179](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/179).
Parent Story: [#19](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/19) (reference only).
Independent acceptance owner: [#131](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/131).

## Scope and admission

The G3 PO confirmation for the Sprint 3 backdrop chain is recorded in the
[#129 storage handoff](../s3-t26-backdrop-storage.md#admission-and-evidence-identity).
The required P0 tasks #114, #116, #120, #124 and #125, plus the required TMDb
import task #128, are closed. Storage #129 and importer/API #130 are merged in
base commit `d64cd29b27d5e01c6db4a94d02765f6873fea91f`. The initial
backdrop contract is documented in [#130's runbook](../../backdrop-import-runbook.md)
and [API contract](../../api.md); #134 and #135 remain open for their final
reconciliation. #131 is the later independent verification task, not a start
dependency for T37.

Only `/movies/:movieId` changes. List cards, recommendation ranking,
authentication, rating ownership and Story #19 criteria are unchanged.

## Implementation

- `MovieDetail.backdropUrl?: string | null` accepts the additive API field and
  an older server response that omits it.
- `MovieBackdropHero` keeps a permanent CSS gradient beneath the image and a
  dark overlay above it. The title remains selectable text, not image content.
- The client accepts only the reviewed `https://image.tmdb.org/t/p/w780/`
  single-file URL shape. It never contacts TMDb metadata/configuration APIs.
- Images are hidden until loaded and removed on error. The hero is keyed by
  movie ID and URL; existing detail-load cancellation also rejects stale
  movie responses.
- The existing facts, overview, rating component, return link and responsive
  page structure remain in place.

## Reproduce from the repository root

Use Python 3.12, Node 24 and the locked dependencies in
[SETUP.md](../../SETUP.md). Configure the private TMDb token only in `.env`;
never put it in frontend variables, screenshots or this evidence folder.
Apply migration `c6f8a2d4e901`, import a TMDb catalogue with at least one
backdrop, and start backend and frontend in separate terminals:

```powershell
.\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini upgrade head
.\.venv\Scripts\python.exe -m app.cli.import_tmdb_catalogue
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
npm.cmd --prefix frontend run dev -- --host 127.0.0.1
```

Run the real browser/API smoke from a third terminal. It uses the already
running API/UI, selects a listed movie with a non-null `backdropUrl`, and uses
Chrome or Edge. Set `T37_BROWSER` to an executable path if auto-detection fails.
It never reads a token or writes to the database.

```powershell
node frontend/scripts/verify-t37-backdrop.mjs
npm.cmd --prefix frontend test
npm.cmd --prefix frontend run test:t16:integration
npm.cmd --prefix frontend run test:t33:integration
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run build
git diff --check
```

For the backend regression, use a separate PowerShell terminal so its temporary
environment variables do not affect the running local app:

```powershell
$reviewDb = Join-Path $env:TEMP ('t37-review-' + [guid]::NewGuid().ToString('N') + '.db')
$env:DATABASE_URL = 'sqlite:///' + $reviewDb.Replace('\', '/')
$env:TMDB_READ_ACCESS_TOKEN = ''
try {
  .\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini upgrade head
  .\.venv\Scripts\python.exe -m pytest backend/tests -q
  .\.venv\Scripts\python.exe -m ruff check backend
} finally {
  [IO.File]::Delete($reviewDb)
}
```

The Vitest suite and synthetic browser cases simulate image completion/error;
they do not need a CDN or provider connection. The separate real-image smoke
needs public access to `image.tmdb.org`. The backend regression suite was run
with a newly migrated disposable SQLite database and a blank token; it did
not use or change `data/app.db`.

## Actual local results (17 October 2026, Asia/Saigon)

| Check | Expected | Actual |
|---|---|---|
| Public details API | Safe nullable URL from local SQLite | Revision `a6443fc7-6299-4a8d-be5e-bd59452518bb` returned Spider-Man: Brand New Day with a reviewed HTTPS `w780` URL |
| Real Chromium at 1280px and 375px | Own image loads; text and controls readable; no horizontal overflow | **PASS**; Chrome 155.0.8059.84, CDN HTTP 200, image natural width 780, document width equals viewport at both sizes; keyboard Tab focuses the return link with a 3px outline |
| Browser request boundary | No TMDb metadata/configuration call or token | **PASS**; only local app and public image CDN hosts observed; CDN request had no credential header or query |
| Stubbed bright/dark, failed, null and omitted images | Readable title/gradient, no broken image or overflow | **PASS** in five separate Chromium cases |
| Focused offline component/route tests | Present/null/omitted/broken, URL rejection, image URL changes, delayed old image/detail events | **14 passed** |
| Full frontend suite | Existing flows remain passing | **236 passed**, 20 files |
| T16 real UI/API/database recommendation integration | Ranking and account-scoped results remain intact | **1 passed** |
| T33 real UI/API/database rating integration | Own rating and recommendation state remain intact | **1 passed** |
| Frontend lint/build and backend Ruff | No lint/type/build errors | **PASS** |
| Backend suite on disposable database | Existing API/storage contract remains passing | **414 passed, 1 skipped**, one inherited Starlette/httpx deprecation warning; database removed after the run |

The [machine-readable browser record](t37-browser-evidence.json) contains
the actual API revision, browser version, source digest, viewport/image
measurements, CDN response code and host boundary. The screenshots are:

- Real imported TMDb image: [desktop](t37-desktop.png), [375px mobile](t37-mobile-375.png).
- Synthetic image stress cases: [bright desktop](t37-synthetic-bright-1280.png),
  [dark mobile](t37-synthetic-dark-375.png).
- Synthetic fallback cases: [failed image](t37-synthetic-broken-375.png),
  [null field](t37-synthetic-null-1280.png),
  [omitted rollout field](t37-synthetic-omitted-375.png).

Synthetic captures are explicitly labelled; they are not live TMDb image
evidence. Screenshots show only public movie details and a guest rating prompt.
No account credentials, cookies, `.env`, token or database dump are included.

## Executable identity and independent review

The source was executed over base commit
`d64cd29b27d5e01c6db4a94d02765f6873fea91f` with an **uncommitted**
working tree, as requested by the author. The browser runner records SHA-256
`ced81bd4e18f24431f30ee894d560d9f1aaa2bd9ddc7fcfc5ed1d88c30c5b0b7`
over the implementation, focused test and runner files. This digest identifies
the local candidate; it is not a pushed commit SHA or CI result.

For [#131](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/131), an
independent reviewer should check the final pushed SHA and rerun the commands
above, plus the #131 isolated DB/import/rollback and browser race matrix.
Confirm that account state, recommendation ordering and movie IDs survive
media-only changes. Record any later SHA and new evidence rather than treating
this local candidate as final acceptance. CI, independent review, merge and
#131 acceptance remain pending; do not close #19 from this task.

PR linkage for this implementation: `Closes #179` and `Refs #19, #131`.
