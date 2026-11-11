# T07 final candidate, phone and demo checklist

All items below are **Pending** until the named person records the actual result.
On 11 November the PO confirmed that rehearsal and public acceptance have not
happened. Headless mobile emulation has run; no physical phone was connected.

## 1. Operator handoff

- [ ] Render operator Trần Tuấn Anh identifies the exact CineAI public URL and records Deploy Details SHA.
- [ ] Coordinate a fresh private backup, grants/migration, matching reviewed green-main deploy and US/GB/SG enrichment with Neon operator Nguyễn Tuấn Anh. Follow [T03](../../s5-t03-deployment.md) and [T06](../../s5-t06-postgresql-recovery.md); never bypass exact-head health.
- [ ] Record live deployment, matching CI/SHA, expected/actual head, PostgreSQL major, date and operator. A schema head does not identify the deployed SHA.
- [ ] Re-run both probes from [README](README.md) on that same candidate and save actual results/source mapping.
- [ ] Confirm T06 durable private backups, primary/backup access and named independent reproduction; closed GitHub state alone is not proof.

## 2. Physical phone and private laptop browser

Record tester, date/time/timezone, phone model/OS/browser, laptop OS/browser,
private/incognito context and candidate SHA. Start at Home and use visible
controls; do not paste feature URLs or use the local fixture app.

| Journey | Action and pass condition | Actual evidence |
| --- | --- | --- |
| S04 explore | Home → Popular → page 2 → Details → Back; page retained | Pending |
| S12 register | Create an app-only account; duplicate registration reaches the server (409) with sign-in guidance | Pending |
| S13 session | Sign in → Home, navbar changes; sign out and log in later | Pending |
| S01 preferences | Start/Preferences, 1–5 genres, save/reload; invalid selection has helpful text | Pending |
| S02 recommendations | Cards/reasons/scores, filter, next page and clear; preferences unchanged | Pending |
| S03 details | Real imported movie, poster/backdrop or honest fallback, overview, rating/Watchlist; retained return context | Pending |
| NLP | Search typing sends no search request; submit → next page → Details/Back; Similar excludes source | Pending |
| Data/reset/isolation | A saves rating/Watchlist across later login; B isolated; reset cancel preserves data, confirm clears only A genres/ratings and keeps Watchlist/B | Pending |
| Regional | US default, GB/SG, reload/later movie, rapid changes and final movie/country groups/date/link; neutral missing data | Pending |
| External/media | Exact movie/locale TMDb action opens a tab; original route/session retained; embedded trailer opens/closes or unavailable text, no full-film claim | Pending |
| Presentation | Both themes, readable keyboard focus/errors, narrow navigation/no horizontal overflow; health/request-ID handoff works | Pending |

Use labelled deterministic fixtures and [T05's focused evidence](../s5-t05-regional-ui.md)
for invalid/stale/null links, logo failure and races when the live catalogue lacks
these states. Do not alter production records to manufacture them. The external
watch-options page may require a provider's subscription/account.

## 3. Twelve-minute rehearsal

This proposed assignment uses actual owned PRs. It is not attendance evidence
or a claim that a member authored this PR's acceptance scripts. Each member must
confirm the specific test/rule they can explain.

| Time | Member and owned PR | Demonstration |
| --- | --- | --- |
| 0:00–1:00 | Kiệt — [Planning #257](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/257) | URL/SHA, two M3/current comparisons, P0 entry map |
| 1:00–6:00 | Nguyễn Tuấn Anh — [Neon #259](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/259), T07 #265 | Live P0 journeys, server refusal and account persistence/isolation; owned test/rule |
| 6:00–8:00 | Huy — [regional UI #263](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/263) | Selector, safe TMDb action, fallback and retained original tab |
| 8:00–10:00 | Hoàng — [recovery #262](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/262) | PostgreSQL 18/recovery, source identity, local red/green |
| 10:00–12:00 | Trần Tuấn Anh — [deploy #260](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/260), [providers #261](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/261) | Pipeline/health, design choice, real lesson and risk/plan |

- [ ] Record rehearsal date, participants, actual durations, problems and fixes.
- [ ] Map the instructor-selected P0 to normal/refusal/boundary cases in [testing.md](../../testing.md#2-test-cases-for-every-p0-story). S01 is prepared: 1/5 accepted, 0/6 refused; the local 5→6 mutation turns the six-genre test red, then restores green. Do not claim the instructor chose S01 until that happens.
- [ ] Each member explains an actual owned PR/test/rule; Planning alone does not establish authored-test contribution. Confirm the individual evidence with C02.

## 4. Final decision and review

| Record | Actual value |
| --- | --- |
| Candidate SHA, public URL and CI | Pending |
| PO/date, accepted AC and unresolved defects | Pending |
| Physical-phone/private-laptop evidence | Pending |
| Five-person timed rehearsal | Pending |
| Non-contributing reviewer's substantive Review changes and approval | Pending |

Kiệt contributes the completion commit; his previous short approval cannot be
the independent final review. Huy coordinates an eligible reviewer. Keep
`Refs #254` until the results are recorded, then close through the reviewed
merge. T07 hands results to T08/C02 and does not wait for the final dossier,
`v1.0` promotion or manual PDF/LMS submission.
