import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { searchMovies, type MovieSummary } from "../api/movies.ts";
import MovieGrid from "../components/MovieGrid.tsx";
import { currentReturnPath } from "../navigation/movieDetailReturn.ts";

type Load = { key: string } & (
  | { status: "ready"; movies: MovieSummary[] }
  | { status: "error"; message: string }
);

export default function SearchPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const input = new URLSearchParams(location.search).get("q") ?? "";
  const query = input.trim();
  const valid = [...query].length >= 2;
  const [retry, setRetry] = useState(0);
  const [load, setLoad] = useState<Load | null>(null);
  const key = JSON.stringify([query, retry]);
  const current = load?.key === key ? load : null;

  useEffect(() => {
    if (!valid) return;
    const controller = new AbortController();
    searchMovies(query, controller.signal).then(movies => {
      if (!controller.signal.aborted) setLoad({ key, status: "ready", movies: movies.slice(0, 10) });
    }).catch(error => {
      if (!controller.signal.aborted) setLoad({ key, status: "error",
        message: error instanceof Error ? error.message : "Something went wrong" });
    });
    // Guard completions even when a transport ignores cancellation.
    return () => controller.abort();
  }, [query, key, valid]);

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
        if (valid) setRetry(value => value + 1);
      }}>
      <label htmlFor="movie-search">Title or description</label>
      <input id="movie-search" type="search" value={input} aria-describedby="search-hint"
        onChange={event => {
          const params = new URLSearchParams(location.search);
          if (event.target.value) params.set("q", event.target.value);
          else params.delete("q");
          navigate({ pathname: "/search", search: params.size ? `?${params}` : "",
            hash: location.hash }, { replace: true });
        }} />
      <button type="submit">Search</button>
      <p id="search-hint" className="field-hint">Results update as you type. Press Enter or choose Search to submit again. Up to 10 movies.</p>
    </form>
    {!valid ? <p className="status-panel" role="status">Enter at least 2 characters</p> :
      !current ? <p className="status-panel" role="status">Loading movies...</p> :
      current.status === "error" ? <section className="status-panel" role="alert">
        <h2>Search is unavailable</h2>
        <p>{current.message}</p>
        <button type="button" onClick={() => setRetry(value => value + 1)}>Retry</button>
      </section> : current.movies.length === 0 ?
        <p className="status-panel" role="status">No movies found</p> : <>
          <p role="status">{current.movies.length} {current.movies.length === 1 ? "movie" : "movies"} found</p>
          <MovieGrid ariaLabel="Search results" movies={current.movies}
            returnTo={currentReturnPath(location)} />
        </>}
  </main>;
}
