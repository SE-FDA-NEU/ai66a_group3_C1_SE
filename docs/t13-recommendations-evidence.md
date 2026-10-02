# T13 Recommendation Landing Evidence

## Test command

From `frontend/`:

```text
npm test -- recommendations
```

The focused tests verify the recommendation landing page, `Popular` label,
loading state, empty state, absence of fake movie cards, the preferences link,
and the real `/preferences` page.

## Reviewer steps

1. Start the frontend and sign in.
2. Open `/recommendations`.
3. Verify `Popular` and the empty state are visible.
4. Verify no movie cards are displayed.
5. Select `Enter preferences`.
6. Verify `/preferences` opens as a real page showing that preference selection is coming soon.

## Screenshot evidence

- `frontend/screenshot/output/t13-recommendations.png`
- `frontend/screenshot/output/t13-recommendations-empty-state.png`
- `frontend/screenshot/output/t13-preferences.png`
- `frontend/screenshot/output/t13-tests-pass.txt`

## Pending

- Real recommendation API integration is not included in T13.
- Personalised recommendation transition remains pending S3.
- The preference picker is not implemented yet.
- S04 transition-to-personalisation acceptance criteria remain pending S3.