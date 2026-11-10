# S4-T19 / #214 local evidence

Verified on 30 October 2026 from branch `pr-190-head`, executable HEAD
`b4b1797a17e01c7593705608cc552c3e338b90e2` (implementation commit
`fe91c0ba87f3a4b4f17a998d8d146acc72c90f6e`; the later commit added this
evidence document). Windows PowerShell, Python 3.12.3, Node.js 24.20.0 and
npm 11.19.0 were used. No TMDb token value was printed or written to evidence.

## Executed checks

| Command / action | Expected | Actual | Raw local output |
|---|---|---|---|
| `.\.venv\Scripts\python.exe -m pytest -q` | Root suite passes with isolated, token-free provider fixtures | **787 passed, 1 skipped, 210 subtests passed** in 331.27 s; one Starlette deprecation warning | [root-pytest.log](s4-t19/checks/root-pytest.log) |
| `.\.venv\Scripts\python.exe -m ruff check backend` | No backend lint findings | **All checks passed** | [backend-ruff.log](s4-t19/checks/backend-ruff.log) |
| `cd frontend; npm.cmd run test` | Frontend tests pass | **440 passed in 39 files** | [frontend-test.log](s4-t19/checks/frontend-test.log) |
| `cd frontend; npm.cmd run lint` | No frontend lint findings | Exit 0 | [frontend-lint.log](s4-t19/checks/frontend-lint.log) |
| `cd frontend; npm.cmd run build` | TypeScript and production bundle build | Exit 0; 79 modules transformed | [frontend-build.log](s4-t19/checks/frontend-build.log) |
| Chrome against Vite with intercepted synthetic local API | Trailer link visible only for a valid trailer; no runtime TMDb metadata request | 2 screenshots; valid link, absent null link, **0 TMDb requests** | [browser-synthetic.log](s4-t19/checks/browser-synthetic.log), [capture script](s4-t19/checks/capture-synthetic-screenshots.cjs) |
| Read-only inspection of configured local DB | Establish whether live trailer enrichment has already run | Active `tmdb` revision, **295 active movies**, **trailer column absent** | [local-db-readonly.log](s4-t19/checks/local-db-readonly.log) |
| Diff path/token-pattern scan and `git diff --check` from `9f285a1` to HEAD | No `.env`/DB dump path, obvious literal token or whitespace error | 20 changed files; 0 forbidden paths; 0 candidate token literals; whitespace check passed | [diff-and-screenshots.log](s4-t19/checks/diff-and-screenshots.log) |

The browser screenshots are **real Chrome rendering of synthetic, intercepted
API responses**, not live TMDb import evidence. They show [trailer present](s4-t19/screenshots/trailer-present.png)
and [trailer absent](s4-t19/screenshots/trailer-absent.png). The capture script
asserts the generated YouTube URL, absence of a link for JSON `null`, and no
request to `api.themoviedb.org`. SHA-256 values for both screenshots are in
the diff/screenshot log. Backend tests use an isolated real SQLite database
with synthetic provider responses and check migration preservation, bounded
requests, deterministic selection, clearing, stale/error preservation,
rollback, and the exact details DTO.

The full root suite was rerun after correcting the historical migration
snapshot helpers. Its earlier failed run (775 passed, 1 skipped, 3 failed,
2 errors) is superseded by the passing result above. The focused 70- and
88-test results reported previously were real, but no raw logs were retained
for those runs; the current root-suite log covers those tests.

## Follow-up fixes checked on 30 October 2026

These checks cover the current **uncommitted working tree** on HEAD
`5c7e3089aedc678cbd7d2d971afc6c0fcc297205`, after adding batch progress,
an explicit multilingual videos query, and the current `docs/api.md` C03
fingerprint. They are separate from the earlier committed baseline above.

| Check | Actual | Local output |
|---|---|---|
| 301-movie synthetic catalogue, two enrichment passes | First pass fetched 300, `remaining=1`; second pass requested movie 301 first, `remaining=0`; each pass fetched at most 300 | [focused pytest log](s4-t19/checks/trailer-followup-pytest.log) and `test_301_movies_advance_to_unattempted_movie_on_second_pass` |
| Mock HTTP adapter with French-only official trailer | One `/movie/{id}/videos` request sent `language=en-US` and `include_video_language` including `fr`; selector returned the French trailer | [focused pytest log](s4-t19/checks/trailer-followup-pytest.log) and `test_http_adapter_requests_other_languages_and_selects_non_english_trailer` |
| Focused trailer, CLI, details and importer tests | **111 passed**, one Starlette deprecation warning | [focused pytest log](s4-t19/checks/trailer-followup-pytest.log) |
| Root `pytest -q` | **789 passed, 1 skipped, 210 subtests passed** in 258.94 s, one Starlette deprecation warning | [root pytest log](s4-t19/checks/root-pytest-followup.log) |
| Backend Ruff | **All checks passed** | [Ruff log](s4-t19/checks/trailer-followup-ruff.log) |
| C03 contract and LF/CRLF verifier | **PASS**; current `docs/api.md` normalized-LF hash `28322e8f3a504d9b380ad9a3b72b8cc49eeb185cc992c24f644f04346d8886a1` | [contract log](s4-t19/checks/trailer-followup-c03.log), [line-ending log](s4-t19/checks/trailer-followup-c03-line-endings.log) |

The adapter test verifies the outgoing query and handling of a simulated TMDb
response. TMDb's movie videos reference documents `language=en-US` as the
default but does not list `include_video_language` for this endpoint. A live
non-English-only movie response remains unverified; do not present the mock as
proof of TMDb's production filtering behavior.

## Historical pending gates and limits (30 October 2026)

- **Live TMDb enrichment was not run.** The configured local database has not
  been migrated to the trailer schema; it was inspected without writes. The
  token is configured privately, but no token value is present in these files.
- The repository's [#213 G4 follow-up](s4-t18-core-pre-g4/follow-up/README.md)
  still records the PO/SM decision as Pending and recommends Defer. A later
  explicit Go and current capacity have not been verified here.
- A clean clone for this candidate, hosted CI, independent human review, live
  API/browser smoke, PR merge and issue closure have not been verified.
- The logs, screenshots and capture script under `s4-t19/` are local working
  tree artifacts. They are not part of the tested Git HEAD or a published PR
  until deliberately added and reviewed.

## 31 October 2026 follow-up

The requester reports that the PO has confirmed G4 Go. The statements above
describe the earlier candidate and are retained as historical evidence.
The [live smoke and full-batch record](s4-t19-live-20261031.md) documents the
new `--all` implementation, real TMDb language behavior, separate database,
API/browser checks, clean-clone check and final test output. Hosted CI and
independent review still require verification against the published PR head.
