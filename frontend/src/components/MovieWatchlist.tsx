import { useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { getMembership, setMembership, WatchlistApiError, type Membership } from "../api/watchlist.ts";
import { useAuth } from "../auth/authState.ts";
import { useFeedback } from "../feedback.ts";

type Status = { kind: "loading" | "ready" | "error"; membership?: Membership; message?: string };

function AccountMovieWatchlist({ movieId }: { movieId: string }) {
  const auth = useAuth();
  const feedback = useFeedback();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [reload, setReload] = useState(0);
  const [pending, setPending] = useState(false);
  const [writeError, setWriteError] = useState("");
  const pendingRef = useRef(false);
  const generation = useRef(0);
  const writeController = useRef<AbortController | null>(null);
  const noticeId = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      generation.current += 1;
      writeController.current?.abort();
      if (noticeId.current !== null) feedback.dismiss(noticeId.current);
    };
  }, [feedback]);

  useEffect(() => {
    const controller = new AbortController();
    getMembership(movieId, controller.signal).then(membership => {
      if (!controller.signal.aborted) setStatus({ kind: "ready", membership });
    }).catch(error => {
      if (controller.signal.aborted) return;
      if (error instanceof WatchlistApiError && error.status === 401) {
        auth.handleUnauthorized();
        navigate("/login", { replace: true });
        return;
      }
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "Watchlist unavailable" });
    });
    return () => controller.abort();
    // The keyed wrapper remounts this component for account/movie changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movieId, reload]);

  async function change() {
    if (status.kind !== "ready" || !status.membership || pendingRef.current) return;
    const wanted = !status.membership.inWatchlist;
    pendingRef.current = true;
    const controller = new AbortController();
    writeController.current = controller;
    const request = ++generation.current;
    const current = () => generation.current === request && !controller.signal.aborted;
    setPending(true);
    setWriteError("");
    const notice = feedback.announce({ kind: "pending", title: wanted ? "Adding to watchlist…" : "Removing from watchlist…" });
    noticeId.current = notice;
    try {
      const membership = await setMembership(movieId, wanted, controller.signal);
      if (!current()) return;
      setStatus({ kind: "ready", membership });
      feedback.update(notice, { kind: "success", title: wanted ? "Added to watchlist" : "Removed from watchlist" });
      noticeId.current = null;
    } catch (error) {
      if (!current()) return;
      if (error instanceof WatchlistApiError && error.status === 401) {
        feedback.dismiss(notice);
        noticeId.current = null;
        auth.handleUnauthorized();
        navigate("/login", { replace: true });
        return;
      }
      // A lost response may follow a committed write. Read the server before
      // telling the user whether the requested state was saved.
      try {
        const membership = await getMembership(movieId, controller.signal);
        if (!current()) return;
        setStatus({ kind: "ready", membership });
        if (membership.inWatchlist === wanted) {
          feedback.update(notice, { kind: "success", title: wanted ? "Added to watchlist" : "Removed from watchlist" });
        } else {
          setWriteError("Change was not saved. Please retry.");
          feedback.update(notice, { kind: "error", title: "Watchlist change not saved" });
        }
      } catch (readError) {
        if (!current()) return;
        if (readError instanceof WatchlistApiError && readError.status === 401) {
          feedback.dismiss(notice);
          auth.handleUnauthorized();
          navigate("/login", { replace: true });
        } else {
          setStatus({ kind: "error", message: "Change could not be confirmed. Reload membership to check." });
          feedback.update(notice, { kind: "error", title: "Watchlist change not confirmed" });
        }
      }
      noticeId.current = null;
    } finally {
      if (current()) {
        pendingRef.current = false;
        writeController.current = null;
        setPending(false);
      }
    }
  }

  if (status.kind === "loading") return <p role="status">Loading watchlist status...</p>;
  if (status.kind === "error") return <div role="alert">
    <p>{status.message}</p>
    <button type="button" onClick={() => { setStatus({ kind: "loading" }); setReload(value => value + 1); }}>Retry watchlist status</button>
  </div>;

  return <div className="watchlist-detail-action">
    <p role="status">{status.membership?.inWatchlist ? "Saved to your watchlist" : "Not in your watchlist"}</p>
    <div className="detail-actions">
      <button type="button" disabled={pending} onClick={() => void change()}>
        {pending ? "Saving…" : status.membership?.inWatchlist ? "Remove from watchlist" : "Add to watchlist"}
      </button>
      <Link className="button-link button-secondary" to="/watchlist">View watchlist</Link>
    </div>
    {writeError ? <p className="form-error" role="alert">{writeError}</p> : null}
  </div>;
}

export default function MovieWatchlist({ movieId }: { movieId: string }) {
  const auth = useAuth();
  const feedback = useFeedback();
  const heading = useId();
  const { refresh } = auth;
  useEffect(() => { if (auth.status === "unknown") void refresh(); }, [auth.status, refresh]);
  return <section className="movie-watchlist" aria-labelledby={heading}>
    <h2 id={heading}>Your watchlist</h2>
    {auth.status === "authenticated" ?
      <AccountMovieWatchlist key={`${auth.user.id}:${movieId}`} movieId={movieId} /> :
      auth.status === "unauthenticated" ? <>
        <p className="muted">Sign in to save this movie to your watchlist.</p>
        <Link className="button-link button-secondary" to="/login" onClick={() => feedback.announce({
          kind: "info", title: "Sign in to save movies", message: "Your watchlist stays with your account.",
        })}>Sign in to save this movie</Link>
      </> : auth.status === "error" ? <div role="alert">
        <p>Your sign-in status could not be checked. {auth.message}</p>
        <button type="button" onClick={() => void refresh()}>Retry watchlist session check</button>
      </div> : <p role="status">Checking watchlist sign-in status...</p>}
  </section>;
}
