# S4-C03 local acceptance evidence — 2026-10-24

## Source and candidate

This is author-side evidence for the proposed S4-C03 #217 contract, using
the user-supplied 24 October 2026 issue text, the user's review findings,
tracked Sprint 3 contracts and read-only local remote-tracking refs for
T01/T11. Live GitHub issue pages could not be retrieved in this environment;
no later edit is claimed checked. The PO ZIP was inspected only for visual reference; no sample data,
logic or unapproved feature was copied into production.

The historical baseline was
`3078a9c6fd3dff1f0b8576bc7411f469c7a98fdf`. At the 2026-10-24
verification capture, local HEAD was
`932a9528c22413ae74635b94a9ca204ddd5e31de`, containing the two C03
commits `bdc4ac2` and `932a952`. The corrections tested below were then
uncommitted working-tree changes on that HEAD. The verifier prints
normalized-LF SHA-256 hashes for their exact text. Remote push state was
not checked at capture time; this verification work made no commit, push,
merge or PR change and claims no independent approval.

## Requirement-to-artifact trace

`Specified` means an author inspected the linked local text and found the
required decision. It does **not** mean a future API, test, browser flow or
review has passed.

| ID | Requirement in supplied C03 issue | Local contract evidence | Author result |
|---|---|---|---|
| C03-01 | Reuse protected rating/reset and popularity contracts without duplicate API/storage. | [Existing rating/reset](../api.md#9-sprint-3-rating-contract-implemented-under-s3-t31), [S4 routes](../api.md#13-sprint-4-c03-implementation-contract-planned-not-delivered), [module ownership](../architecture.md#9-sprint-4-c03-runtime-and-storage-contract-planned) | Specified; Sprint 3 stays labelled implemented, S4 planned. |
| C03-02 | 1/2=-1, 3=0, 4/5=+1; one contribution per rated movie; adjusted-score/title/ID order. | [Score contract and 80/80 oracle](../api.md#131-recommendation-score-transparency), [rank cases](../testing.md#2-test-cases-for-every-p0-story) | Specified, including replacement and shared-genre de-duplication. |
| C03-03 | Separate raw popularity, personal adjustment, adjusted score and basis; public DTOs private-free. | [API score fields](../api.md#131-recommendation-score-transparency), [visible labels](../design.md#122-state-ordering-and-truthful-labels) | Specified, including null and rating-read degradation. |
| C03-04 | Preserve S10's exact three steps and existing public error messages. | [Existing explanation copy](../recommendation-explanation.md), [design rule](../design.md#122-state-ordering-and-truthful-labels), [error envelope](../api.md#1-conventions) | Existing copy retained; no fourth step added. |
| C03-05 | Profile summary, confirm/cancel, timeout reconciliation and save/reset transaction order. | [Profile API](../api.md#134-profile-and-watchlist), [transaction order](../architecture.md#91-rating-reads-transactions-and-reset-order), [UI states](../design.md#123-five-star-profile-and-watchlist-interactions) | Specified; ambiguous timeout is not definite success. |
| C03-06 | Versioned shared TF-IDF transform, content/config readiness, rebuild and corrupt/stale failure. | [Index config and manifest](../architecture.md#92-versioned-overview-index-and-startup), [API error](../api.md#132-shared-nlp-search-and-similar-reads), [named case](../testing.md#2-test-cases-for-every-p0-story) | Specified with separate `corpusDigest` and `configFingerprint`; overview-only change stales, media-only change does not. |
| C03-07 | Similar: shared genre, source exclusion, max five, two text groups, missing-source fallback. | [Similar API](../api.md#132-shared-nlp-search-and-similar-reads), [named case](../testing.md#2-test-cases-for-every-p0-story) | Specified; index failure differs from missing overview. |
| C03-08 | Search: static route, literal title-first, positive-only cosine, max ten, no popular fill. | [Search API](../api.md#132-shared-nlp-search-and-similar-reads), [named case](../testing.md#2-test-cases-for-every-p0-story) | Specified; positive-order and all-zero fixtures are separate. |
| C03-09 | UI tokens/interfaces, responsive layout, both themes, T01 Home/login return and truthful labels. | [T01 interface/token table](../design.md#121-visual-tokens-and-shared-component-interfaces), [navigation and states](../design.md#122-state-ordering-and-truthful-labels), [amended S13 AC](../requirements.md#s13-sign-in-and-sign-out-securely-p0-5-points) | C03 now uses T01's actual names and Home-first flow; GitHub Story #45 still needs the same AC replacement. |
| C03-10 | Nullable poster DTO/path/migration/CDN/fallback; preserve backdrop and stable IDs. | [Poster DTO](../api.md#133-poster-media-on-existing-dtos), [storage handoff](../architecture.md#9-sprint-4-c03-runtime-and-storage-contract-planned) | Specified; no migration/import is claimed completed. |
| C03-11 | Treat ZIP as visual sample; exclude fake claims/data and defer VN provider slots. | [Reference exclusions](../design.md#124-reference-only-exclusions), [provider slot](../design.md#121-visual-tokens-and-shared-component-interfaces) | Specified; no ZIP HTML or data inserted into product. |
| C03-12 | Whole-set rank/filter before ten-item page, counts/revision and 25 -> 10/10/5. | [API rank/page](../api.md#131-recommendation-score-transparency), [UI URL state](../design.md#122-state-ordering-and-truthful-labels), [P0 cases](../testing.md#2-test-cases-for-every-p0-story) | Specified. |
| C03-13 | Watchlist unique account/movie, addedAt/internal ID, list/status/PUT/DELETE, order/page/CSRF/reset preservation. | [Watchlist API](../api.md#134-profile-and-watchlist), [table/owner](../architecture.md#9-sprint-4-c03-runtime-and-storage-contract-planned), [named case](../testing.md#2-test-cases-for-every-p0-story) | Aligned with supplied T12 #207: `inWatchlist` and DELETE `200 {data:{movieId,inWatchlist:false}}`; future implementation not claimed. |
| C03-14 | Five integer star hover/draft/committed/explicit-save/keyboard/API semantics. | [Rating interaction](../design.md#123-five-star-profile-and-watchlist-interactions), [named case](../testing.md#2-test-cases-for-every-p0-story) | Specified; future browser verification not claimed. |
| C03-15 | Four-layer test strategy and 2–3 risk sentences. | [Testing section 1](../testing.md#1-what-we-test-and-why) | Four layers and three risk sentences present. |
| C03-16 | Six P0 stories, unique IDs, three cases minimum, numeric boundaries and production trace. | [Testing section 2](../testing.md#2-test-cases-for-every-p0-story) | 35 P0 IDs: S01=8, S02=6, S03=4, S04=6, S12=5, S13=6; the T01 browser companion covers amended Story #45 navigation. |
| C03-17 | Future root pytest, isolated migrated SQLite, deterministic clocks/data, no server/token/network. | [Testing section 3](../testing.md#3-automated-tests) | Specified; C05 #219 owns actual root setup. |
| C03-18 | Separate genuine RED/GREEN from mutation effectiveness; case ID to production assertion. | [Testing section 3](../testing.md#3-automated-tests), [findings status](../testing.md#4-what-the-tests-found) | Specified; no event or test result fabricated. |
| C03-19 | Replace conflicting S13 landing AC while retaining historical evidence; transfer final executable reconciliation to #218. | [Local current S13 AC](../requirements.md#s13-sign-in-and-sign-out-securely-p0-5-points), [S4 API amendment](../api.md#135-sprint-4-authentication-navigation-amendment), [testing handoff](../testing.md#4-what-the-tests-found) | Local old automatic recommendation AC replaced, not checked alongside Home; GitHub #45 edit and final #218 audit remain pending. |

## Branch reconciliation before merge

The reviewer reported read-only `git merge-tree` results: no Git conflict
against current main, `docs/api.md` overlap with T01 #220, and
`docs/api.md`, `docs/architecture.md`, `docs/design.md` overlap with
T11 #221. These are document overlaps, not evidence of code incompatibility.
T01's `feature/s4-t01-cinematic-ui` ref was inspected read-only for
`AppFrame`, `MoviePoster`, `StarRating`, `ThemeProvider`, CSS tokens
and Home-first return flow. T11's `feature/s4-t11-reset-concurrency` ref
was inspected read-only for `BEGIN IMMEDIATE`, 5-second writer timeout,
rollback and unchanged reset DTO.

When those branches are integrated, reconcile each overlapping section
substantively: retain T01's implemented poster/navigation/style details,
T11's executed reset transaction details, and C03's cross-cutting ranking,
NLP, Watchlist, security and acceptance rules. Do not resolve a whole file
with `ours` or `theirs`. No merge was run by this correction.

## Commands, actual results and limits

Run from the repository root. The
[structural verifier](../../scripts/verify_s4_c03_contract.py) is read-only,
standard-library only and does not use the database, `.env` or network:

```powershell
.\.venv\Scripts\python.exe scripts/verify_s4_c03_contract.py
.\.venv\Scripts\python.exe scripts/test_s4_c03_contract_line_endings.py
.\.venv\Scripts\python.exe -m ruff check scripts/verify_s4_c03_contract.py scripts/test_s4_c03_contract_line_endings.py
git diff --check
```

The verifier hashes UTF-8 text **after replacing CRLF or bare CR with LF**,
without changing other bytes. The independent-export check creates two
temporary copies, one LF and one CRLF, runs the verifier in each and compares
all normalized hashes. The old raw-byte hash table is superseded.

Observed locally on 2026-10-24 for the corrected, uncommitted candidate;
all four commands exited 0:

```text
S4-C03 local document structure: PASS
Hash convention: SHA-256 of UTF-8 text after CRLF/CR -> LF
Document final newlines/trailing whitespace: PASS
Local link targets: 192 checked, 0 missing
Testing sections: 1, 2, 3, 4
P0 case IDs: 35 unique; S01=8, S02=6, S03=4, S04=6, S12=5, S13=6
S4 feature oracle IDs: 10 unique
LF export: PASS (7 normalized hashes)
CRLF export: PASS (7 normalized hashes)
LF/CRLF normalized hashes identical: PASS
ruff: All checks passed!
git diff --check: exit 0; Git warned that four LF working files would be
  converted to CRLF by a future Git operation
```

| Check | Expected | Actual |
|---|---|---|
| Structural verifier | Four numbered testing sections, all six P0 stories with at least three unique IDs, local links and normalized candidate hashes consistent | PASS; 192 links, 35 P0 IDs, 10 feature oracles, 7 matching hashes; exit 0. |
| LF/CRLF independent exports | Both exports pass with identical normalized hashes | PASS on two temporary exports; 7 matching hashes; exit 0. |
| Ruff | No Python lint findings in either verification script | `All checks passed!`; exit 0. |
| Tracked diff whitespace | No malformed whitespace | `git diff --check` exit 0; Git reported expected LF-to-CRLF conversion warnings. |
| Existing backend regression | Inherited behaviour remains green on disposable SQLite | 447 passed, 1 skipped, 1 deprecation warning, exit 0; not an S4 feature pass. |
| Independent contract review | Non-coauthor checks content and records a dated decision | Pending; no reviewer decision is claimed. |

The verifier checks document structure and local path existence, **not**
semantic approval or actual execution of the planned TC-IDs.

The existing backend suite was run on the unchanged executable backend at
local HEAD before these document/verifier corrections, through the isolated
runner:

```powershell
.\.venv\Scripts\python.exe backend/scripts/run_isolated_tests.py -q
```

Actual result: disposable SQLite migrated through `c6f8a2d4e901`;
`447 passed, 1 skipped, 1 warning in 176.27s (0:02:56)`; exit 0.
The warning was Starlette TestClient/httpx deprecation. The runner
automatically included all `backend/tests`, so this was the existing full
backend suite. It validates the inherited baseline only; it did **not**
execute future S4 routes, root `tests/` cases, React/browser UI or live
TMDb smoke. It was not rerun merely because this evidence document changed.

## Candidate hashes

The final verifier run below identifies the exact contract files tested
before the correction commit. Use these normalized-LF hashes together with
the capture base HEAD `932a952` to identify that candidate; the base HEAD
alone did not contain the corrected files. The evidence report is checked
for links and whitespace but is not self-hashed.

| File | SHA-256 after UTF-8 LF normalization |
|---|---|
| `docs/api.md` | `8d1288ea64b6c33716f64b0edaa86c8bec3f3939da847ed1264693a264e10848` |
| `docs/architecture.md` | `95647797aeaf3de71198a517de4e1ae16a49b1f14333fcac4a4ee95014ad00f2` |
| `docs/design.md` | `68559513ea9cd62b5f7939d6f071777bd23528e5bcf578c3482385aa3acbbff8` |
| `docs/requirements.md` | `7cfba68a26eb12aee2c1f2cf4d4269cf8ea82fd4a157899b8383debdb6f503e2` |
| `docs/testing.md` | `d36b9fb31d7f3d9eef092ded5bfda0edfa921f61eccd13adb81642bc4a44d5d5` |
| `scripts/verify_s4_c03_contract.py` | `4484c9cad834fcf88ce9d91cbfe31b7a89d797ff666c0e73b794e5e7ae2e6142` |
| `scripts/test_s4_c03_contract_line_endings.py` | `86fb7656efa33f1582d23d8b5c8a17737569a5fee006363e1926b4e69ea8f918` |

### T01 consumer reconciliation after C03 merge

The table above is the immutable C03 correction capture. T01 incorporates
merged main `37c2f66` and implements its nullable poster DTO and section 13.5
navigation without implementing other planned features. Only `docs/api.md`
changes among the seven hashed files; its current normalized-LF hash follows.
The other six hashes remain exactly those in the capture table. New executed
consumer checks belong to [T01 evidence](s4-t01-ui.md), not the historical C03
baseline run. This amendment does not claim independent review or feature
acceptance for the 35 planned P0 cases.

| File | SHA-256 after UTF-8 LF normalization |
|---|---|
| `docs/api.md` | `23ce959fc94c13bf2dd27f81721dbffd687e16895f85abdb00ab52c8c2474afe` |

## Review and acceptance status

### Later T01 button/title-sort consumer amendment (2026-10-24)

The PO requested button-styled action links and an optional descending Home
title order. The API, architecture and UI design now describe the same allowlist,
whole-catalogue-before-paging ordering and URL/request boundaries. This additive
capture leaves the earlier C03 hashes and historical results intact; it does not
claim renewed independent C03 approval. Executed consumer results and their
limits are in [T01 button/title-sort evidence](s4-t01-buttons-title-sort.md).

| File | SHA-256 after UTF-8 LF normalization |
|---|---|
| `docs/api.md` | `84f5333e9fa247bd5c40b243a8faf78fa455187f8984459b6c651d8be7679274` |
| `docs/architecture.md` | `f69178f7c5e4fb8483be61f2569ee219a346febae8e136135d3fd07efc74725e` |
| `docs/design.md` | `bd7c2ab8bfec0c3d2e32846800c57bc80732c9e5674d4a92d4e3613ad5323609` |

### Historical C03 review status

The author-side mapping and local checks are complete. **Independent
substantive review has not occurred for this corrected candidate.** A
non-coauthor reviewer would need
to inspect score null/degradation rules, NLP readiness, reset transaction
order, watchlist ownership, P0 test expectations and the ZIP exclusions;
their dated comments/corrections and decision must be recorded only after
that actual review. The live #217 comparison also remains unverified.

C03 contract review can finish before the feature owners implement Sprint 4
behaviour. This evidence does not turn planned pytest cases or UI states
into passes. The two earlier local commits are recorded above; no new commit
or push was made during this correction. It claims no mutation, feature TDD
event, new API/browser acceptance, reviewer approval or GitHub closure.

### S4-T03 rating ranking consumer amendment (2026-10-25)

S4-T03 implements the finalized section 13.1 ranking contract without
renaming its private fields. Current API/design hashes follow; historical
C03 captures above remain unchanged. Executed feature results and scope
are in [T03 ranking evidence](s4-t03-rating-ranking/README.md). This capture
does not claim independent review or completion of planned UI work.

| File | SHA-256 after UTF-8 LF normalization |
|---|---|
| `docs/api.md` | `83aa4ea9a3598070888fef7bcfc43ef60912a393bdaf050a0c81261744233d3b` |
| `docs/design.md` | `4293c9997a8af788535bb7e3109cdc57be001bfef5b5e5553a0a89bd58645738` |

### S4-T12 profile/watchlist consumer amendment (2026-10-25)

S4-T12 adds the implemented profile and watchlist API/storage descriptions.
The current normalized-LF hashes for the two changed contract files follow.
Earlier C03, T01 and T03 captures above remain historical records; this
additive row set is not a new independent C03 approval.

| File | SHA-256 after UTF-8 LF normalization |
|---|---|
| `docs/api.md` | `d3599751329010aee59f079406795fbb8fcb07e8d6d895fea625baba1e66643a` |
| `docs/architecture.md` | `61a3019a5edbc8b0365aa247586ebe191786e95e7a991985502aa4e673b52ef8` |

### S4-T09 Search API consumer amendment (2026-10-25)

S4-T09 records the implemented title-first and positive-cosine Search API in
section 13.2 of `docs/api.md`. The current normalized-LF hash for that changed
contract file follows. The earlier C03, T01, T03 and T12 captures remain
historical records. This amendment does not claim new independent C03 approval
or completion of the separate Search UI and Story #30 browser acceptance.

| File | SHA-256 after UTF-8 LF normalization |
|---|---|
| `docs/api.md` | `59cba03a1216fa7c9f082d3aae56ecf6aa0ad8d30f3d6a26fdd9cb6753d4c81d` |

### S4-T07 Similar API consumer amendment (2026-10-26)

S4-T07 records the implemented public Similar API in section 13.2 of
`docs/api.md`, merged with the earlier Search API record from S4-T09. The
current normalized-LF hash for that changed contract file follows. The earlier
C03, T01, T03, T09 and T12 captures remain historical records. This amendment
does not claim new independent C03 approval or completion of the separate
Similar UI and Story #24 browser acceptance.

| File | SHA-256 after UTF-8 LF normalization |
|---|---|
| `docs/api.md` | `22f48e2e2b075115dc6816c1b6b0862024562984b091e6f3e385fa17552ad00a` |

### S4-T13 Profile UI consumer amendment (2026-10-26)

S4-T13 updates design section 12.3 with the delivered Profile/reset states,
validated acknowledgement, ambiguous-response reconciliation and the separate
T14 shared-state handoff. API contracts and historical captures above remain
unchanged. This capture is not a new independent C03 approval or acceptance of
the downstream T14/T15 scope. Executed checks and screenshots are in
[T13 evidence](s4-t13-profile-reset.md).

| File | SHA-256 after UTF-8 LF normalization |
|---|---|
| `docs/design.md` | `c05bd8b9ee78e76cff05da1e0316ea515bfd0c677aaede2623e3f8eaa2be0070` |

### S4-T10 Search UI consumer amendment (2026-10-27)

S4-T10 records the delivered public Search UI in section 13.2 of
`docs/api.md`. Its current normalized-LF hash follows. The earlier C03, T01,
T03, T07, T09, T12 and T13 captures remain historical records. Search now also
supports native form submission with Enter and the Search button, alongside
live results, as detailed in the
[T01 integration contract](../s4-t01-ui-contract.md#s4-t10-search-integration-and-keyboard-submit-2026-10-27)
and [T10 follow-up evidence](s4-t10-search/README.md#keyboard-submit-and-c03-follow-up-2026-10-27).
This additive capture does not claim new independent C03 approval or rewrite
the earlier executed acceptance evidence.

| File | SHA-256 after UTF-8 LF normalization |
|---|---|
| `docs/api.md` | `79ea707de0b4bdf07b439340404a14d3a80f56a11ad4b56f9d908c5867306f94` |

### S4-T04 Ranking score display consumer amendment (2026-10-27)

S4-T04 renames the design label to `Ranking score for you` in section 12.2 and
records the personalised-card rendering in section 12.5. API contracts and the
historical captures above are unchanged. The hash below is for the merged
`docs/design.md`, taken after merging main with the T13 capture. Executed
checks, screenshots and limits are in [T04 evidence](s4-t04-ranking-refresh.md).
This capture is not a new independent C03 approval, and it does not claim the
independent review of T04 itself.

| File | SHA-256 after UTF-8 LF normalization |
|---|---|
| `docs/design.md` | `c67dbd494c6ac1388b92206a71bb8c594389af5878ea2ae16765126d184f396a` |

### S4-T08 Similar UI consumer amendment (2026-10-27)

S4-T08 records the delivered public Similar movies section of `/movies/:movieId`
in section 13.2 of `docs/api.md`. Its current normalized-LF hash follows. The
earlier C03, T01, T03, T07, T09, T10, T12 and T13 captures remain historical
records. The widget, its five Story #24 results and the limits are in the
[T08 acceptance evidence](s4-t08-similar-ui/README.md). This additive capture
does not claim new independent C03 approval or the reviewer's own re-run.

| File | SHA-256 after UTF-8 LF normalization |
|---|---|
| `docs/api.md` | `2830607e57403f09d708663bfee98eac6c472f47e244d67ca1d346eb81886452` |

### S4-T16 S03 execution amendment (2026-10-27)

T16 adds scoped executable S03 pytest/interface mapping and records two
actual return-context regressions. Other P0 rows and C05 shared default
setup/clean-clone ownership remain explicit. This current consumer hash
does not rewrite the historical C03 checks or claim independent approval.

| File | SHA-256 after UTF-8 LF normalization |
|---|---|
| `docs/testing.md` | `f418c9b115a58b24afa26d6192005ec140d22c711d09c22bf45fdea46fe52d6c` |

### S4-T16 same-loop membership concurrency follow-up (2026-10-27)

Linux CI exposed a membership busy-timeout 503. The real SQLite/ASGI
regression TC-P0-S03-006 failed before the worker-handler fix and passed
after it; S03 now has nine executed items. This supersedes only the
previous T16 testing-document fingerprint, not historical results or
independent review/clean-clone acceptance.

| File | SHA-256 after UTF-8 LF normalization |
|---|---|
| `docs/testing.md` | `207cd3e94cb85094a0e11a7ef38d70822d3faca9d4215f4cfa34583dd522f199` |

### S4-T16 PO-authorized half-star, catalogue and Search amendment (2026-10-27)

This consumer amendment changes the current rating domain to exact half steps,
raises the bounded import/default to 50 pages, and makes UI Search submit-only.
The explicit user request authorizes these changes; historical integer-only
C03/Story evidence is retained as history, not claimed as new approval.

| File | SHA-256 after UTF-8 LF normalization |
|---|---|
| `docs/api.md` | `8f5c911fbc486c52c2f9bda2515bc4b4195f49adcaa9971a7521cfcbe3323289` |
| `docs/architecture.md` | `2aa7eb64f45722515ce3c0e5b146866b03610b9bdef4243d31bea025600eeb66` |
| `docs/design.md` | `f934991405d4cef699e908f1af08947bb2bad900b64debd1fa3d4ad563fc7e62` |
| `docs/requirements.md` | `c45177ffc56abe866f9fa607c8134daced0e9f2aee1a46762a021631778fa92e` |
| `docs/testing.md` | `e230d6eaa41b86fd50dc86429b24430ee78a71ad1a410412dc43de00d8cd0ca9` |

### S4-T16 complete Search pagination amendment (2026-10-27)

The PO replaced the top-ten-total Search cap with full-set pagination. Title
precedence and positive-cosine eligibility remain unchanged. Current Story
#30, requirements and API/UI contracts now specify ten per page, full totals,
revision recovery and query/page detail return. Historical cap evidence stays
historical; this amendment does not claim Story acceptance or reviewer approval.

| File | SHA-256 after UTF-8 LF normalization |
|---|---|
| `docs/api.md` | `90072c21ed9d6e51352f67f08c5c3f9cc03b0c0397329a6270497a512d4d7302` |
| `docs/requirements.md` | `ab8a653d7a36d31e83bdce6f2fd243b8156746e224cee665abd34de1cd574101` |
| `docs/testing.md` | `2779ffb946f083ba1e7af23a2ebc1ef86953a49cb82662a1eb0d698bc160124c` |

### S4-T16 current-page Popular carousel and compact collection headings (2026-10-27)

The PO authorized each Popular page's first three entries as a manual carousel
and compact Popular/Search/Watchlist headings. Summary DTOs add a validated
nullable backdrop URL; ranking, paging, ownership and NLP inputs do not change.
Actual execution is in [the carousel evidence](s4-t16-spotlight.md). These hashes
identify the current documentation, not an independent approval or Story closure.

| File | SHA-256 after UTF-8 LF normalization |
|---|---|
| `docs/api.md` | `5fabac42cea87cc1a7b22845924cb4cd873e63fe39b45995934b57f815cbba36` |
| `docs/architecture.md` | `3d23d7ddf48f789e55518c41787c4034d7d8d5eb9c24ec2b0033edcfca91c843` |
| `docs/design.md` | `aaed16ff142183eafc3457faf84f96c42cf21b8092a6bd2fd594a3ccc0981e47` |
| `docs/testing.md` | `c8d92cbc1f995fedf4d8dd4e31a2a8a43558e92b9584159128299f1a702fbbae` |

### T14/T16 integrated gate and regression handoff (2026-10-28)

Merged T14 reset/runner behavior is retained alongside T16's consumer changes.
The current testing contract records 19 T16 browser cases and the unified
exact method/path/tag gate. [Integration execution](s4-t16-t14-reconciliation.md)
distinguishes local results from CI and independent review; no Story is closed
or acceptance checkbox auto-checked by this documentation update.

| File | SHA-256 after UTF-8 LF normalization |
|---|---|
| `docs/testing.md` | `696ffea3bf9a3ae08556bf7b456f999ec52e495dfd32b45f89f0df3df67d9d8b` |
