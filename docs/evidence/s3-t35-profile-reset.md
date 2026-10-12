# S3-T35 authenticated profile-reset evidence

- Task: [S3-T35 #142](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/142)
- Parent Story: [S11 #33](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/33)
- Account-isolation support: [S13 #45](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/45) AC5
- Dependencies: preference replacement [#104](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/104), rating API [S3-T31 #138](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/138), and approved contract [#134](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/134)
- Verification date: 2026-10-12
- Tested state: uncommitted working tree based on `d345c8725f6788ae68db739454e056bca552b8ec`
- Tested candidate SHA: pending by request; this implementation must not be committed by the implementer in this session
- Independent review: pending

## Implemented boundary

`POST /api/me/profile/reset` accepts only the exact explicit confirmation
`{ "confirm": true }`. The authenticated session is the only source of account
identity. On success, the backend deletes that account's
`user_genre_preferences` and `user_movie_ratings` rows in one transaction and
returns `{ "data": { "reset": true } }` only after commit.

The route preserves the user, current session, catalogue, movies, genres, and
all unrelated accounts. It reuses the existing same-origin write guard. The
full profile/reset UI remains outside T35 and this evidence does not close
Story #33.

## Executable acceptance coverage

| Required behaviour | Test evidence |
|---|---|
| Session is the only account identity | `test_confirmed_reset_is_account_scoped_and_preserves_shared_state` sends forged query/header IDs and proves only the caller is reset. |
| Explicit strict confirmation | `test_invalid_confirmation_causes_no_mutation` covers missing, false, integer, string, null, collection, extra identity fields, and malformed top-level shapes. |
| Malformed JSON has no effect | `test_malformed_confirmation_causes_no_mutation`. |
| Missing, invalid, expired, and revoked sessions cannot reset | `test_invalid_session_cannot_reset_personalisation`. |
| Cross-origin writes cannot reset | `test_forbidden_origin_causes_no_mutation`. |
| Failure between deletes rolls both back | `test_failure_between_deletes_rolls_back_both_sets` injects a database failure on the rating delete after the preference delete. |
| Commit failure preserves both sets and never returns success | `test_commit_failure_rolls_back_and_never_claims_success`. |
| Shared and unrelated state is preserved | The confirmed-reset test compares user, session, catalogue, movie, genre, and relation counts and retains Account B's rows. |
| Recommendations observe the reset state | `test_recommendations_use_cold_start_state_after_reset` moves from personalised mode to popular cold-start mode. |

## Local results

Focused reset suite:

```text
28 passed, 1 warning in 9.46s
```

Full backend regression with coverage:

```text
244 passed, 1 skipped, 1 warning in 88.46s
TOTAL 1117 statements, 122 missed, 89% coverage
```

Ruff:

```text
All checks passed!
```

The warning is the existing Starlette TestClient deprecation warning. The
single skipped test is pre-existing. A commit SHA and independent approval must
be appended after the owner commits and opens the review; neither is fabricated
from this uncommitted working tree.
