import { useEffect, useId, useState } from "react";

import { getSimilarMovies, type MovieSummary } from "../api/movies.ts";
import type { ListViewContext } from "../navigation/listViewState.ts";
import MovieGrid from "./MovieGrid.tsx";

const SIMILAR_LIMIT = 5;

type Load = { key: string } & (
  | { status: "ready"; movies: MovieSummary[] }
  | { status: "error"; message: string }
);

type SimilarMoviesProps = {
  movieId: string;
  returnTo: string;
  returnContext?: ListViewContext;
};

// The server owns the order. The browser only keeps the first five distinct
// movies other than the source, so a repeated ID never renders twice.
function firstDistinct(movies: MovieSummary[], sourceId: string): MovieSummary[] {
  const seen = new Set<string>([sourceId]);
  return movies.filter((movie) => !seen.has(movie.id) && seen.add(movie.id)).slice(0, SIMILAR_LIMIT);
}

// Public and independent of sign-in and of the rating widget. The caller keys
// it by movie, and every read is also tied to that movie's request identity,
// so a late response for movie A can never fill the section shown for movie B.
function SimilarMovies({ movieId, returnTo, returnContext }: SimilarMoviesProps) {
  const heading = useId();
  const [retry, setRetry] = useState(0);
  const [load, setLoad] = useState<Load | null>(null);
  const key = JSON.stringify([movieId, retry]);
  const current = load?.key === key ? load : null;

  useEffect(() => {
    const controller = new AbortController();
    getSimilarMovies(movieId, controller.signal).then((movies) => {
      if (!controller.signal.aborted) {
        setLoad({ key, status: "ready", movies: firstDistinct(movies, movieId) });
      }
    }).catch((error) => {
      if (!controller.signal.aborted) {
        setLoad({ key, status: "error", message: error instanceof Error ? error.message : "Something went wrong" });
      }
    });
    // Guard completions even when a transport ignores cancellation.
    return () => controller.abort();
  }, [movieId, key]);

  return (
    <section className="similar-movies" aria-labelledby={heading}>
      <h2 id={heading}>Similar movies</h2>
      {!current ? <p role="status">Loading similar movies...</p> :
        current.status === "error" ? (
          <div role="alert">
            <p>Similar movies are unavailable. {current.message}</p>
            <button type="button" onClick={() => setRetry((value) => value + 1)}>
              Retry similar movies
            </button>
          </div>
        ) : current.movies.length === 0 ? (
          <p role="status">No similar movies are available</p>
        ) : (
          <MovieGrid ariaLabel="Similar movie cards" movies={current.movies}
            returnTo={returnTo} returnContext={returnContext} />
        )}
    </section>
  );
}

export default SimilarMovies;
