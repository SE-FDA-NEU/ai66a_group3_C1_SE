# S3-T04 home Start and genre-selection evidence

- Issue: [#106](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/106)
- Parent Story: [#17](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/17)
- Branch: `106-home-start-genre-selection`
- Tested implementation commit: pending the owner's commit; replace this note
  with the final tested SHA before requesting review.
- Verification date: 2026-10-10

Reviewed dependencies: Sprint 3 contracts were merged in
[PR #144](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/144), and the
genre/preference storage plus read endpoints were merged in
[PR #147](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/pull/147).

## Delivered scope

- The home `Start` action opens the existing protected `/preferences` route.
- `/preferences` reads the authenticated catalogue genres and the current
  account's saved genres from `GET /api/genres` and
  `GET /api/me/preferences`; it does not hard-code genre choices.
- Every saved genre is initially selected. Saved genres missing from the active
  catalogue appear in a separate unavailable group, remain removable, and
  still count toward the five-genre limit.
- The picker accepts at most five draft selections. Attempting a sixth shows
  the limit and keeps the previous five selected.
- Loading, API error with retry, empty catalogue with a route home, and stale
  authentication recovery are explicit UI states.
- Requests include browser credentials and are aborted when the protected page
  unmounts. A successful response checks that its request is still current
  before updating any state.

## Automated verification

Run from `frontend`:

```powershell
npm.cmd test -- --run src/tests/preferences.test.tsx
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

Results against the uncommitted branch working tree:

- Focused suite: 1 file, 9 tests passed.
- Full frontend suite: 7 files, 55 tests passed.
- ESLint: passed with no findings.
- TypeScript and Vite production build: passed.

The focused suite covers signed-in Start navigation, catalogue-backed choices,
restoring current-account choices, saved-but-unavailable choices and their
limit accounting, the sixth-choice rule, loading, empty, retryable error,
protected-read `401` recovery, and a delayed successful response after
StrictMode cleanup/abort. The existing popular-page test continues to prove
that leaving preferences for public popular browsing does not send a preference
write.

## Reproducible reviewer steps

1. Follow `docs/SETUP.md`, start the backend with an active catalogue, and
   start the frontend with `npm.cmd run dev`.
2. Sign in, return to `/`, select `Start`, and verify the browser opens
   `/preferences` with the active catalogue's genres.
3. Select five unchecked genres, then select a sixth. Verify the limit message
   appears, the first five remain checked, the sixth remains unchecked, and
   the counter stays `5 of 5 selected`.
4. With a saved genre absent from the active catalogue, verify it appears under
   `Saved but unavailable`, counts toward the limit, and can be cleared by the
   user instead of being silently removed from the draft.
5. Sign out and open `/preferences` directly. Verify the protected route opens
   `/login` and no private picker content remains visible.
6. Run the four commands above to reproduce loading/error/empty states and the
   regression gates deterministically.

## Story criteria intentionally not claimed

S3-T04 supplies the Start and selection controls only. The repository does not
yet implement the committed `PUT /api/me/preferences` endpoint, so this change
does not pretend to complete these Story #17 criteria:

- confirming one to five choices and saving them to the account;
- rejecting confirmation with zero choices;
- navigating to fresh recommendations after a successful save.

The read path does restore the current account's saved genres, but final
cross-account Story acceptance still depends on the write flow and its
independent integration verification. Story #17 must remain open.

## Review status

Independent review and the reviewed PR link are pending. Issue #106 must remain
open until a reviewer approves the tested change; this evidence does not count
its author as an independent reviewer.
