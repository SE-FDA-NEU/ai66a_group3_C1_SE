# T08 authenticated operations baseline — 11 November 2026

This is actual evidence for [#255](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/255)
and [operations.md](../../operations.md), not final acceptance of the regional
release. The PO deferred production rollout until readiness work is prepared.
No deploy, migration, provider enrichment or Render configuration change was
performed during these checks. Demo login/logout only created/revoked its normal
application session; no account was created or password changed.

## Service and source identity

[observations.json](observations.json) records authenticated read-only Render
results for `cineai`, service `srv-dbp96kp42hec73bv94j0`, My Workspace. The account
connection now exposes the correct group-03 repository/service; the earlier
wrong-workspace observation is historical. The latest deployment is
`dep-dbpaf38n74is73dcl8k0`, live at
`f24ef54699efb2fa26f363107bd31401f9b12e58` (10 November).

Branch `main`, Free/Singapore, `/health`, one worker and **After CI Checks Pass**
were confirmed. This verifies settings, not an end-to-end failed-CI experiment.
Main `50aa9ad4fccc63f5d7ef8186bb296ed12f0d18ee` has green CI
[42987332068](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/42987332068)
but expects `d9a6f2c1e508`; the public app still reports `a3d1f8b72c44`. A working
old health response is not acceptance of the new regional UI.

## Actual monitoring windows

The source was Render application Logs, scoped to **only CineAI**, text
`request_id=`, ascending timestamps. All pages were retrieved (100 logs/page;
3 and 2 pages), retaining only completed-request entries matching
`request_id=... method=... route=... status=... latency_ms=...`. Window boundaries
are half-open `[start,end)`. Request IDs were deduplicated before export; samples
contain only status, app milliseconds and whether the route was health. No
cookie, token, password, IP, account identifier, body or literal user URL was
exported.

| Window UTC (11 November) | Local UTC+7 | Requests / health / 4xx / 5xx | 5xx rate | p50 / p95 / max ms |
| --- | --- | --- | --- | --- |
| 10:05–10:10 | 17:05–17:10 | 220 / 72 / 10 / 0 | 0% | 26.81 / 825.67 / 1619.05 |
| 10:15–10:20 | 17:15–17:20 | 106 / 71 / 3 / 0 | 0% | 26.72 / 693 / 1263.14 |

Error rate = completed requests with `status >= 500` divided by all completed
requests. Expected business/session 4xx are not server errors. Startup lines and
tracebacks do not count as additional requests. Samples include automated health
probes as well as real app/test activity; they are not a representative load test
or uptime promise. Quantiles use nearest rank `ceil(n*p)-1`, not interpolation.

To reproduce, select those UTC intervals in CineAI Logs, retrieve every page,
and apply the same filter/deduplication. The privacy-reduced
[request-samples.json](request-samples.json) independently reproduces all counts
and nearest-rank statistics without exposing the original request identifiers:

```python
import json
from math import ceil
from pathlib import Path

report = json.loads(Path('docs/evidence/s5-t08-operations/request-samples.json').read_text())
for window in report['windows']:
    rows = window['samples']  # status, latency_ms, is_health
    milliseconds = sorted(row[1] for row in rows)
    n = len(rows)
    print(window['start'], window['end'], 'requests', n,
          'health', sum(row[2] for row in rows),
          '4xx', sum(400 <= row[0] < 500 for row in rows),
          '5xx', sum(row[0] >= 500 for row in rows),
          'p50/p95/max', milliseconds[ceil(n*.5)-1],
          milliseconds[ceil(n*.95)-1], milliseconds[-1])
```

Only two successful baseline windows are claimed. Repeat monitoring on the
selected final regional candidate; do not carry these numbers forward as a
measurement of a different deployed SHA. Health/cold-start policy and response
owners are defined in operations.md; they are operating thresholds, not proven SLOs.

## Real request correlation and public demo login

[demo-account-check.json](demo-account-check.json) records a public first health
request followed by the PO-approved shared app-only login, session read, logout
and authenticated-read refusal. Results: **200 / 200 / 200 / 204 / 401**.
The first client health took **49,724.59 ms**. Its response header was
`X-Request-ID: req_61966bba966d4324b68440628c4b7de2`; Render Logs contained the same
ID, `GET /health`, HTTP 200, **22.36 ms**, timestamp
`2026-11-11T10:50:59.771559501Z`. Therefore client wall time and app log latency
are different measurements; the first result is consistent with platform wake-up
and network overhead, not a steady-state app latency claim. No session token or
account identifier was retained. The already-approved demo values are published
intentionally in README, not a service/database credential.

## Protection and operator work still pending

[github-protection.json](github-protection.json) is a real API snapshot: the
contributor can push but is not an administrator. Effective rules returned
one PR approval/deletion/non-fast-forward rules and no required-status-check
entry. The administrator must confirm/apply all required checks and provide an
actual settings screenshot. This JSON is not a fabricated screenshot or proof
that enforcement is complete. Follow [T03 settings](../../s5-t03-deployment.md#main-protection-and-deploy-gate).

The earlier T07 preflight also produced a private consistent runtime backup:
all 11 source-snapshot tables matched its isolated local restore, with 989
catalogue rows. The archive remains private/ignored, not a durable shared
backup. Subsequent public activity means a new backup is required at the real
rollout. Durable storage, operator access, daily retention and independent
reproduction still require T06's actual handoff.

T07's [PR #265](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/265) supplies
technical checks, real-TMDb scenes and the human acceptance checklist; it has
not established physical-phone/team-rehearsal/PO acceptance. On 11 November the
PO reassigned final public/device/demo/PO checks, protection screenshot, durable
backup handoff and final-candidate monitoring to C02 #256. T08 closes only when
this amended documentation/baseline delivery receives green checks, substantive
independent formal approval and merge; that closure does not certify M5 or the
future runtime. The [C02 release plan](../../s5-t08-c02-handoff.md#one-batch-release-plan)
names the owners and preserves every pending requirement through final release.
