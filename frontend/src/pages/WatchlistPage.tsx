import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { getMembership, getWatchlistPage, setMembership, WatchlistApiError, type WatchlistPage } from "../api/watchlist.ts";
import { useAuth } from "../auth/authState.ts";
import MoviePoster from "../components/MoviePoster.tsx";
import PageControls from "../components/PageControls.tsx";
import { useFeedback } from "../feedback.ts";
import { currentReturnPath, movieDetailReturnState } from "../navigation/movieDetailReturn.ts";
import { pageSearch, readPage } from "../navigation/listPage.ts";
import { listViewState, readListViewState } from "../navigation/listViewState.ts";

type Load = { key: string } & (
  | { kind: "ready"; result: WatchlistPage }
  | { kind: "error"; message: string }
);

export default function WatchlistPage() {
  const auth = useAuth();
  const feedback = useFeedback();
  const location = useLocation();
  const navigate = useNavigate();
  const accountId = auth.status === "authenticated" ? auth.user.id : "";
  const page = readPage(location.search);
  const [reload, setReload] = useState(0);
  const [load, setLoad] = useState<Load | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [writeError, setWriteError] = useState("");
  const pendingRef = useRef(false);
  const writeController = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const revision = useRef<string | undefined>(undefined);
  const key = `${accountId}:${page}:${reload}`;
  const current = load?.key === key ? load : null;

  useEffect(() => () => {
    generation.current += 1;
    writeController.current?.abort();
  }, []);

  useEffect(() => {
    const raw = new URLSearchParams(location.search).get("page");
    if (raw !== null && raw !== String(page)) {
      navigate({ pathname: "/watchlist", search: pageSearch(location.search, page), hash: location.hash },
        { replace: true });
    }
  }, [location.search, location.hash, page, navigate]);

  useEffect(() => {
    const controller = new AbortController();
    const stored = readListViewState(location.state, "/watchlist");
    const requestedRevision = stored?.accountId === accountId ? stored.catalogueRevision : revision.current;
    getWatchlistPage(page, requestedRevision, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      revision.current = result.meta.catalogueRevision;
      if (page > result.meta.totalPages && page !== 1) {
        navigate({ pathname: "/watchlist", search: pageSearch(location.search,
          Math.max(1, result.meta.totalPages)), hash: location.hash }, { replace: true });
        return;
      }
      setLoad({ key, kind: "ready", result });
    }).catch(error => {
      if (controller.signal.aborted) return;
      if (error instanceof WatchlistApiError && error.status === 401) {
        auth.handleUnauthorized();
        navigate("/login", { replace: true });
        return;
      }
      if (error instanceof WatchlistApiError && error.code === "CATALOGUE_CHANGED") {
        revision.current = undefined;
        navigate({ pathname: "/watchlist", search: pageSearch(location.search, 1) }, { replace: true });
        if (page === 1) setReload(value => value + 1);
        return;
      }
      setLoad({ key, kind: "error", message: error instanceof Error ? error.message : "Watchlist unavailable" });
    });
    return () => controller.abort();
    // The route is protected and remounts when the account changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, page, accountId, navigate]);

  async function remove(movieId: string) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    const controller = new AbortController();
    writeController.current = controller;
    const request = ++generation.current;
    const currentRequest = () => generation.current === request && !controller.signal.aborted;
    setPendingId(movieId);
    setWriteError("");
    const notice = feedback.announce({ kind: "pending", title: "Removing from watchlist…" });
    try {
      await setMembership(movieId, false, controller.signal);
      if (!currentRequest()) return;
      feedback.update(notice, { kind: "success", title: "Removed from watchlist" });
      setReload(value => value + 1);
    } catch (error) {
      if (!currentRequest()) return;
      if (error instanceof WatchlistApiError && error.status === 401) {
        feedback.dismiss(notice);
        auth.handleUnauthorized();
        navigate("/login", { replace: true });
        return;
      }
      try {
        const status = await getMembership(movieId, controller.signal);
        if (!currentRequest()) return;
        if (!status.inWatchlist) {
          feedback.update(notice, { kind: "success", title: "Removed from watchlist" });
          setReload(value => value + 1);
        } else {
          setWriteError("Removal was not saved. Please retry.");
          feedback.update(notice, { kind: "error", title: "Removal not saved" });
        }
      } catch (readError) {
        if (!currentRequest()) return;
        if (readError instanceof WatchlistApiError && readError.status === 401) {
          feedback.dismiss(notice);
          auth.handleUnauthorized();
          navigate("/login", { replace: true });
        } else {
          setWriteError("Removal could not be confirmed. Refresh your watchlist before retrying.");
          feedback.update(notice, { kind: "error", title: "Removal not confirmed" });
        }
      }
    } finally {
      if (currentRequest()) {
        pendingRef.current = false;
        writeController.current = null;
        setPendingId(null);
      }
    }
  }

  const context = { route: "/watchlist" as const, catalogueRevision: current?.kind === "ready" ?
    current.result.meta.catalogueRevision : undefined, accountId };
  return <main className="page watchlist-page">
    <header className="catalogue-header watchlist-header">
      <div><p className="eyebrow">Your collection</p><h1>My watchlist</h1>
        <p className="muted">Movies you saved for another night.</p></div>
      <Link className="button-link button-secondary" to="/">Explore movies</Link>
    </header>
    {writeError ? <div className="status-panel" role="alert"><p>{writeError}</p>
      <button type="button" onClick={() => setReload(value => value + 1)}>Refresh watchlist</button></div> : null}
    {!current ? <p className="status-panel" role="status">Loading your watchlist...</p> :
      current.kind === "error" ? <section className="status-panel" role="alert">
        <h2>Watchlist unavailable</h2><p>{current.message}</p>
        <button type="button" onClick={() => setReload(value => value + 1)}>Retry</button>
      </section> : current.result.meta.total === 0 ? <section className="status-panel watchlist-empty">
        <h2>No saved movies yet</h2>
        <p className="muted">Open a movie and choose Add to watchlist to save it here.</p>
        <Link className="button-link" to="/">Browse movies</Link>
      </section> : <>
        <p className="muted" role="status">{current.result.meta.total} saved movies · Page {page} of {current.result.meta.totalPages}</p>
        <section className="movie-grid" aria-label="Saved movies">
          {current.result.data.movies.map(movie => <article className="movie-card watchlist-card" key={movie.id}>
            <MoviePoster movieId={movie.id} title={movie.title} posterUrl={movie.posterUrl} />
            <div className="movie-card__body"><p className="movie-year">{movie.releaseYear ?? "Year unavailable"}</p>
              <h2>{movie.title}</h2><p className="muted">Saved {new Date(movie.addedAt).toLocaleDateString()}</p></div>
            <div className="watchlist-card__actions">
              <Link className="button-link button-secondary" to={`/movies/${encodeURIComponent(movie.id)}`}
                state={movieDetailReturnState(currentReturnPath(location), context)}
                aria-label={`View details for ${movie.title}`}>View details</Link>
              <button type="button" className="button-secondary" disabled={pendingId !== null}
                onClick={() => void remove(movie.id)} aria-label={`Remove ${movie.title} from watchlist`}>
                {pendingId === movie.id ? "Removing…" : "Remove"}
              </button>
            </div>
          </article>)}
        </section>
        <PageControls meta={current.result.meta} state={listViewState(context)} />
      </>}
  </main>;
}
