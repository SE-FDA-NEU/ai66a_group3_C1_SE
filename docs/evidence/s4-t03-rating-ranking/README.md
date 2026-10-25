# S4-T03 (#198): rating-aware personalised recommendation ranking

Executed on 2026-10-25 (Asia/Ho_Chi_Minh). Story #22 / S05b, with preserved
S02 #18 recommendation semantics. Dependencies: S4-T02 #197 rating signals
and S4-C03 #217 contract; downstream verifier: S4-T05 #200. This is executed
developer evidence, not independent human review or approval.

## Contract inspected before implementation

- Pre-implementation HEAD / RED Git SHA:
  `d3c24acec0e1e0d67c4004328e7cf096775f8f6f`.
- Merged C03 source: `docs/api.md` section 13.1, `docs/design.md` section 12,
  and local history `bdc4ac2`, `24b74a5`, merged through `37c2f66` (#222).
  #217 is the contract issue; this evidence does not invent a PR #217 merge.
- Merged T02 source: `signals.py`, tests and
  `backend/tests/fixtures/s4_t02_ranking_handoff.json`, including history
  `8f313bc` and `538cc10`.
- Final personal fields are `ratingAdjustment: integer`,
  `adjustedScore: number | null`, and
  `basis: rating_signals | baseline | rating_unavailable`.
  They are absent from popular alternatives and public movie DTOs.

## Genuine RED, then the same assertion GREEN

Only deterministic tests were added before the first run; the recommendation
implementation was still the RED SHA above. The test uses the real protected
HTTP route, login and rating PUT against its own temporary SQLite file. TMDb
requests are forbidden. No mutation or intentional break was used.

RED command (repository root, exit 1):

```sh
.venv/bin/python -m pytest backend/tests/test_rating_aware_recommendations.py::test_five_star_related_rating_reorders_80_80 -v
```

Expected after committing a related five-star rating:
`[Zulu Action, Alpha Comedy]`, personal scores 81/80, both raw popularities 80.
Actual before implementation: `[Alpha Comedy, Zulu Action]`. The failure was
the ordering assertion, before attempting to read the new metadata fields.
Full original output: [RED](tdd.log), `1 failed`.

GREEN command is the exact same command (exit 0). Actual: ordering becomes
`[Zulu Action, Alpha Comedy]`; adjustment 1, adjusted score 81 and
`basis=rating_signals` on Zulu; Alpha remains 80/0/`baseline`; both catalogue
scores stay 80. Output: [GREEN](tdd.log), `1 passed`.

## Exact tested source identity

Original runs used base Git SHA `d3c24acec0e1e0d67c4004328e7cf096775f8f6f`
plus this task's then-uncommitted working-tree source changes. That Git commit
alone is the RED implementation, so it must not be described as a GREEN
implementation commit. No local commit or push had been created at evidence
capture; the recorded source manifests identify the tested contents before
the subsequent user-authorized commit, push and PR publication.

The original GREEN source snapshot SHA-256 is preserved unchanged:
`37ffa15c0a0d04f84ded08ebb10dfd109ce58c14cda68e792062aaa6e340d693`.
The [original tested manifest](tested-source.sha256) contains 668 files.

Evidence was subsequently consolidated into this folder. Application and test
source did not change; the three tracked API/design/C03 documents only changed
links and their corresponding contract hashes. Therefore the historical tested
manifest keeps their original hashes, while the [current manifest](source.sha256)
records the source tree after those documentation edits.

Current source snapshot SHA-256: `d8bbba2d7de9d9cff110997947487123e6c5bb7fad76bf85f3fa267de1222ce4`.
Verify the current manifest and file contents from repository root:

```sh
shasum -a 256 docs/evidence/s4-t03-rating-ranking/source.sha256
shasum -a 256 -c docs/evidence/s4-t03-rating-ranking/source.sha256
```

The evidence folder contains:

- `README.md`: task, commands, results, coverage and source identities.
- `tdd.log`: original RED and GREEN outputs, in that order.
- `regression.log`: focused/backend/frontend/lint/build/contract outputs,
  including the original sandbox restriction and the successful rerun.
- `tested-source.sha256`: immutable manifest for the original GREEN evidence.
- `source.sha256`: current manifest after evidence/documentation relocation.

Each merged original log section records its old filename, byte count and
SHA-256; its raw output was preserved byte for byte. New documentation checks
are appended separately instead of replacing the historical outputs.

## Executed verification

Focused command:

```sh
.venv/bin/python -m pytest backend/tests/test_rating_aware_recommendations.py backend/tests/test_personalised_recommendations_api.py backend/tests/test_s4_t02_rating_signals.py backend/tests/test_genre_matching.py backend/tests/test_popular_recommendations.py backend/tests/test_recommendation_fixtures.py backend/tests/test_ratings_api.py backend/tests/test_rating_repository.py -v
```

Observed: **159 passed**, exit 0. This includes 17 new parameter-expanded
ranking cases. [Full focused output](regression.log).

| Regression command | Observed result | Output |
|---|---|---|
| `.venv/bin/python -m pytest backend/tests -v` | 575 passed, 1 historical skipped placeholder; exit 0 | [Backend](regression.log) |
| `.venv/bin/python -m ruff check backend` | All checks passed, exit 0 | [Ruff](regression.log) |
| `npm --prefix frontend test` | 29 files / 308 tests passed, exit 0 | [Frontend tests](regression.log) |
| `npm --prefix frontend run lint` | Passed, exit 0 | [Frontend lint](regression.log) |
| `npm --prefix frontend run build` | TypeScript and Vite build passed, exit 0 | [Frontend build](regression.log) |

The first full backend attempt was sandbox-restricted: **569 passed, 1
skipped, 6 setup errors**. All six errors were existing real-HTTP auth
acceptance fixtures denied `socket.bind(127.0.0.1, 0)` with `PermissionError`.
This was not feature RED evidence. Its [original output](regression.log)
is retained. The full command was rerun with sandbox escalation so the
local-only acceptance server could bind. No live TMDb token or network service
is needed. The existing Starlette/httpx deprecation warning is retained in logs.

Documentation commands also passed (exit 0):

```sh
.venv/bin/python scripts/verify_s4_c03_contract.py
.venv/bin/python scripts/test_s4_c03_contract_line_endings.py
git diff --check
```

The [contract check](regression.log) verified 200 local links,
35 unique P0 case IDs, and current normalized document hashes. The
[export check](regression.log) passed both LF and
CRLF exports with seven identical normalized hashes. The one backend skip is
the pre-existing `test_rating_write_requires_the_signed_in_account` historical
S05a placeholder; implemented rating API tests ran and passed.

## Behaviour and isolation results

| Requirement / expected result | Observed automated coverage |
|---|---|
| Related 5 -> 81/80; 1 -> 79/80; 2/4 follow the same signs | `test_five_star_related_rating_reorders_80_80`, `test_signs_neutral_and_current_saved_value` |
| Neutral 3 / no ratings preserve 90/80 and the baseline | Exact equality before/after neutral PUT using the merged T02 `neutral90_80` oracle |
| Former position 11 enters page one after boost | Merged T02 `wholeSet25`: Target moves from 11th to 10th; pages exactly 10/10/5, all 25 unique IDs; genre-2 view contains only Target, totals preserved |
| Genre eligibility never changes | Highly rated Comedy source stays excluded with Action-only preferences, while the eligible Action/Comedy Target receives its signal |
| One current value; no cumulative saves | Repeated 5/5/current/current PUTs produce one stored row; scores reflect only the last committed value |
| Shared genres contribute once | Source and candidate overlap two selected genres; adjustment is exactly 1, including the source's own candidate entry |
| Null remains null after every finite score | Missing raw and adjusted score stay JSON null despite a real +1 signal; finite zero ranks ahead; existing baseline tests cover negative adjustments |
| Deterministic ties | Same-title/equal-score candidates use ascending internal IDs; SQL and personal ordering use one shared comparator |
| Rating-only read failure | Actual SQLite rating SELECT interrupted with `OperationalError`; response is baseline 200, every adjustment 0, finite scores raw, all bases `rating_unavailable`; subsequent request recovers |
| Core failures remain errors | Actual catalogue/preferences/candidate/auth database queries interrupted separately; all remain 503 `SERVICE_UNAVAILABLE`; no private error detail exposed |
| Authentication refusal stays 401 | Missing/invalid cookies and logout checked in new tests; existing focused tests also cover expired and revoked sessions |
| Cold-start and no-match are unchanged | Exact response equality before/after five-star PUT, original popularity order, original mode flags, private score fields absent |
| Protected metadata matches comparator | Real response asserts exact C03 names, basis values, adjusted and raw scores; baseline/null/failure states use truthful values |
| Public metadata isolation | Public catalogue/popular/detail responses and shared public summary/detail schemas contain none of the three private fields |
| A cannot influence B; B cannot influence A | Same preferences, shared source, opposing ratings yield independent scores/orders; requests ignore forged query, header and GET-body identity hints |
| Reset/logout/account switch | A reset deletes its effect while B's response is identical; reselecting A's genres yields baseline; logout blocks reads; same client signing in as B sees exactly B's response |
| Offline / isolated persistence | Synthetic fixtures, real temporary SQLite files, independent request sessions, TMDb method forbidden |

The old Sprint 3 exact personalised response fixture was extended with
baseline metadata. Its two rating-ignored assertions now verify current
adjustments while retaining order/raw-score, preference and second-account
isolation checks. The original ranking RED assertion was not weakened.

## Changed implementation and contract files

- `backend/app/recommendations/ranker.py`: immutable computed ranking values,
  shared SQL/Python score comparator, full-set rating-aware ordering.
- `backend/app/recommendations/service.py`: reuse T02 account signals, catch
  only optional rating database reads, rank/filter/slice, project exact metadata.
- `backend/app/repositories/recommendations.py`: existing genre query can
  supply all eligible candidates without an early limit; baseline callers retain
  bounded pagination.
- `backend/app/schemas/recommendations.py`: protected personalised DTO subtype;
  popular entries retain their old shape.
- `frontend/src/api/recommendations.ts`: optional C03 fields only on the private
  recommendation type, leaving public movie types unchanged.
- `backend/tests/test_rating_aware_recommendations.py`: new integration tests.
- `backend/tests/test_personalised_recommendations_api.py`: updated historical
  assertions for the now-delivered rating ranking extension.
- `docs/api.md`, `docs/design.md`: delivery status and matching C03 semantics.
- `docs/evidence/s4-c03-acceptance-matrix.md`: append current contract hashes,
  preserving historical captures; this report and linked logs preserve evidence.

## Scope and remaining Story work

No backend ranking blocker remains after the executed checks reported above.
This task does not implement personal-score/degradation UI presentation,
Search/Similar routes, NLP features, watchlist/profile UI, browser-level
acceptance of new score badges, or independent S4-T05 #200 verification.
Search/Similar runtime routes are not present in this base revision; their
shared public schemas remain unchanged, but runtime privacy checks for those
future routes belong to their delivery tasks. Historical T02 signal tests
continue to cover saved ratings after their source leaves the active catalogue.

The service reads and ranks the full eligible set per request (O(N log N)
sorting plus existing related-rating aggregation), preserving correct paging
at the cost of materializing that set. No personal ranking cache, migration,
external API call, account-targeting input, or catalogue popularity write is
introduced.
