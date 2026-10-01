import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { listMovies, type MovieSummary } from "../api/movies.ts";

const INFORMATION_UNAVAILABLE = "Information unavailable";

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
        <Link className="button-link button-secondary" to="/login">
          Sign in
        </Link>
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
        <section aria-label="Movie catalogue" className="movie-grid">
          {movies.map((movie) => (
            <article className="movie-card" key={movie.id}>
              <div>
                <p className="movie-year">
                  {movie.releaseYear ?? INFORMATION_UNAVAILABLE}
                </p>
                <h2>{movie.title}</h2>
                <p className="muted">
                  {movie.genres.length > 0
                    ? movie.genres.map((genre) => genre.name).join(" · ")
                    : INFORMATION_UNAVAILABLE}
                </p>
              </div>
              <Link
                className="movie-card__link"
                to={`/movies/${encodeURIComponent(movie.id)}`}
                aria-label={`View details for ${movie.title}`}
              >
                View details
              </Link>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

export default HomePage;
