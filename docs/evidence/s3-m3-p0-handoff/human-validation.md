# Human-only acceptance gates — not completed by automation

Status: **user-confirmed walkthrough; session details/sign-off pending**.
On 2026-10-18 the PO confirmed in chat that Trang, an unfamiliar participant,
had already tried the P0 journeys unaided. This is a second-hand confirmation,
not an observation by Codex. The session date, version and individual outcomes
were not supplied and are not invented. Browser automation is separate evidence.

## Unfamiliar-person P0 walkthrough (#127)

Use an accepted TMDb catalogue and disposable accounts. Begin each normal
journey at `/` using visible controls, without coaching or typed feature URLs.
Record actual outcomes; if assistance is needed, record it and retest after a
fix instead of claiming an unaided pass. Do not record private credentials.

| Field | Actual observation |
|---|---|
| Participant name or agreed alias | Trang — confirmed by PO in chat |
| Date/time and observer | Session date/observer not supplied; PO confirmation received 2026-10-18 |
| Tested PR head/application version | Not supplied; do not assume the new PR head was tested |
| Catalogue provider/revision | Pending |
| Prior involvement/familiarity | Unfamiliar participant, according to PO's response to the unaided-walkthrough question |

| Journey | Stories | Actual result | Assistance/blockers |
|---|---|---|---|
| Public home → popular → movie details → return | S03; S09 separately | Pending | Pending |
| Home → registration → sign-in → popular cold start | S12, S13, S04 | Pending | Pending |
| Enter preferences → zero-choice correction → save 1–5 → personalised cards/reasons | S01, S02, S04 | Pending | Pending |
| Recommendations → details → return → restored preferences | S01, S03 | Pending | Pending |
| Sign out → protected action → login; sign in again | S13 | Pending | Pending |
| Separate B account sees no A preferences/rating/personalisation | S13 | Pending | Pending |

Use existing API/DB tests for forged identifiers and reset attacks; do not claim
that the protected profile placeholder is a completed reset UI.

The PO should fill the journey rows from Trang's actual recollection or replay
before final sign-off. The confirmation does not establish that every AC was
tested, that there were no blockers, or that the final version was used.

## Independent C04 review

C04 #135 is closed and PR #185 is merged at
`0c4273ab792becb060fefd5e7341e755ed28d0a5`; executable/setup evidence exists.
The observed approval is by @kietxuan, who also authored follow-up commit
`24a6645be191ecc16aeb2045cc76c3488718b384`. That approval alone is not evidence
of review independent of every contributor. A non-contributing teammate must
record their actual inspection, findings and reproduction on the merged C04
files. Link its real record here; do not fabricate or backdate an approval.

- Independent reviewer: pending.
- Reviewed candidate/files and reproduced checks: pending.
- Actual findings/resolution and record URL: pending.

The PO said a teammate review would be added on GitHub shortly. At the last
inspection on 2026-10-18, PR #185 still had only the approval described above.
A promised future review is not recorded as an existing approval.

## Final T25 review

The earlier @kietxuan approval on `4f3b2d2` is historical, not approval of this
follow-up authored on their behalf. @hoang3003, @vu-huzy, or another teammate
who did not write the final changes must review the final PR head. Confirm the
participant record, C04 independence clarification, AC matrix, new CI results
and source fingerprints before final sign-off. Do not merge/close #127 until
its mandatory gates are satisfied.
