import { useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getRating,
  isRatingValue,
  RatingApiError,
  saveRating,
  type RatingValue,
} from "../api/ratings.ts";
import { useAuth } from "../auth/authState.ts";
import StarRating from "./StarRating.tsx";
import { useFeedback } from "../feedback.ts";

type RatingLoad =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

function AccountMovieRating({ movieId }: { movieId: string }) {
  const { handleUnauthorized, invalidateRecommendations } = useAuth();
  const feedback = useFeedback();
  const pendingNotice = useRef<number | null>(null);
  const navigate = useNavigate();
  const [load, setLoad] = useState<RatingLoad>({ status: "loading" });
  const [committed, setCommitted] = useState<RatingValue | null>(null);
  const [draft, setDraft] = useState<RatingValue | null>(null);
  const [reload, setReload] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  const mounted = useRef(false);
  const generation = useRef(0);
  const pendingSave = useRef(false);
  const saveController = useRef<AbortController | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
      saveController.current?.abort();
      if (pendingNotice.current !== null) feedback.dismiss(pendingNotice.current);
    };
  }, [feedback]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getRating(movieId, controller.signal)
      .then(({ rating }) => {
        if (!active || controller.signal.aborted) return;
        setCommitted(rating);
        setDraft(rating);
        setLoad({ status: "ready" });
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted) return;
        if (error instanceof RatingApiError && error.status === 401) {
          handleUnauthorized();
          navigate("/login", { replace: true });
          return;
        }
        setLoad({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Rating service is unavailable",
        });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [movieId, reload, handleUnauthorized, navigate]);

  async function handleSave() {
    if (load.status !== "ready" || pendingSave.current || !isRatingValue(draft))
      return;
    pendingSave.current = true;
    const controller = new AbortController();
    const requestId = ++generation.current;
    saveController.current = controller;
    const current = () =>
      mounted.current &&
      generation.current === requestId &&
      !controller.signal.aborted;
    setSaving(true);
    setSaveError("");
    setSaved(false);
    const notice = feedback.announce({ kind: "pending", title: "Saving your rating…" });
    pendingNotice.current = notice;
    try {
      const { rating } = await saveRating(movieId, draft, controller.signal);
      if (!current()) return;
      setCommitted(rating);
      setDraft(rating);
      setSaved(true);
      // Only a confirmed commit can change the account's ranking; a failed or
      // unconfirmed save leaves the current recommendation generation alone.
      // Same account, same genres: keep the page/filter/query/hash to return to.
      invalidateRecommendations({ keepNavigationContext: true });
      feedback.update(notice, { kind: "success", title: "Rating saved", message: `${rating}/5 saved to your account.` });
      pendingNotice.current = null;
    } catch (error: unknown) {
      if (!current()) return;
      feedback.update(notice, { kind: "error", title: "Rating save not confirmed", message: "Your selection is kept. Please retry." });
      pendingNotice.current = null;
      if (error instanceof RatingApiError && error.status === 401) {
        handleUnauthorized();
        navigate("/login", { replace: true });
        return;
      }
      const detail =
        error instanceof RatingApiError
          ? error.message
          : "The connection failed; the save could not be confirmed.";
      setSaveError(
        `Your rating was not confirmed as saved. ${detail} Please retry.`,
      );
    } finally {
      if (current()) {
        pendingSave.current = false;
        saveController.current = null;
        setSaving(false);
      }
    }
  }

  if (load.status === "loading")
    return <p role="status">Loading your rating...</p>;
  if (load.status === "error")
    return (
      <div role="alert">
        <p>Your rating could not be loaded. {load.message}</p>
        <button
          type="button"
          onClick={() => {
            setLoad({ status: "loading" });
            setReload((value) => value + 1);
          }}
        >
          Retry loading rating
        </button>
      </div>
    );

  return (
    <>
      <p className="rating-committed">
        {committed === null
          ? "Not rated yet"
          : `Your saved rating: ${committed}/5`}
      </p>
      <form
        className="rating-form"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSave();
        }}
      >
        <StarRating value={draft} disabled={saving} onChange={(value) => {
            setDraft(value);
            setSaved(false);
            setSaveError("");
          }} />
        <button
          type="submit"
          disabled={
            saving || draft === null || (draft === committed && !saveError)
          }
        >
          {saving ? "Saving..." : saveError ? "Retry save" : "Save rating"}
        </button>
      </form>
      {saving ? <p role="status">Saving your rating...</p> : null}
      {saved ? <p role="status">Rating saved.</p> : null}
      {saveError ? (
        <p className="form-error" role="alert">
          {saveError}
        </p>
      ) : null}
      <p className="muted">
        Ratings are optional. Recommendations remain available without rating a
        movie.
      </p>
    </>
  );
}

export default function MovieRating({ movieId }: { movieId: string }) {
  const auth = useAuth();
  const feedback = useFeedback();
  const { refresh } = auth;
  const needsCheck = auth.status === "unknown";
  const titleId = useId();
  useEffect(() => {
    if (needsCheck) void refresh();
  }, [needsCheck, refresh]);
  return (
    <section className="movie-rating" aria-labelledby={titleId}>
      <h2 id={titleId}>Your rating</h2>
      {auth.status === "authenticated" ? (
        <AccountMovieRating
          key={`${auth.user.id}:${movieId}`}
          movieId={movieId}
        />
      ) : auth.status === "unauthenticated" ? (
        <>
          <p className="muted">Sign in to save a rating to your account.</p>
          <Link className="button-link" to="/login" onClick={() => feedback.announce({
            kind: "info", title: "Sign in to rate a movie", message: "Ratings are saved to your account.",
          })}>
            Sign in to rate this movie
          </Link>
        </>
      ) : auth.status === "error" ? (
        <div role="alert">
          <p>Your sign-in status could not be checked. {auth.message}</p>
          <button type="button" onClick={() => void refresh()}>
            Retry session check
          </button>
        </div>
      ) : (
        <p role="status">Checking sign-in status...</p>
      )}
    </section>
  );
}
