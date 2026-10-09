import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  listPopularMovies,
  type MovieSummary,
} from "../api/movies.ts";
import MovieGrid from "../components/MovieGrid.tsx";

function PopularMoviesPage() {
  const [movies, setMovies] = useState<MovieSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadMovies = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      setMovies(await listPopularMovies(10));
    } catch (error) {
      setMovies([]);
      setError(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    listPopularMovies(10)
      .then((result) => {
        if (!cancelled) {
          setMovies(result);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setError(error instanceof Error ? error.message : "Something went wrong");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="page catalogue-page">
      <header className="catalogue-header">
        <div>
          <p className="eyebrow">AI Movie Recommendation System</p>
          <h1>Popular movies</h1>
          <p className="muted">Browse the highest-ranked movies in the active catalogue.</p>
        </div>
        <nav className="catalogue-actions" aria-label="Public navigation">
          <Link className="button-link button-secondary" to="/">
            Movie catalogue
          </Link>
          <Link className="button-link" to="/login">
            Sign in
          </Link>
        </nav>
      </header>

      {isLoading ? (
        <p className="status-panel" role="status">
          Loading popular movies...
        </p>
      ) : error ? (
        <section className="status-panel" role="alert">
          <h2>Popular movies are unavailable</h2>
          <p>{error}</p>
          <button type="button" onClick={() => void loadMovies()}>
            Retry
          </button>
        </section>
      ) : movies.length === 0 ? (
        <section className="status-panel" role="status">
          <h2>Popular movies are not available yet</h2>
        </section>
      ) : (
        <MovieGrid ariaLabel="Popular movies" movies={movies} />
      )}
    </main>
  );
}

export default PopularMoviesPage;
