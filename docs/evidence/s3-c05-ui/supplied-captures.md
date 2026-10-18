# C05 supplied submission images - 2026-10-18

The PO, @kietxuan, supplied the original board PNG and then two application
PNGs in chat, explicitly identifying the latter as screenshots they captured.
The PO also confirmed the submitter as **Nguyen Xuan Kiet**, Product Owner
as **@kietxuan**, and Sprint 3 Scrum Master as **@vu-huzy**.

These files are copied byte-for-byte under `docs/images/ui/`. No resizing,
cropping, masking, redrawing or generated browser chrome is applied to the
stored PNGs. The PDF scales them proportionally for layout only. The older
eight copied images and their historical reports are retained unchanged.
Original filenames, SHA-256 hashes, dimensions, byte lengths and clipboard-file
timestamps are in the [asset manifest](../../images/ui/asset-manifest.json).

## What is visible

| Image | Directly visible evidence | Limits |
|---|---|---|
| [Submission board](../../images/ui/submission-board.png) | Project 9; Todo 4, In Progress 0, In Review 0, Done 87; all workflow columns | No visible Sprint 3 filter or capture timestamp; global card totals, not velocity or issue-closure proof |
| [P0 movie detail](../../images/ui/p0-movie-detail-browser.png) | Browser address `localhost:5173/movies/18ae3a02-bbb5-4dbd-b038-057441fb77a5`; Spider-Man: Brand New Day; 2026; Adventure, Action, Science Fiction; overview; backdrop; TMDb popularity 1024.51 | Image alone does not prove all S03 criteria or the unaided journey from Home |
| [Sign-in error](../../images/ui/login-error-browser.png) | Browser address `localhost:5173/login`; exact red message **Email or password is incorrect**; password remains visually masked | Image is not a browser network transcript; the actual submitted password is neither known nor recorded |

The error is consistent with `POST /api/auth/login` returning HTTP 401 /
`INVALID_CREDENTIALS`, as implemented by `backend/app/main.py` and rendered by
`frontend/src/pages/LoginPage.tsx`. This code/contract correspondence is not
a claim that an HTTP transcript was supplied with the image. It is a different
case from the retained historical `SERVICE_UNAVAILABLE` preview.

The PO explicitly requested publication of these attachments. They include
original browser bookmarks and a visible email field; no plaintext password,
API token, cookie or private `.env` content is visible. They are not silently
replaced with edited screenshots or described as privacy-sanitized captures.

## Independent local data cross-check

Observed on 2026-10-18 at **14:09:58 UTC / 21:09:58 +07:00**, after receipt:

- `GET http://127.0.0.1:8000/health` succeeded with database connected and
  migration `c6f8a2d4e901`.
- The detail API on port 8000 and the same `/api/movies/<id>` through the
  frontend on port 5173 returned the pictured title and active revision
  `34b442f2-f5a8-4317-9f2f-468e6ec06a20`.
- SQLite was opened using a `mode=ro` URI and `PRAGMA query_only=ON`. Queries
  read catalogue/revision/movie fields only, not account or session rows.
- Active provider: `tmdb`; 255 movies and 255 distinct source IDs.
- Pictured internal ID: `18ae3a02-bbb5-4dbd-b038-057441fb77a5`;
  source: `tmdb`; source ID: `969681`; title: Spider-Man: Brand New Day.
- Stored/API popularity: `1024.5071`; pictured formatted value: `1024.51`.
- Stored source fetch timestamp: `2026-10-12 12:00:42.372954`.
- API detail: year 2026, Adventure/Action/Science Fiction, matching overview,
  backdrop URL `https://image.tmdb.org/t/p/w780/4tjxYg2AbOzzG9G1YuiT2NzYhlH.jpg`.

This cross-check connects the visible movie to the existing imported database;
it is not a fresh import, complete acceptance rerun or independent observation
of the PO's browser interactions. No database writes, migrations, seed/import,
account creation or server restart were performed for it.

## Capture and release boundaries

Received date: **2026-10-18**, Asia/Ho_Chi_Minh. Exact capture times and the
running process's checkout SHA were not supplied. Clipboard-file modification
times in the manifest describe the received files, not verified capture times.

Workspace head before this follow-up was
`439c42b95bbe1f3a999b4e4c6504f2b4b23024be`, with main integrated through
`bf18ab860fc3e486b57fc3b5ccac4db94c283995`. This is a workspace observation,
not a retroactive assignment of that SHA to a screenshot. The dossier verifier
separately compares the current product/test source with the historical T25
manifest, allowing only the explicitly reported Scrum-workflow difference.

The board URL is [Project 9](https://github.com/orgs/SE-FDA-NEU/projects/9).
The PO/SM still needs to verify instructor access to this private board. The
PO-supplied submission-day image does not itself prove an LMS upload occurred.
No issue state, Story points or participant outcome is inferred from Done cards.

These supplied images replace page-2/page-3 missing-image slots. They do not
resolve Trang's unrecorded session details, C02's Sprint 3 log/minimum audit,
substantive non-contributor review/merge of PR #188, final export from merged
main, or the actual LMS receipt. Those obligations remain outside child Task
#189's draft/source/tooling completion boundary.
