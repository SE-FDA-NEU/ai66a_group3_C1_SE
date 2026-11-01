# Sprint 4 backlog refinement and Planning record

C01 [#216](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/216). Product Owner: **@kietxuan**.
Planned independent reviewer: **@anotify-vie**, provided they did not contribute
to this change. SM4 is @anotify-vie, distinct from SM3 @vu-huzy; SM5 handoff
remains @kietxuan.

## Planning facts and evidence

On **1 November 2026**, the PO confirmed in the project conversation that
Sprint 4 Planning occurred on **20 October 2026** and committed all four Stories
below, totalling **18 points**. This is a later confirmation of that decision,
not a claim that this document existed on Planning day. No Sprint end date
is inferred from the date of this refinement.

The refinement baseline is main
[`0d2378d`](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/commit/0d2378d5f0c44889ca93c8cff7c8bc9c568b43c5),
which includes merged C05 [PR #243](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/243).
The [Sprint 3 handoff](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/blob/0d2378d5f0c44889ca93c8cff7c8bc9c568b43c5/docs/sprint-log.md#sprint-3---2026-10-05-to-2026-10-18)
and [current requirements](requirements.md) remain the source for previously
accepted P0 scope.

[Project 9](https://github.com/orgs/SE-FDA-NEU/projects/9) is the live board.
**Historical Planning screenshot missing:** no authentic Sprint 4 Planning
image was supplied or found in this checkout. Existing Sprint 3 screenshots
must not be relabelled. C04 must disclose this gap or use authentic historical
evidence if the team finds it; a current screenshot cannot prove the old state.
The PO also reports that the **final board has not yet been captured** while
Chores remain open. The final/submission-day image belongs to C04, and the
Review/cutoff board to C02; neither is a prerequisite for closing C01.

The [machine-readable snapshot](evidence/s4-c01-planning.json) records the
baseline, native assignments, dependencies and states observed on 1 November.
It is a dated inventory, not live acceptance evidence.

## Goal, original commitment and point accounting

Deliver rating-informed recommendations, shared-index Similar/Search,
persistent watchlist and safe profile/reset using the agreed cinematic UI.
Preserve the six already accepted P0 journeys and demonstrate the M4 testing
rubric through a compact, reproducible offline pytest suite.

| Story committed at Planning | Priority | Points | Acceptance responsibility |
|---|---|---|---|
| S05b [#22](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/22) — rating-informed recommendations | P1 | 5 | T02–T05; C02 reconciles whole-Story AC/DoD |
| S07 [#24](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/24) — content-similar movies | P1 | 5 | T06–T08; C02 reconciles whole-Story AC/DoD |
| S08 [#30](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/30) — title/overview search | P1 | 5 | T06, T09, T10 and accepted Search amendments |
| S11 [#33](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/33) — reset personalisation | P2 | 3 | T11–T15, including account isolation and retained watchlist |
| **Original committed total** | | **18** | PO-confirmed on 1 November |

These are committed points, **not a claim of 18 completed points**. All four
parent issues were still Open at the snapshot. C02 must use actual acceptance
decisions to calculate completed points and velocity, counting each Story once.
Already delivered S05a [#21](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/21) and the six P0 Stories earn no repeated
Sprint 4 points. Task/Chore Points stay blank.

## Retained scope and approved amendments

| Scope | Current decision and source |
|---|---|
| Existing UI and navigation | Preserve shared light/dark components, truthful session navigation, Home after login, explicit Start → Preferences, poster/backdrop fallback and centered server-confirmed action feedback. [Design](design.md) and T01 [#195](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/195) own the baseline. |
| Recommendations | Rank the full eligible set, apply the view genre filter, then paginate; keep raw TMDb popularity, personal ranking score and saved rating distinct. [API](api.md) and [business rules](business-rules.md) remain authoritative. |
| Stars | The PO extended the original integer-star UI to **0.5–5 in 0.5 steps**, with explicit Save and draft/saved separation. Preserve [requirements](requirements.md) and [T16 amendment evidence](evidence/s4-t16-extensions.md); do not revert to the initial integer-only contract. |
| Search | Submit with Enter/Search; typing alone does not query. Paginate all eligible title-first/positive-cosine results, at most 10 per page, without a top-ten-total cutoff. See [accepted Search amendment](evidence/s4-t16-search-pagination.md). |
| Watchlist/reset | Account-owned persistent watchlist; saving it does not rerank recommendations. Confirmed reset clears only the current account's genres/ratings and **keeps watchlist**, with race/rollback/recovery handling. |
| Catalogue and media | Runtime reads the TMDb-imported local DB/index; token stays server-side. [SETUP](SETUP.md) imports 50 pages, aiming for about 1,000 movies without guaranteeing an exact valid count, and supports full-catalogue media enrichment. |
| G4 and trailer | The PO reported G4 Go before trailer work and explicitly accepted the later embedded-player change. Preserve [the dated G4 status correction](evidence/s4-t18-core-pre-g4/follow-up/README.md) and [T20 audit](evidence/s4-t20/media-setup-audit.md): official YouTube selection, button below poster, unavailable caption, on-page playback and safe failure. Old pre-Go/external-tab logs remain historical. |
| M4 test/report amendment | On 1 November the PO selected the instructor's compact six-P0 report/default suite; this changes execution/reporting scope, not feature AC or acceptance history. Details below. |
| Sprint 5 scope | VN watch providers/JustWatch attribution and previously planned release revalidation remain Sprint 5. No additional unfinished Sprint 4 feature/build/recovery output is deferred by this record. |

Amendments add no Story points here. A further transfer must name the unfinished
output, reason, owner, destination issue and explicit PO decision; C02 must then
count it as unfinished or carried over, never silently Done.

## Backlog, dependencies and independent review

Retain **25 items: 18 core Tasks + five Chores + two G4-gated trailer Tasks**.
This table describes the agreed dependency order, not newly performed historical
gates. Early T01/T11 work was explicitly authorized by the PO before C03 and was
later reconciled; do not rewrite that history as contract-first implementation.

| Issue | Native owner | Planned reviewer | Depends on | State at snapshot |
|---|---|---|---|---|
| C01 [#216](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/216) | @kietxuan | @anotify-vie | None | open |
| C02 [#196](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/196) | @anotify-vie | @kietxuan | #219, #216 | open |
| C03 [#217](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/217) | @hoang3003 | @NguyenTuanAnh0608 | #216 | closed |
| C04 [#218](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/218) | @vu-huzy | @anotify-vie | #196, #219, #217 | open |
| C05 [#219](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/219) | @NguyenTuanAnh0608 | @vu-huzy | #213, #195, #201, #206, #207; #215 when trailers ship | open |
| T01 [#195](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/195) | @kietxuan | @hoang3003 | #217 | closed |
| T02 [#197](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/197) | @hoang3003 | @anotify-vie | #217 | closed |
| T03 [#198](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/198) | @anotify-vie | @NguyenTuanAnh0608 | #197, #217 | closed |
| T04 [#199](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/199) | @vu-huzy | @anotify-vie | #198, #195 | closed |
| T05 [#200](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/200) | @NguyenTuanAnh0608 | @vu-huzy | #197, #198, #199, #209 | closed |
| T06 [#201](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/201) | @NguyenTuanAnh0608 | @hoang3003 | #217 | closed |
| T07 [#202](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/202) | @vu-huzy | @hoang3003 | #201 | closed |
| T08 [#203](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/203) | @vu-huzy | @NguyenTuanAnh0608 | #202, #201, #195 | closed |
| T09 [#204](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/204) | @NguyenTuanAnh0608 | @vu-huzy | #201 | closed |
| T10 [#205](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/205) | @anotify-vie | @vu-huzy | #204, #195 | closed |
| T11 [#206](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/206) | @kietxuan | @anotify-vie | #217 | closed |
| T12 [#207](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/207) | @hoang3003 | @anotify-vie | #206, #195, #217 | closed |
| T13 [#208](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/208) | @kietxuan | @NguyenTuanAnh0608 | #207, #195 | closed |
| T14 [#209](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/209) | @hoang3003 | @anotify-vie | #208, #199 | closed |
| T15 [#210](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/210) | @vu-huzy | @anotify-vie | #207, #208, #209, #200 | closed |
| T16 [#211](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/211) | @kietxuan | @NguyenTuanAnh0608 | #199, #203, #205, #207 | closed |
| T17 [#212](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/212) | @anotify-vie | @hoang3003 | #199, #198 | closed |
| T18 [#213](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/213) | @anotify-vie | @NguyenTuanAnh0608 | #195, #198, #200, #203, #205, #207, #210, #211, #212 | closed |
| T19 [#214](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/214) | @hoang3003 | @anotify-vie | #213, #217 | closed |
| T20 [#215](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/215) | @NguyenTuanAnh0608 | @anotify-vie | #214, #195 | closed |

T19 required G4 Go before implementation. The PO reported Go; this record does
not invent a dated capacity meeting. C05 includes T20 because the selected
candidate ships trailers. C02 also consumes actual feature acceptance; C04
consumes all accepted functional/process evidence. These broad acceptance inputs
are not replaced by the short dependency edges above.

Two legacy body fields differ from native assignments: T15 #210 names
@NguyenTuanAnh0608 as owner, and T20 #215 names @vu-huzy with the current assignee
as reviewer. **Native owners above prevail for current planning.** The snapshot
preserves those body fields; the table provides independent planned reviewers.
It does not claim they approved past PRs or erase actual contributors.
If a planned reviewer contributes, choose another non-contributor for approval.

## Remaining work and capacity decision

The PO explicitly requested **no hour totals** on 1 November. Accordingly,
historical estimates and equal issue counts are not presented as approved
availability. Remaining work is allocated by concrete outputs and review
accountability below. This does not claim five assigned issues represent equal
effort or that measured capacity has been verified.

| Member | Remaining accountability at this snapshot |
|---|---|
| @kietxuan — PO / C01 | Confirmed original commitment; review this refinement, resolve scope/acceptance decisions and independently review C02. |
| @hoang3003 — C03 owner | Support API/schema/media reconciliation and review assigned integration corrections where eligible; steward S13 tests. |
| @anotify-vie — SM4 / C02 | Independently review C01/C04 where eligible; complete actual Review/retro, outcomes, contribution audit and SM5 handoff. |
| @vu-huzy — C04 | Independently verify C05 if not a contributor; audit the report/traceability, collect authentic final board, obtain review, manually export/submit and record receipt. |
| @NguyenTuanAnh0608 — C05 | Complete remaining independent clean-clone/build/index/storage/recovery acceptance using matching evidence, without an automatic full-regression rerun. |

At the source snapshot, **21 items are Closed and four Chores remain Open**
(C01/C02/C04/C05). Merged C05 implementation does not itself prove the Chore's
whole independent acceptance. C02 [PR #244](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/244)
was Open at head `186deb5`; consume its final reviewed outcome after merge,
not as an already merged handoff.

## Compact M4 tests and member stewardship

Keep [testing.md](testing.md) to the instructor's four sections, in order:
what/why, every P0's cases, automated execution and a genuine finding or
rule-breaking experiment. The six P0 remain S01/S02/S03/S04/S12/S13.
Each needs at least three meaningful cases: normal flow, business refusal and
below/on/above numeric business boundaries where applicable.

Default [pytest.ini](../pytest.ini) selects only
[test_p0_acceptance.py](../tests/test_p0_acceptance.py) and
[test_s03_details.py](../tests/test_s03_details.py): currently **37 logical IDs /
40 parameterized items**. These are observed baselines, not a fixed quota.
Tests use isolated temporary DBs/fakes without a server, real DB, token or live
provider network. Extended backend/frontend/browser/script tests are retained
as explicit opt-ins when changed code or an unresolved concern justifies them;
they are not hundreds of additional mandatory M4 report cases.

| Steward | P0 cases to maintain/verify | Source |
|---|---|---|
| @kietxuan | S01 — TC-P0-S01-* | root test_p0_acceptance.py |
| @hoang3003 | S13 — TC-P0-S13-* | root test_p0_acceptance.py |
| @anotify-vie | S02 and S04 — TC-P0-S02-* / TC-P0-S04-* | root test_p0_acceptance.py |
| @vu-huzy | S03 — TC-P0-S03-* | root test_s03_details.py |
| @NguyenTuanAnh0608 | S12 — TC-P0-S12-* | root test_p0_acceptance.py |

Stewardship is **accountability, not authorship credit**. C02/C04 verify each
member's actual authored pytest/node/commit, merged PR, formal review given and
Closed issue. Existing qualifying contributions count; no extra dedicated test
PR is required. Do not invent coauthors or assume distinct GitHub accounts belong
to one person. If a gap is found, the named steward must complete a meaningful
test contribution and obtain review before claiming that requirement met.

Team thresholds remain at least four merged PRs reviewed by someone else and
five Closed issues. C02/C04 own the actual contribution ledger, including
approval timing/head and non-contributor status; assignee/state alone is
insufficient.

C05 [#219](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/219) owns default execution, clean clone and retained
build/index/persistence/backup/recovery. Its [compact verification](evidence/s4-c05/compact-m4.md)
records candidate-specific author runs, not independent teammate acceptance.
C04 [#218](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/218) owns final traceability/report/submission; C02 [#196](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/196)
owns actual outcomes/contributions. The compact amendment does not waive
functional/security/build/recovery obligations or claim old tests ran against
a new candidate.

## Review and C01 closure

C01's Planning output is this record, its source snapshot and the README link.
No product code, real database, secret, PDF or export tool is changed.

Before merging this C01 PR, a non-contributing teammate must use **Review
changes**, leave a substantive comment on commitment/scope/dependencies and
formally approve the final version; technical CI must pass. Then merge and
link this record from #216. The closing directive can close C01 at that merge.
No approval, merge or closure is claimed by this document.

The missing historical Planning image is disclosed above and remains a C04
evidence risk to resolve honestly. Final board capture, end-of-Sprint
Review/retro, four parent Story closures, per-member completed contributions,
final PDF and LMS receipt belong to their respective later owners; they do not
keep an otherwise reviewed Planning issue Open.
