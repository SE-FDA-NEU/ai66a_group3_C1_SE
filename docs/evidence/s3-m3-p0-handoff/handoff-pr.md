# T25 handoff PR and independent reviewer checklist

PR: [#184](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/184)

Title: `[#127] Verify final M3 P0 acceptance and prepare handoff evidence`

This is an existing PR, not unpublished/proposed work. It integrates C04 merge
`0c4273ab792becb060fefd5e7341e755ed28d0a5`. Product application files match that
main. [verification.json](verification.json) records actual tested local snapshot
and executable fingerprints. Final hosted checks must target the published head.

## What changed

- Run M3 verifier regressions in the existing **Ubuntu/Windows** CI matrix;
  previously `test:m3:verifier` existed but no workflow invoked it.
- Explicitly disable provider networking in M3 runtime children. Allow installed
  browser channel locally; keep default Playwright Chromium unchanged.
- Refresh six-P0 matrix, separate S06/S09 report, current 255-film provenance,
  C04 merged state, safe reproduction and #136 handoff.
- Preserve old macOS evidence as history; add actual Windows logs/captures and
  current executable-source hashes. No old count/SHA is silently overwritten.
- Record PO-confirmed Trang walkthrough without inventing session details;
  keep genuine review gates and T33 bridge intermittency explicit.

## Verification actually performed

- Isolated backend **419 passed / 1 inherited skip**; Ruff passed.
- Frontend **236 passed**; lint and production build passed.
- M3 verifier **11 passed on Windows**; S04 cleanup **3 passed**.
- S04/S13 synthetic browser **10 passed / 1 intentional live skip**; separate
  accepted-TMDb S13 **1 passed**; M3 live **five grouped checks + cleanup PASS**.
- T12/T21 browser and T22 catalogue-copy verifier **PASS**; T16 bridge **1 passed**.
- T33 bridge: first attempt failed at logout, then standalone rerun and five
  further standalone repetitions passed. The first failure remains in evidence.
- T28 synthetic backdrop **18 passed**, temporary database removed.
- Existing C04 fresh-installed clone advanced to integrated source: `pip check`,
  M3 verifier and build PASS; first-screen browser replay PASS on its separate
  20-film TMDb snapshot. This is not another fresh dependency installation.

Reproduction, source boundaries and current captures: [README](README.md).
These are viewport screenshots, not #136 address-bar submission images.
Reset remains API-only; ratings do not rerank Sprint 3 recommendations.

## Definition of Done — remaining checks stay unchecked

- [ ] Every #127 gate, including human/session details, is verified.
- [x] Merged C04 fresh-clone/setup evidence is linked.
- [x] Automated acceptance/verifier regression coverage is included.
- [ ] Hosted CI on the final published head is green and inspected.
- [x] No token, `.env`, DB/dump, password or cookie is intended in this diff.
- [x] Setup/docs state is reconciled with merged C04.
- [ ] Substantive independent review of this final head is recorded.

## Independent reviewer checklist

1. Compare final-head executable fingerprints and inspect the new M3 step in
   **both OS jobs**, not merely the existence of the test file.
2. Reproduce visible navigation from `/`: registration/login, cold start,
   1–5 preferences, reasons, details/return and sign-out.
3. Inspect exact messages, data/loading/empty/error/retry, BR1 rejection, all
   five S13 ACs, API/DB attacks/reset/restart and stale-response cases.
4. Check live provenance, unchanged accepted source, synthetic separation,
   mobile/keyboard and no sensitive artifacts.
5. Inspect failed T33 log and passing reruns; do not erase the first result or
   claim a definitive cause without reproduction evidence.
6. Complete [human validation](human-validation.md): actual Trang session
   details and genuine independent C04 review clarification; confirm #136 limits.
7. Leave substantive feedback, resolve it and formally approve/merge only after
   mandatory gates pass. Kiet's `4f3b2d2` approval is historical because Kiet
   contributes this follow-up; use a non-contributing reviewer.

No Story is newly closed here. `Closes #127` should take effect only when the
team merges after sign-off. PO reconciles already-closed #44/#45 separately.
AI assistance: Codex for acceptance tooling, tests, evidence/docs and the single
follow-up integration commit; no generated human approvals or test outcomes.
