# Embedded trailer: local preview, 2026-10-31

This records the user's embedded-player amendment, initially developed on
the local branch feature/s4-t20-embedded-trailer-preview from
660c2162f8b8a5a4422a0df6b781073e5cf9d409. The
[UI source hashes](embedded-preview-source.json) identify the six UI/test files
checked below. The user subsequently authorized the setup/media audit and
delivery to PR #242. These are author-assisted checks; independent review
and hosted checks must be assessed on the final PR head.

## User-approved behaviour

- Put the trailer control directly below the poster, including on mobile.
- Show `Trailer unavailable` there for null, omitted, invalid or unapproved data.
- Replace external navigation with an on-page, labelled native dialog.
- Construct the official YouTube embed URL from the validated 11-character key.
  Preserve official/type/site/canonical-URL validation. No arbitrary iframe URL.
- Mount the frame only after clicking, with autoplay disabled and player controls
  enabled. Keep fullscreen support and an origin-preserving referrer policy.
- Provide close and `Back to details` controls. Contain parent-dialog Tab/Shift-Tab
  boundaries while allowing keyboard access to the frame. Escape cancels while
  focus is outside the cross-origin player; YouTube owns keys inside its frame.
- Closing, movie/video changes, or leaving details removes the frame and restores
  the previous scroll policy; normal close restores the trigger's focus.
- Keep existing themes, backdrop fallback, ratings, watchlist, Similar and return
  context. No backend/API/schema, metadata import or account changes are required.

The current YouTube embed uses
`https://www.youtube.com/embed/VIDEO_ID?autoplay=0&playsinline=1&rel=0`.
See [official player parameters](https://developers.google.com/youtube/player_parameters).
An individual video can still be unavailable, private, removed or disallowed for
embedding by its publisher; the YouTube player reports that restriction. The app
keeps its close controls and does not replace the selected official trailer.
See [YouTube player errors](https://developers.google.com/youtube/iframe_api_reference#onError).

## Verification

Tester: Codex assisting the implementer, Windows, 2026-10-31. These are author
checks, not an independent teammate's acceptance.

| Check | Result |
|---|---|
| `npm.cmd --prefix frontend test -- --maxWorkers=4` | 463 passed, 40 files |
| Focused backdrop/trailer component tests after keyboard refinement | 38 passed |
| `npm.cmd --prefix frontend run test:t20:ui` | 6 passed; 24 media/theme/width cases plus 6 modal layouts |
| `npm.cmd --prefix frontend run test:t01:ui` | 16 passed, 1 live-only skip; owned DB removed |
| Frontend lint and production build | Passed |
| `git diff --check` | Passed |

The new T20 suite uses production FastAPI routes, migrated temporary SQLite,
offline artwork and a deterministic external player document. It checks layout
at 375/768/1440px in both themes, no initial iframe, no new tab or URL change,
keyboard entry/wrapping through the frame, close/Escape/backdrop dismissal,
focus/scroll cleanup and Back while playback is open. Provider fixtures do not
claim actual video decoding or YouTube availability.

A separate **live** read-only check used the running application and its imported
catalogue on port 5173. For Spider-Man: Brand New Day, the stored official video
`P3uI5sLosKU` loaded in the modal. Clicking the YouTube play control produced
`currentTime > 0.5`, `paused=false`, `readyState=4`. The details URL remained
unchanged, exactly one tab remained, and closing removed the frame. This proves
playback of that selected video at test time, not every trailer in the catalogue.
The real no-trailer movie `10 Things I Hate About You` displayed the unavailable
caption below its poster without an action on the 375px layout.

Live screenshots and observations are local only under ignored `data/backups/`:
`trailer-under-poster-local.png`, `trailer-dialog-local.png`,
`trailer-unavailable-mobile-local.png`,
`embedded-trailer-preview-playback.json`. No database, login data, token or
personal backup is included in this source change. The earlier failed playback
probe waited for a video element before clicking YouTube's play control; that
probe was corrected, and the actual playback check above passed.

## Try it locally

Keep the normal backend/frontend running, refresh the details page and click
`Watch trailer` below the poster. Play/pause with the embedded controls, then
close with the top-right icon or `Back to details`. The existing URL and list
return context stay intact. A movie without a selected official trailer displays
the unavailable caption in that position. The original local-only request has been superseded by the user's instruction
to audit setup/media coverage and push the combined changes to PR #242.
