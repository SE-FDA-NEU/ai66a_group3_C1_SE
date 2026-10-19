import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { listMoviePage, MovieApiError, type MovieSummary, type PageMeta } from "../api/movies.ts";
import { currentReturnPath } from "../navigation/movieDetailReturn.ts";
import { pageSearch, readPage, resultSummary } from "../navigation/listPage.ts";
import { listViewState, readListViewState, sameListViewContext,
  type ListViewContext } from "../navigation/listViewState.ts";
import MovieGrid from "./MovieGrid.tsx";
import PageControls from "./PageControls.tsx";
import SessionNavigation from "./SessionNavigation.tsx";

type Load = { key: string } & (
  | { status: "ready"; movies: MovieSummary[]; meta: PageMeta }
  | { status: "error"; message: string }
);

export default function PublicMovieList({ kind }: { kind: "catalogue" | "popular" }) {
  const location = useLocation();
  const latestLocation = useRef(location);
  const navigate = useNavigate();
  const page = readPage(location.search);
  const [retry, setRetry] = useState(0);
  const [load, setLoad] = useState<Load | null>(null);
  const route = kind === "popular" ? "/popular" : "/";
  const revision = useRef<string | undefined>(
    readListViewState(location.state, route)?.catalogueRevision);
  const key = `${kind}:${page}:${retry}`;
  const current = load?.key === key ? load : null;

  useLayoutEffect(() => { latestLocation.current = location; }, [location]);

  useEffect(() => {
    const raw = new URLSearchParams(location.search).get("page");
    if (raw !== null && String(page) !== raw) {
      navigate({ pathname: location.pathname, search: pageSearch(location.search, page) }, { replace: true });
    }
  }, [location.pathname, location.search, navigate, page]);

  useEffect(() => {
    const controller = new AbortController();
    const requestedRevision = readListViewState(location.state, route)?.catalogueRevision ??
      revision.current;
    listMoviePage(kind, page, requestedRevision, controller.signal).then(body => {
      if (controller.signal.aborted) return;
      const currentLocation = latestLocation.current;
      if (currentLocation.pathname !== route || readPage(currentLocation.search) !== page) return;
      revision.current = body.meta.catalogueRevision;
      const context: ListViewContext = { route, catalogueRevision: body.meta.catalogueRevision };
      if (page > body.meta.totalPages && page !== 1) {
        navigate({ pathname: currentLocation.pathname, search: pageSearch(currentLocation.search,
          Math.max(1, body.meta.totalPages)), hash: currentLocation.hash },
          { replace: true, state: listViewState(context) });
        return;
      }
      if (!sameListViewContext(readListViewState(currentLocation.state, route), context)) {
        navigate({ pathname: currentLocation.pathname, search: currentLocation.search,
          hash: currentLocation.hash }, { replace: true, state: listViewState(context) });
      }
      setLoad({ key, status: "ready", movies: body.data.movies, meta: body.meta });
    }).catch(error => {
      if (controller.signal.aborted) return;
      const currentLocation = latestLocation.current;
      if (currentLocation.pathname !== route || readPage(currentLocation.search) !== page) return;
      if (error instanceof MovieApiError && error.code === "CATALOGUE_CHANGED") {
        revision.current = undefined;
        navigate({ pathname: currentLocation.pathname,
          search: pageSearch(currentLocation.search, 1), hash: currentLocation.hash },
          { replace: true });
        if (page === 1) setRetry(value => value + 1);
        return;
      }
      setLoad({ key, status: "error", message: error instanceof Error ? error.message : "Something went wrong" });
    });
    return () => controller.abort();
    // Only the list kind, page or retry changes the result. A successful context
    // stamp and unrelated query/hash navigation must not repeat the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, page, retry, key, navigate, location.pathname, route]);

  const popular = kind === "popular";
  return <main className="page catalogue-page">
    <header className="catalogue-header">
      <div>
        <p className="eyebrow">AI Movie Recommendation System</p>
        <h1>{popular ? "Popular movies" : "Find your next movie"}</h1>
        <p className="muted">{popular ? "Browse the highest-ranked movies in the active catalogue." : "Browse the public local movie catalogue."}</p>
        {!popular ? <p className="muted" id="start-hint">Choose Start to pick up to 5 favourite genres and get recommendations saved to your account.</p> : null}
      </div>
      <nav className="catalogue-actions" aria-label="Public navigation">
        {popular ? <Link className="button-link button-secondary" to="/">Movie catalogue</Link> : <>
          <Link className="button-link" to="/preferences" aria-describedby="start-hint">Start</Link>
          <Link className="button-link button-secondary" to="/popular">Popular movies</Link>
          <Link className="button-link button-secondary" to="/about-recommendations">How recommendations work</Link>
        </>}
        <SessionNavigation />
      </nav>
    </header>
    {!current ? <p className="status-panel" role="status">{popular ? "Loading popular movies..." : "Loading movies..."}</p> :
      current.status === "error" ? <section className="status-panel" role="alert">
        <h2>{popular ? "Popular movies are unavailable" : "Movies are unavailable"}</h2>
        <p>{current.message}</p>
        <button type="button" onClick={() => setRetry(value => value + 1)}>Retry</button>
      </section> : current.meta.total === 0 ? <section className="status-panel" role="status">
        <h2>{popular ? "Popular movies are not available yet" : "No movies available"}</h2>
        {!popular ? <p className="muted">The active catalogue does not contain any movies yet.</p> : null}
      </section> : <>
        <p className="muted">{resultSummary(current.meta)}</p>
        <MovieGrid ariaLabel={popular ? "Popular movies" : "Movie catalogue"}
          movies={current.movies} returnTo={currentReturnPath(location)}
          returnContext={{ route, catalogueRevision: current.meta.catalogueRevision }} />
        <PageControls meta={current.meta} state={listViewState({ route,
          catalogueRevision: current.meta.catalogueRevision })} />
      </>}
  </main>;
}
