import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { searchMoviePage, MovieApiError, type MovieSummary, type PageMeta } from "../api/movies.ts";
import MovieGrid from "../components/MovieGrid.tsx";
import PageControls from "../components/PageControls.tsx";
import { currentReturnPath } from "../navigation/movieDetailReturn.ts";
import { pageSearch, readPage, resultSummary } from "../navigation/listPage.ts";
import { listViewState, readListViewState, sameListViewContext } from "../navigation/listViewState.ts";

type Load = { key: string } & (
  | { status: "ready"; movies: MovieSummary[]; meta: PageMeta }
  | { status: "error"; message: string }
);

export default function SearchPage() {
  const location = useLocation();
  const latestLocation = useRef(location);
  const revision = useRef<{ query: string; id?: string }>({ query: "" });
  useLayoutEffect(() => { latestLocation.current = location; }, [location]);
  const navigate = useNavigate();
  const input = new URLSearchParams(location.search).get("q") ?? "";
  const query = input.trim();
  const page = readPage(location.search);
  const valid = [...query].length >= 2;
  const [draft, setDraft] = useState({ url: location.search, value: input, invalid: false });
  // Browser Back/deep links restore the last submitted query. Typing stays local.
  if (draft.url !== location.search) setDraft({ url: location.search, value: input, invalid: false });
  const draftValue = draft.url === location.search ? draft.value : input;
  const invalidDraft = draft.url === location.search && draft.invalid;
  const awaitingSubmit = draftValue.trim() !== query;
  const [retry, setRetry] = useState(0);
  const [load, setLoad] = useState<Load | null>(null);
  const key = JSON.stringify([query, page, retry]);
  const current = load?.key === key ? load : null;

  useEffect(() => {
    if (!valid) return;
    if (revision.current.query !== query) revision.current = { query };
    const controller = new AbortController();
    const stored = readListViewState(latestLocation.current.state, "/search");
    searchMoviePage(query, page, stored?.catalogueRevision ?? revision.current.id, controller.signal).then(body => {
      if (controller.signal.aborted) return;
      const here = latestLocation.current;
      if (new URLSearchParams(here.search).get("q")?.trim() !== query || readPage(here.search) !== page) return;
      revision.current = { query, id: body.meta.catalogueRevision };
      const context = { route: "/search" as const, catalogueRevision: body.meta.catalogueRevision };
      if (page > Math.max(1, body.meta.totalPages)) {
        navigate({ pathname: "/search", search: pageSearch(here.search, Math.max(1, body.meta.totalPages)),
          hash: here.hash }, { replace: true, state: listViewState(context) });
        return;
      }
      if (!sameListViewContext(readListViewState(here.state, "/search"), context))
        navigate({ pathname: "/search", search: here.search, hash: here.hash },
          { replace: true, state: listViewState(context) });
      setLoad({ key, status: "ready", movies: body.data.movies, meta: body.meta });
    }).catch(error => {
      if (controller.signal.aborted) return;
      if (error instanceof MovieApiError && error.code === "CATALOGUE_CHANGED") {
        revision.current = { query };
        const here = latestLocation.current;
        navigate({ pathname: "/search", search: pageSearch(here.search, 1), hash: here.hash }, { replace: true });
        if (page === 1) setRetry(value => value + 1);
        return;
      }
      setLoad({ key, status: "error", message: error instanceof Error ? error.message : "Something went wrong" });
    });
    // Guard completions even when a transport ignores cancellation.
    return () => controller.abort();
  }, [query, page, key, valid, navigate]);

  return <main className="page search-page">
    <header className="catalogue-header">
      <div className="catalogue-header__copy">
        <p className="eyebrow">Find a story</p>
        <h1>Search movies</h1>
        <p className="muted">Find a title you know, or describe the story you want to see.</p>
      </div>
    </header>
    <form className="content-card search-controls" role="search" aria-label="Movie search"
      onSubmit={event => {
        event.preventDefault();
        const submitted = draftValue.trim();
        if ([...submitted].length < 2) {
          setDraft({ url: location.search, value: draftValue, invalid: true });
          return;
        }
        if (submitted === query) {
          setRetry(value => value + 1);
          setDraft({ url: location.search, value: draftValue, invalid: false });
        } else {
          const params = new URLSearchParams(location.search);
          params.set("q", submitted);
          params.delete("page");
          navigate({ pathname: "/search", search: `?${params}`, hash: location.hash });
        }
      }}>
      <label htmlFor="movie-search">Title or description</label>
      <input id="movie-search" type="search" value={draftValue} aria-describedby="search-hint"
        onChange={event => {
          setDraft({ url: location.search, value: event.target.value, invalid: false });
        }} />
      <button type="submit">Search</button>
      <p id="search-hint" className="field-hint">Enter at least 2 characters, then press Enter or choose Search. Browse all matches, 10 movies per page.</p>
    </form>
    {invalidDraft || (!valid && !awaitingSubmit) ? <p className="status-panel" role="status">Enter at least 2 characters</p> :
      awaitingSubmit ? <p className="status-panel" role="status">Press Enter or Search to see results.</p> :
      !current ? <p className="status-panel" role="status">Loading movies...</p> :
      current.status === "error" ? <section className="status-panel" role="alert">
        <h2>Search is unavailable</h2>
        <p>{current.message}</p>
        <button type="button" onClick={() => setRetry(value => value + 1)}>Retry</button>
      </section> : current.movies.length === 0 ?
        <p className="status-panel" role="status">No movies found</p> : <>
          <p role="status">{resultSummary(current.meta)}</p>
          <MovieGrid ariaLabel="Search results" movies={current.movies}
            returnTo={currentReturnPath(location)}
            returnContext={{ route: "/search", catalogueRevision: current.meta.catalogueRevision }} />
          <PageControls meta={current.meta}
            state={listViewState({ route: "/search", catalogueRevision: current.meta.catalogueRevision })} />
        </>}
  </main>;
}
