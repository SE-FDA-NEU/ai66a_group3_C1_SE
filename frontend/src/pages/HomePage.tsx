import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { listMovies, type MovieSummary } from "../api/movies.ts";
import MovieGrid from "../components/MovieGrid.tsx";

function HomePage() {
  const [movies, setMovies] = useState<MovieSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    listMovies(10)
      .then((result) => {
        if (!cancelled) {
          setMovies(result);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setError(
            error instanceof Error ? error.message : "Something went wrong",
          );
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

  async function handleRetry() {
    setIsLoading(true);
    setError("");

    try {
      setMovies(await listMovies(10));
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Something went wrong",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="page catalogue-page">
      <header className="catalogue-header">
        <div>
          <p className="eyebrow">AI Movie Recommendation System</p>
          <h1>Find your next movie</h1>
          <p className="muted">Browse the public local movie catalogue.</p>
        </div>
        <nav className="catalogue-actions" aria-label="Public navigation">
          <Link className="button-link button-secondary" to="/popular">
            Popular movies
          </Link>
          <Link
            className="button-link button-secondary"
            to="/about-recommendations"
          >
            How recommendations work
          </Link>
          <Link className="button-link" to="/login">
            Sign in
          </Link>
        </nav>
      </header>

      {isLoading ? (
        <p className="status-panel" role="status">
          Loading movies...
        </p>
      ) : error ? (
        <section className="status-panel" role="alert">
          <h2>Movies are unavailable</h2>
          <p>{error}</p>
          <button type="button" onClick={() => void handleRetry()}>
            Retry
          </button>
        </section>
      ) : movies.length === 0 ? (
        <section className="status-panel">
          <h2>No movies available</h2>
          <p className="muted">The active catalogue does not contain any movies yet.</p>
        </section>
      ) : (
        <MovieGrid ariaLabel="Movie catalogue" movies={movies} />
      )}
    </main>
  );
}

export default HomePage;
