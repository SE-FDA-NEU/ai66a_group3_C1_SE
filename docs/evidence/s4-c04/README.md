# C04 report integration and manual submission — 1 November 2026

PR [#246](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/246),
Refs [#218](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/218).
This is a report/evidence handoff. Export and LMS submission are manual steps
after the Markdown has been reviewed and merged; this PR does not close #218.

## Accepted baseline and integration

Main `a9cfdb3601e1ab75b87cd0859b6e829b022c2a2a` includes C02 #244
and C01 #245. C01 #216, C02 #196 and C05 #219 are Closed on GitHub at this
read. The inherited pending-state text is historical and is not used to
claim those issues remain Open.

The two conflicts in `docs/testing.md` and the C03 acceptance matrix were
resolved by preserving the current main's S02 9/10/11 assertions, accurate
case descriptions, root-test relocations and original dated fingerprints.
C04 retains the SM4 README note and a four-section report with explicit
candidate/results. The draft's unsupported 14.65s row is removed. Existing
C05/C02 execution logs remain unchanged at their own sources.

No application, default pytest selection, test assertion or workflow is
changed by C04. The report still has 37 logical P0 IDs / 40 collected items;
extra root tests remain optional. Tests, manifests and review links are
consumed from [C02 finalization](../s4-c02-finalization-20261101.md), including
five attributable member contributions, 18 accepted Story points and the
reported 1 November Review/Retro/SM5 handoff.

## Execution and full-output screenshot

The primary report embeds [the complete C02 output screenshot](../s4-c02-integration-pytest-20261101.png).
It contains the command, all 40 selected names and 40 passed in **13.74s**.
It is a browser capture of saved real output, labelled as such, not a native
terminal capture. Its two selected test files/config match the current merged
source; this equality is checked before reuse. C05's clean-clone screenshot
remains [separate historical proof](../s4-c05/checks/compact-verbose-output.png).

The supplied native-terminal image below shows **40 passed / 11.62s**, but
begins at 42%; the earlier test names/command are outside the image.
It is retained as supplemental evidence and is not labelled full output.
The existing full image fulfills the output-content requirement. If the team
selects a new native-terminal image for the final PDF, it must show every
selected name and its own actual command/result/runtime.

[Supplied terminal image](user-pytest-partial.png).

On committed integration `1a993f35f0c8cd2e7472822017f5350630b93ac7`, the
actual C04 command was:

```text
python -m pytest -v --junitxml=docs/evidence/s4-c04/pytest-v.xml
```

**40 passed, zero failed/skipped/xfail, 12.48 seconds**, with one inherited
Starlette/httpx warning. [Full output](pytest-v.log), [JUnit](pytest-v.xml)
and the [verification receipt](verification.json) record the source/count and
result. This run is Codex author verification; Hoang's independently reported
C05 check remains a separate process confirmation below. No full
backend/Vitest/browser regression was run for C04.

Default 37-ID/40-node traceability, four-section contract/fingerprints,
LF/CRLF export equivalence, 146 structural local links and 103 current
report/handoff links/anchors passed. All 77 portable main hyperlinks map to
targets in the proposed PR tree. Git diff checks are clean.

## Supplied board images and provenance

The originals are copied unchanged, with SHA-256s in the verification receipt.
The user supplied them on 1 November; no unverified capture date is asserted.

| Original | Observed content | Permitted description / remaining action |
|---|---|---|
| [Iteration view](board-late-iteration.png) | Sprint 4 contains T17/T20/C02 already Done, including PR #244 | Late Sprint 4 iteration snapshot. On 1 November the PO explicitly reported that the instructor permitted this late image instead of an immediate Planning screenshot for M4. Use that exception caption; do not label it as captured on 20 October. |
| [End snapshot](board-end-sprint.png) | Project-wide Done=117; C04 is in Done while its issue icon is Open | User-reported end-of-Sprint snapshot. 117 is project-wide, not Sprint 4 velocity/item count. It does not prove C04 submitted/Closed; use an honest cutoff caption, and reconcile the card status with remaining submission work. |

The final board need not show every item Done. A screenshot of the true
submission-day state is acceptable while C04's actual submission is still
pending. No current image is renamed as historical Planning proof.
The M4 exception was confirmed explicitly by the PO in the project conversation
on 1 November: the instructor allowed the late board image. This is the factual
source of the exception; no instructor quotation or historical capture date is
invented, and permission is not inferred from an earlier Sprint.

## C05 independent acceptance boundary

C05 #219 is Closed and has formal approvals. On 1 November the PO confirmed
that **Tran Minh Hoang (@hoang3003) independently checked clean clone/setup
and recovery on 1 November**. This named/date confirmation reconciles the
earlier Pending process entry with the Closed state. Hoang also formally
approved C05's final head on GitHub.

The PO did not supply Hoang's exact command log, machine, runtime or tested SHA;
none is manufactured. Existing C05 technical tables/logs remain Codex's author
verification at their original source identity. They are reused as technical
evidence and are not relabelled as Hoang's output. See the dated follow-up in
[C05's record](../s4-c05/compact-m4.md#c04-process-follow-up--1-november-2026).

## Cover information for manual export

```text
Team:           Team 03 — AI Movie Recommendation System (CineAI)
Topic:          AI Movie Recommendation System
Members:        Nguyen Xuan Kiet (11247306)
                Tran Minh Hoang (11247292)
                Tran Tuan Anh (11247264)
                Vu Quoc Huy (11247301)
                Nguyen Tuan Anh (11247260)
Product Owner:  @kietxuan
Scrum Master:   @anotify-vie (Sprint 4; SM3 was @vu-huzy)
Submitted by:   Nguyen Xuan Kiet
```

Repository: [group repository](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE).
Project board: [Project 9](https://github.com/orgs/SE-FDA-NEU/projects/9).
Setup guide: [SETUP on main](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/blob/main/docs/SETUP.md).
Use these full GitHub destinations in the PDF, not local Windows paths.
The report's non-image hyperlinks also use full GitHub main URLs; its one
relative image stays embedded from the committed PNG. These new main URLs
become available after the report PR is merged, before manual PDF export.

## Completion checklist for #218

- [x] Report remains four sections with all six P0 Stories and linked root tests.
- [x] C01/C02 closures and merged member-test evidence are acknowledged.
- [x] Original user images are preserved with accurate descriptions.
- [x] C04 compact execution passed (40 items); the receipt records structural/trace checks separately.
- [x] PO confirms instructor-approved use of the supplied late Planning-board substitute for M4; caption records the exception.
- [x] Original end-of-Sprint board selected with a truthful cutoff caption; verify it is still the submission-day state during manual export.
- [x] C05 independent checker/date confirmed by PO and reconciled with Closed state; original author logs remain attributed correctly.
- [ ] Final non-contributor review has a substantive comment and approval.
- [ ] Report PR merged into main with technical CI passing.
- [ ] Manually export merged report to Team03_M4.pdf and inspect layout/links.
- [ ] Submit on LMS and record the actual receipt/time before closing #218.

Manual PDF layout: Page 1 cover only; Page 2 the two authentic/approved board
images; Page 3 one full-output pytest screenshot with every name visible.
The four report sections follow in order. Check legibility at ordinary PDF
zoom and compare all numbers/source labels with merged main. No PDF/export
tools or generated submission PDF are committed.

After submission, record the real receipt link/reference and completion date
here or on #218, then close the issue. A Project card in Done is not proof
of native issue closure or LMS submission. Until then this PR uses Refs #218.
