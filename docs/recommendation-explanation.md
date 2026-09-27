# Recommendation explanation content

This document is the approved content contract for [S10](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/32) and [T17](https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/issues/63). T18 must render the user-visible sections below on `/about-recommendations` without adding a fourth process step or changing the quoted statements.

## How recommendations work

1. **Register or sign in.** Create an account or sign in so that the system can keep your preferences and optional ratings with your account.
2. **Choose genres.** Select the movie genres that you prefer.
3. **Receive recommendations with optional movie ratings.** View recommendations based on your selected genres, and optionally rate movies to provide feedback for later recommendations.

## Browse without an account

You can browse popular movies without signing in or providing preferences.

## TMDb attribution

This product uses the TMDB API but is not endorsed or certified by TMDB.

The attribution belongs outside the numbered process so that the explanation still contains exactly three steps. It is intended for the public `/about-recommendations` page, which is an About/Credits-type section.

## Implementation notes for T18

- Render the three ordered items above as the only numbered process steps.
- Keep the guest-browsing statement and TMDb attribution outside that ordered list.
- Do not claim that the current recommendation flow uses TF-IDF/cosine similarity before Spike #43 has produced and reviewed an accepted result.
- If a later screen mentions TF-IDF/cosine similarity, describe it as a deterministic text-similarity technique, not as a trained model, an LLM, or a machine-learning model.

## Source and review checklist

- S10 acceptance criteria: exactly three steps; the guest-browsing statement must match exactly.
- BR13: the explanation contains exactly three steps and states that popular movies need no preferences.
- TMDb attribution wording: [TMDb API FAQ](https://developer.themoviedb.org/docs/faq).
