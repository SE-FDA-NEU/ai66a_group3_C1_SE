import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { listMoviePage, MovieApiError, type MovieSummary, type PageMeta } from "../api/movies.ts";
import { currentReturnPath } from "../navigation/movieDetailReturn.ts";
import { pageSearch, readCatalogueSort, readPage, resultSummary } from "../navigation/listPage.ts";
import { listViewState, readListViewState, sameListViewContext,
  type ListViewContext } from "../navigation/listViewState.ts";
import MovieGrid from "./MovieGrid.tsx";
import PageControls from "./PageControls.tsx";
import MoviePoster from "./MoviePoster.tsx";
import PopularSpotlight from "./PopularSpotlight.tsx";
import CollectionHeading from "./CollectionHeading.tsx";

type Load = { key: string } & (
  | { status: "ready"; movies: MovieSummary[]; meta: PageMeta }
  | { status: "error"; message: string }
);

export default function PublicMovieList({ kind }: { kind: "catalogue" | "popular" }) {
  const location = useLocation();
  const latestLocation = useRef(location);
  const navigate = useNavigate();
  const page = readPage(location.search);
  const sort = kind === "catalogue" ? readCatalogueSort(location.search) : "title_asc";
  const [retry, setRetry] = useState(0);
  const [load, setLoad] = useState<Load | null>(null);
  const route = kind === "popular" ? "/popular" : "/";
  const revision = useRef<string | undefined>(
    readListViewState(location.state, route)?.catalogueRevision);
  const key = `${kind}:${sort}:${page}:${retry}`;
  const current = load?.key === key ? load : null;

  useLayoutEffect(() => { latestLocation.current = location; }, [location]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const rawPage = params.get("page");
    const rawSort = params.get("sort");
    const invalidPage = rawPage !== null && String(page) !== rawPage;
    const invalidSort = kind === "catalogue" && rawSort !== null &&
      rawSort !== "title_asc" && rawSort !== "title_desc";
    if (invalidPage || invalidSort) {
      if (invalidPage) params.set("page", String(page));
      if (invalidSort) params.delete("sort");
      navigate({ pathname: location.pathname, search: params.size ? `?${params}` : "",
        hash: location.hash }, { replace: true, state: location.state });
    }
  }, [kind, location.pathname, location.search, location.hash, location.state, navigate, page]);

  useEffect(() => {
    const controller = new AbortController();
    const requestedRevision = readListViewState(location.state, route)?.catalogueRevision ??
      revision.current;
    listMoviePage(kind, page, requestedRevision, controller.signal, sort).then(body => {
      if (controller.signal.aborted) return;
      const currentLocation = latestLocation.current;
      if (currentLocation.pathname !== route || readPage(currentLocation.search) !== page) return;
      if (kind === "catalogue" && readCatalogueSort(currentLocation.search) !== sort) return;
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
      if (kind === "catalogue" && readCatalogueSort(currentLocation.search) !== sort) return;
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
    // Only the list kind, sort, page or retry changes the result. A successful context
    // stamp and unrelated query/hash navigation must not repeat the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, sort, page, retry, key, navigate, location.pathname, route]);

  const popular = kind === "popular";
  const featuredMovieId = readListViewState(location.state, route)?.featuredMovieId;
  const returnContext: ListViewContext = { route,
    catalogueRevision: current?.status === "ready" ? current.meta.catalogueRevision : undefined,
    ...(popular && featuredMovieId ? { featuredMovieId } : {}) };
  return <main className="page catalogue-page">
    {popular ? <CollectionHeading kind="popular" eyebrow="The popularity collection" title="Popular movies"
      description="The films leading this catalogue. Find your next favourite.">
      <Link className="button-link button-secondary" to="/">Movie catalogue <span aria-hidden="true">↗</span></Link>
    </CollectionHeading> :
    <header className="catalogue-header catalogue-hero">
      <div className="catalogue-header__copy">
        <p className="eyebrow">Your next movie night</p>
        <h1>Find your <br /><span>next movie</span></h1>
        <p className="muted">Less scrolling. More great films.</p>
        <span className="sr-only" id="start-hint">Choose your favourite genres for personalised recommendations.</span>
      <nav className="catalogue-actions" aria-label="Public navigation">
          <Link className="button-link" to="/preferences" aria-describedby="start-hint">Start</Link>
          <a className="button-link button-secondary" href="#catalogue-shelf">Explore Catalogue</a>
      </nav>
      <p className="catalogue-hero__footnote">{current?.status === "ready" ? `${current.meta.total} movies to explore` : "A world of stories"}<span aria-hidden="true"> · </span> Your taste, your choice</p>
      </div>
      <div className="catalogue-hero__visual" aria-hidden="true">
        <span className="catalogue-hero__orbit" />
        {current?.status === "ready" && current.movies.length ? current.movies.slice(0, 3).map(movie =>
          <div className="hero-poster" key={movie.id}><MoviePoster movieId={movie.id} title={movie.title} posterUrl={movie.posterUrl} eager /></div>) :
          <div className="hero-empty-art"><span>✦</span><span>THE NEXT SCENE<br />IS YOURS.</span></div>}
        <span className="catalogue-hero__visual-label">THE CINEAI COLLECTION</span>
      </div>
    </header>}
    {popular && current?.status === "ready" && current.movies.length > 0 ?
      <PopularSpotlight movies={current.movies} startRank={(current.meta.page - 1) * current.meta.limit + 1}
        activeMovieId={featuredMovieId} onSelect={movieId => navigate({ pathname: location.pathname,
          search: location.search, hash: location.hash }, { replace: true,
          state: listViewState({ ...returnContext, featuredMovieId: movieId }) })}
        returnTo={currentReturnPath(location)} returnContext={returnContext} /> : null}
    <section id="catalogue-shelf" className="catalogue-shelf" aria-label={popular ? "Popular movie results" : "Catalogue results"} tabIndex={-1}>
    {!popular || (current?.status === "ready" && current.meta.total > 0) ?
      <div className="catalogue-summary">
        <h2>{popular ? "The popularity list" : "Explore the catalogue"}</h2>
        {current?.status === "ready" ? <p className="muted">{resultSummary(current.meta)}</p> : null}
        {popular ? <span className="order-badge">Popularity · highest first</span> :
          <div className="catalogue-sort">
            <label htmlFor="catalogue-sort">Sort by title</label>
            <select id="catalogue-sort" value={sort} onChange={event => {
              const params = new URLSearchParams(location.search);
              if (event.target.value === "title_desc") params.set("sort", "title_desc");
              else params.delete("sort");
              params.set("page", "1");
              navigate({ pathname: location.pathname, search: `?${params}`,
                hash: location.hash }, { state: location.state });
            }}>
              <option value="title_asc">A–Z</option>
              <option value="title_desc">Z–A</option>
            </select>
          </div>}
      </div> : null}
    {!current ? <p className="status-panel" role="status">{popular ? "Loading popular movies..." : "Loading movies..."}</p> :
      current.status === "error" ? <section className="status-panel" role="alert">
        <h2>{popular ? "Popular movies are unavailable" : "Movies are unavailable"}</h2>
        <p>{current.message}</p>
        <button type="button" onClick={() => setRetry(value => value + 1)}>Retry</button>
      </section> : current.meta.total === 0 ? <section className="status-panel" role="status">
        <h2>{popular ? "Popular movies are not available yet" : "No movies available"}</h2>
        {!popular ? <p className="muted">The active catalogue does not contain any movies yet.</p> : null}
      </section> : <>
        <MovieGrid ariaLabel={popular ? "Popular movies" : "Movie catalogue"}
          movies={current.movies} returnTo={currentReturnPath(location)}
          returnContext={returnContext} />
        <PageControls meta={current.meta} state={listViewState({ route,
          catalogueRevision: current.meta.catalogueRevision })} />
      </>}
    </section>
  </main>;
}
