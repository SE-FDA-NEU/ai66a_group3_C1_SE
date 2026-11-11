# C02 current release observations — 11 November 2026

These are actual read-only observations made while preparing the C02 PR, not a
finished Sprint Review, physical-phone check, PO decision or LMS submission.
[Current wrap-up and remaining gates](../../s5-c02-wrap-up.md).

| Evidence | Reproduction / boundary |
| --- | --- |
| [render.json](render.json) | Authenticated Render get_service/list_deploys for CineAI in confirmed My Workspace; current live acc4924. Prior deploy of that SHA was cancelled; do not relabel it successful |
| [github.json](github.json) | GitHub main/ci.yml, issues #247–#256, PRs #257–#265 reviews/commits/head CI, effective branch rules, release existence and S10/S12 criteria/estimates. Formal approval is not automatically substantive/final-head independent review |
| [runtime.json](runtime.json) | Read-only Neon PostgreSQL version/head/active catalogue/provider-check and membership/link counts; runtime SELECT permissions; public health and same-movie Details DTOs for all three countries. No account records, private URI or dump |
| [monitoring.json](monitoring.json) | Complete Render app-log windows 13:45–13:50 and 13:50–13:55 UTC, 2+1 pages, deduplicated completed requests; only status/app-ms/is-health samples. Second window contains only health requests; neither is a user-load benchmark |
| [c02-public-probe.json](c02-public-probe.json) | Fresh headless Edge desktop/mobile-emulation contexts on the actual public app: **14/14 pass**, compared to the historical 7/7 regional split. Prober source commit acc4924; deployedSha stays null because the probe itself cannot authenticate Render; the separate Render record establishes identity. fullIssueAcceptance stays false |
| [Desktop](c02-public-detail-desktop.png) / [390px emulation](c02-public-detail-mobile-emulated.png) | Actual public Details screenshots; neither has an OS browser address bar or proves use of a physical phone |

## Commands and results

From the repository root with SETUP dependencies installed:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
node --test frontend/scripts/s5-t07-contract.node-test.mjs
node scripts/verify-s3-c01-docs.mjs
$env:S5_T07_PUBLIC_URL = 'https://cineai-o9tf.onrender.com'
$env:S5_T07_PROBE_LABEL = 'c02-public'
$env:S5_T07_OUTPUT_DIR = '.venv/m5-audit/c02-public'
node frontend/scripts/s5-t07-public-probe.mjs
```

Actual current P0 run: **40 passed**, one inherited Starlette/httpx deprecation
warning; no app/test change was made to hide it. Current verifier contract:
**18 passed**. Documentation check passes. The browser probe performs public
read-only navigation/API calls, no registration/rating/reset/account writes.
Its screenshots are actual observations, not generated mockups. Historical T07
local/account/mutation evidence is reused at its recorded version, not rerun
or declared final-candidate account acceptance.

Recalculate monitoring using samples per window: n=len(samples), error rate =
count(status>=500)/n, health=count(is_health), sorted app times and nearest-rank
quantiles at ceil(n*0.50)-1 / ceil(n*0.95)-1. Check 101/70 completions,
71/70 health, zero 4xx/5xx and p95 408.67/99.85 ms. Startup lines are excluded.
App time does not include platform wake-up or network transit.

## What this does not certify

Full six-P0 authenticated journey, real phone/private-laptop human test, actual
PO acceptance, five-person timed rehearsal/Review/Retro, substantive final PR
review, required-status-check enforcement/screenshot, durable shared backup
access/independent reproduction, maintenance acknowledgement, v1.0 or PDF/LMS
receipt remain in C02. See the named R01–R09 checklist. All secrets and archives
remain private; no PDF or export utility is added to Git.

## Final follow-up: received and executed evidence

- [Read-only repeat](final-public-probe.json): 14/14 pass; raw legacy human flags
  remain unchanged, with actual user report separately recorded.
- [Reused synthetic-account run](final-public-reused-accounts.json): 8/8 pass.
- [Fresh registrations/account run](final-public-new-registration.json): 8/8 pass,
  A/B registration HTTP 201, duplicate 409, rating 200 and persistence/isolation.
  Exactly two new dedicated synthetic users; no real user or credential values.
- [Device/PO report](human-device-report.json): Kiet reports physical phone and
  private laptop OK on 11 November, then explicitly accepts Live acc4924. Device
  models/browser/per-device SHA unreported, never invented.
- [Health correlation](health-correlation.json): exact request ID matches Render
  HTTP 200 at 25.89 ms on the accepted live source.
- [Regional backup verification](regional-backup-verification.json) and
  [restored app/index](restored-runtime-check.json): 13 snapshot tables match,
  rebuild/check index pass, restored health and three countries HTTP 200. Archive
  stays private; this is not a teammate's independent run or durable cloud storage.
- [Release status](release-status.json): annotated v1.0 and published release
  match Live acc4924 after explicit PO acceptance; no retag/deploy.

The PO removes rehearsal/Review/Retro reporting from C02; the team prepares
those separately and no completion is claimed here. Still Pending: genuine
protection screenshot/required checks, substantive final review/merge, private
cloud upload/access/independent restore/maintenance, and manual PDF/LMS receipt.
[Private backup instructions](../../s5-c02-private-backup-handoff.md).
