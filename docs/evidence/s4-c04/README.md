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

C04 compact execution and structural checks are recorded in
`verification.json` and `pytest-v.log` after they actually run. They are
author verification by Codex, not a separate member's independent rehearsal.
No full backend/Vitest/browser regression is required for this report.

## Supplied board images and provenance

The originals are copied unchanged, with SHA-256s in the verification receipt.
The user supplied them on 1 November; no unverified capture date is asserted.

| Original | Observed content | Permitted description / remaining action |
|---|---|---|
| [Iteration view](board-late-iteration.png) | Sprint 4 contains T17/T20/C02 already Done, including PR #244 | Late Sprint 4 iteration snapshot. It does not establish the state immediately after Planning on 20 October. Historical Planning image or an explicit instructor exception remains to be supplied/confirmed. |
| [End snapshot](board-end-sprint.png) | Project-wide Done=117; C04 is in Done while its issue icon is Open | User-reported end-of-Sprint snapshot. 117 is project-wide, not Sprint 4 velocity/item count. It does not prove C04 submitted/Closed; use an honest cutoff caption, and reconcile the card status with remaining submission work. |

The final board need not show every item Done. A screenshot of the true
submission-day state is acceptable while C04's actual submission is still
pending. No current image is renamed as historical Planning proof.
An exception, if actually granted by the instructor, must name what was
allowed and the factual source; it is not inferred from exceptions in earlier
sprints.

## C05 independent acceptance boundary

C05 #219 is Closed and has formal approvals. Its committed compact record
still states that independent teammate reproduction/acceptance is required;
the visible approvals say `ok` and no independent command/result receipt
was found. The C04 author cannot fill that factual gap by changing the word
Pending. Link the actual eligible reviewer's dated commands/results if the
team performed the check, or complete the remaining acceptance honestly.
Existing author clean-clone/TMDb/recovery evidence can be reused with its
original source identity; no new 800-test run is required.

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

## Completion checklist for #218

- [x] Report remains four sections with all six P0 Stories and linked root tests.
- [x] C01/C02 closures and merged member-test evidence are acknowledged.
- [x] Original user images are preserved with accurate descriptions.
- [ ] C04 compact/trace/contract/link checks have actually passed; see receipt.
- [ ] Authentic Planning screenshot or explicit instructor-approved exception.
- [ ] Actual submission-day board selected with a truthful cutoff caption/status.
- [ ] C05 independent acceptance receipt reconciled with its Closed state.
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
