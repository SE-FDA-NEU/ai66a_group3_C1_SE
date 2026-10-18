# GitHub Task draft

Title: `[Task] Unify session navigation and paginate catalogue, popular and recommendation results`

Type: `backend` (the change also covers frontend, tests and documentation).
Estimate: 24-32 engineering hours plus independent review.
Parent: #18 / S02. Related: #20 / S04, #23 / S06, #31 / S09,
#45 / S13. Detail-return compatibility: #19 / S03.

This is a post-M3 amendment. Keep the completed Sprint 3 acceptance history and
points intact. Assign an integration owner and a separate reviewer in the
project before merging.

## Acceptance criteria

- [ ] Home exposes every active movie alphabetically in pages of at most 10.
- [ ] Popular exposes every finite-popularity movie in globally ranked pages.
- [ ] Recommendations select their mode from the complete account-owned base
      set, filter that set before pagination and keep the existing reason flags.
- [ ] All three APIs report page, count, limit, total, totalPages,
      unfilteredTotal and catalogueRevision; stale revisions return 409.
- [ ] Home, Popular and Recommendations share session navigation with checking,
      guest, authenticated and recoverable error states and real sign-out.
- [ ] Page and view genre survive details and browser Back/Forward; account or
      preference changes invalidate old personal results.
- [ ] The documented 15-page TMDb import yields 200-300 distinct active TMDb
      movies on the configured review database with a working review account.
- [ ] Automated tests, real-browser evidence, affected Story amendments and
      an independent review support the final commit.

## PR body linkage

Replace `NEW_TASK` after creating the issue. Keep each directive on its own
line for the repository's issue-linkage workflow.

```text
Closes #NEW_TASK
Refs #18
Refs #20
Refs #23
Refs #31
Refs #45
Refs #19
```
