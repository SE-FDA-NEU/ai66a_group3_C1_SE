# T18 correction and EARLY_TEST_SETUP follow-up

30 October 2026, Asia/Ho_Chi_Minh. Runner: **Codex, author verification**.
Tested committed source: **`641f48a09a4a0bd057a73e05f6455a61e816150a`**,
[EARLY_TEST_SETUP PR #240](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/240).
The clean checkout is `/private/tmp/s4-c05-early-20261030`; its working tree was
clean after both runs. All source files in [tested-source.sha256](tested-source.sha256)
were compared byte-for-byte against that commit in the separate checkout.
The T18 branch also includes those changes for verification; their inclusion
does not mean #240 has been independently reviewed or merged into main.

**Latest continuation:** the [Windows and live-TMDb follow-up](windows-portability/README.md)
records the URL-object/collection-failure corrections in both PRs, full pytest
passes on the corrected heads, and a successful real 50-page import with **964
movies**, a ready index and passing API/browser smoke. It supersedes the live
connectivity failure below. The earlier logs and SHA in this report remain
historical observations of their own candidates.

**T18 remains incomplete.** The original report's claim that no requirement was
uncovered was incorrect. Manually migrating a test DB hid a gap in #219's
automatic default-engine isolation. Author live-catalogue smoke now passes;
independent preflight/capacity/G4 records remain outstanding. Keep #213 and #219 Open; consuming
the reviewed early output does not depend on #219's final closure.

## Direct pytest correction

The [before log](health-before.log) reproduces `test_health_reads_database`:
`assert 503 == 200` with an unmigrated disposable default URL. The root P0
fixtures previously covered their own directory; `app.main.engine` was created
during collection outside their isolation. The original report's manually
migrated passes remain historical regression evidence, not direct-pytest
acceptance.

Root `pytest.ini` now explicitly retains `tests/`, `backend/tests/` and the
existing `scripts/` regressions and configures backend imports. Root
`conftest.py` selects an owned temporary DB/index path, blanks the token,
disables TMDb requests and migrates **before collection/application imports**.
Cleanup disposes the default engine, deletes temporary files and restores
inherited environment, including collection/migration failure paths. Existing
per-case data/overrides remain intact. CI now runs the default verbose command
and retains extended backend/frontend checks. SETUP documents the direct
commands and distinguishes tests from live app provisioning.

Three subprocess regressions verify both invocation forms and an intentional
collection failure in a fresh export without `.env`. They inherit hostile
DB/token/index settings, assert real migrated health during collection, check
temporary-directory removal, and prove the inherited DB/index files remain
unchanged. [Focused result](bootstrap-regressions.log): **4 passed**, including
the originally failing health case.

| Environment / command | Expected | Actual / full output |
|---|---|---|
| Working checkout, `pytest` | Automatic DB, all default tiers | **765 passed, 1 skipped**, 91.24s; [log](plain-pytest.log) |
| Working checkout, `python -m pytest -v` | Same selection; verbose node evidence | **765 passed, 1 skipped, 210 subtests passed**, 92.00s; [log](plain-module-pytest-verbose.log) |
| Fresh clone/venv, `pytest` | No `.env`, copied DB or manual migrations | **765 passed, 1 skipped**, 94.48s; [log](clean-plain-pytest.log) |
| Same fresh clone, `python -m pytest -v` | Same cases with fresh automatic DB | **765 passed, 1 skipped, 210 subtests passed**, 92.23s; [log](clean-plain-module-pytest-verbose.log) |
| Same fresh clone, `python backend/scripts/run_isolated_tests.py -v` | Existing extended tier remains compatible | **705 passed, 1 skipped**, 81.07s; [log](clean-backend-extended.log) |
| Ruff / C03 contract / T05 trace | Retained contracts and P0 mapping | Passed; [Ruff](ruff.log), [C03](c03-contract.log), [trace](t05-trace.log), [collection](default-collection.log) |

Only venv activation/PATH selection was used for the direct commands.
`DATABASE_URL`, `PYTHONPATH`, TMDb token/network and index environment variables
were removed from the invocation environment; pytest owns their test values.
The new clone was checked out at the SHA above, with a new Python **3.12.4**
venv and locked dependencies downloaded from PyPI (`--no-cache-dir`). The
documented [pip upgrade](clean-pip-upgrade.log),
[editable install](clean-editable.log) and [pip check](clean-pip-check.log) passed.
No `.env`, database, venv or application cache was copied into the clone.
The existing backend/frontend build/startup evidence at `24e8086` remains
applicable to unchanged production files, but is not a live-catalogue pass.

The original one skipped Python case is an obsolete historical placeholder;
it is not counted as passed. Three new infrastructure regressions account for
the increase from 762 to 765 passes. An initial sandbox run still had six auth
fixture errors because it could not bind owned localhost sockets; see
[raw log](plain-pytest-sandbox.log). That initial attempt also exposed omission
of 12 existing script regressions from the first discovery configuration;
`scripts/` was restored before both final runs. No health failure remained.
Final runs used normal localhost-binding permission, with no external DB,
running-server prerequisite, live TMDb or token dependency.

## Attempted live catalogue and index

**Historical failed attempt:** the [successful continuation](windows-portability/README.md)
uses a different smoke database and records actual counts, provenance, index
readiness and real API/UI acceptance. The zero rows below apply only to this
earlier failed smoke database; they do not describe the configured developer
database or the successful later snapshot.

The configured private token was available; it was read only into the importer
process environment. No token value, `.env`, database dump or provider payload
is included. The separate DB is
`/private/tmp/s4-t18-live-20261030/catalogue.db`; the index target is
`/private/tmp/s4-t18-live-20261030/overview-index.json`.
No configured development database or existing index was replaced.

| Check | Expected | Actual |
|---|---|---|
| `python -m alembic -c backend/alembic.ini upgrade head` | Fresh separate DB at head | Exit 0, **f2c7e4a91b60**; [log](live-migrations.log) |
| `python -m app.cli.import_tmdb_catalogue --pages 50` | Accepted TMDb snapshot; actual counts/provenance | Exit 1 outside sandbox too: provider HTTPS connection fails; [log](live-import.log) |
| `python -m app.cli.rebuild_overview_index rebuild` | Artifact for actual active revision | Exit 1: **no active catalogue**; [log](live-index-rebuild.log) |
| `python -m app.cli.rebuild_overview_index check` | Matching revision/digest/config | Exit 1: **no active catalogue**; [log](live-index-check.log) |
| Read-only SQL / API | Live source, timestamps/count and usable endpoints | **0 movies**, no active revision/provider/timestamps; health 200, catalogue/popular/description-search 503 `CATALOGUE_UNAVAILABLE`; [SQL summary](live-provenance.json), [in-process API observations](live-api.json) |

Network diagnosis outside the sandbox resolved the TMDb hostname, but httpx
reported `ConnectError: [Errno 54] Connection reset by peer`. Independent
unauthenticated `curl -4 -I` and `curl -6 -I` requests to the same official
HTTPS genre endpoint both exited 35 with connection reset. TLS verification
was not disabled. This is a provider-connectivity blocker, not proof of invalid
credentials or successful import. [Sanitized diagnostic](live-network.log).

The code's expected index config fingerprint remains
`41785781f34ba44091ac64f3b1c0503402ee760c518af1429d0acb94bbc31c99`
(`overview-tfidf-v1`, artifact version 1). **No actual live corpus digest,
index revision or UI acceptance exists from this failed import.** Fixture
screenshots and health 200 cannot substitute for those results.

To resume, restore HTTPS access to `api.themoviedb.org` on the operator machine,
keep the private token server-side, and follow [SETUP](../../../SETUP.md) and
the [runbook](../../../tmdb-sprint3-runbook.md) with this separate DATABASE_URL
and NLP_INDEX_PATH. Repeat the same 50-page import, rebuild and check; record
the resulting revision, real distinct count, finite-popularity count, genres,
source IDs/fetch/import times and config/digest. Compare Home `meta.total` with
the actual active count and run detail/popular/Search/Similar plus the documented
disposable-account API/UI/persistence journey. If a live test assumes an older
200–300-movie catalogue, reconcile that assertion with the reviewed 50-page
budget and actual imported SQL count; do not shrink the dataset to make it pass.
For this failed attempt, live readiness remained **Blocked**, never Pass.
The linked continuation supplies the later successful author smoke.

## Independent review and G4

[github-gates.json](github-gates.json) preserves the actual issue requirements
and two approvals on old T18 head `3dd5de698bf841fd44a3ebffe7d26dae6dae444d`:
@NguyenTuanAnh0608, `oke`, and @hoang3003, `ok`. Their bodies contain no executed
command/SHA/expected-actual record. They are approvals on that head, not evidence
of independent execution, and cannot approve later changes automatically.

| Gate | Current record / required completion |
|---|---|
| #219 EARLY_TEST_SETUP | Implemented and author-tested; corrected [PR #240](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/240) head `058a367` has passing hosted checks. An `ok` approval exists on preceding `641f48a`; substantive final-head independent execution and merge remain outstanding. Keep #219 Open. |
| #213 independent preflight | **Pending**. Reviewer must record identity/date, exact final SHA, machine/tool versions, committed setup and commands, expected/actual, full outputs and blockers after the early PR merges. Planned #213 reviewer: @NguyenTuanAnh0608; #219 reviewer: @vu-huzy. Coauthors need another independent reviewer. |
| Current author capacity | **Not supplied**; record member-confirmed remaining hours/date and retained scope. |
| Current reviewer capacity | **Not supplied**; record member-confirmed remaining hours/date and review scope. |
| Final regression/correction capacity | **Not supplied**; record hours/date and correction buffer. Historical estimates do not fill these fields. |
| PO/SM G4 decision | **Pending**. Record decision-maker, date, final SHA/evidence, confirmed capacity and explicit **Go/Defer**. Recommendation remains **Defer** while required live/review gates are missing; this is not a PO/SM decision. |

No approval, human execution, hours, merge or Go decision is invented. The
machine-readable [manifest](manifest.json) leaves these facts null and sets
`t18Accepted=false`. Changes here use **Refs #213 / Refs #219**, not closure.

At the time of this historical record, hosted checks on #240 SHA `641f48a` passed Python (including default pytest),
Node tests/build, details and profile acceptance, secrets and issue-link checks.
The [required independent-review check](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/actions/runs/40999409405/job/123880040024)
then failed because no independent approval had been supplied. Do not bypass
it to merge. [CI snapshot](github-checks.json) records this early PR and the
old T18 head before publication of this correction; its old-head approvals and
checks do not establish acceptance of the updated T18 head.

The [latest GitHub snapshot](windows-portability/resumed-github-status.json)
records #240 head `058a367`: hosted checks pass, while the `ok` approval by
@kietxuan is attached to preceding head `641f48a`. #239 also has an `ok`
approval from @kietxuan on `8d23a86`, before the Windows/evidence continuation.
These approvals do not contain an independent execution record. Both PRs were
still Open/unmerged when that snapshot was captured.
