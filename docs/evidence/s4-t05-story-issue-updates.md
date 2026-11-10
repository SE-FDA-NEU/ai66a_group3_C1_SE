# S4-T05 Story issue amendments pending on GitHub

These are exact replacement acceptance criteria for the conflicting parts of
the live Story issue bodies. They align with `docs/requirements.md` and the
approved Sprint 4 behavior. They have not been applied to GitHub from this
local branch. Preserve the unrelated criteria and issue history when editing.

## Story #21: rate a movie and save feedback

Replace integer-only rating acceptance wording with:

> Given I am signed in and open a valid movie, when I submit a numeric rating
> from 0.5 through 5 in exact 0.5 steps, then the system confirms the save and
> shows my current account rating. Existing whole-star values remain valid.
>
> Given I submit 0, 6, a non-half-step value such as 3.25, or a nonnumeric
> value, when processed, then the rating is rejected and my previously saved
> rating, if any, is preserved.
>
> Five visual stars expose ten keyboard and pointer choices. The midpoint or
> left half of a star selects its half-step value; the right end selects the
> whole-star value. A selection is a draft until I explicitly choose Save.

Keep the existing one-current-row, save-failure/retry, unrated-account and
account-isolation criteria. Ranking signals remain negative at ratings <=2,
positive at ratings >=4, and neutral between those thresholds, including
half-step values.

## Story #45: sign in and sign out securely

Replace the conflicting post-login destination criteria with:

> Given I sign in from Home or visit `/login` directly, when authentication
> succeeds, then Home opens with authenticated navigation. Sign-in does not
> automatically open Preferences or Recommendations or change saved genres or
> ratings.
>
> Given I explicitly request Start, Preferences or My recommendations while
> signed out, when authentication succeeds, then I return to the safe internal
> protected route that prompted login. Start returns to `/preferences`; a
> recommendation page, filter and hash are retained. A registration detour
> preserves that intent. Missing, external or unsafe return destinations open
> Home instead.

Keep the existing credential-error, protected-route, sign-out, session-state
and account-isolation criteria. This changes the Story wording to match the
approved behavior; it does not request a code rollback.
