import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  getMovie,
  MovieApiError,
  type MovieDetail,
} from "../api/movies.ts";

const INFORMATION_UNAVAILABLE = "Information unavailable";

function MovieDetailPage() {
  const { movieId = "" } = useParams();
  const [movie, setMovie] = useState<MovieDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
  let cancelled = false;

  getMovie(movieId)
    .then((result) => {
      if (!cancelled) {
        setMovie(result);
      }
    })
    .catch((error) => {
      if (cancelled) {
        return;
      }

      setMovie(null);

      if (
        error instanceof MovieApiError &&
        (error.status === 404 || error.code === "MOVIE_NOT_FOUND")
      ) {
        setNotFound(true);
      } else {
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
}, [movieId]);

async function handleRetry() {
  setIsLoading(true);
  setError("");
  setNotFound(false);

  try {
    setMovie(await getMovie(movieId));
  } catch (error) {
    setMovie(null);

    if (
      error instanceof MovieApiError &&
      (error.status === 404 || error.code === "MOVIE_NOT_FOUND")
    ) {
      setNotFound(true);
    } else {
      setError(
        error instanceof Error ? error.message : "Something went wrong",
      );
    }
  } finally {
    setIsLoading(false);
  }
}
  if (isLoading) {
    return (
      <main className="page page--centered">
        <p role="status">Loading movie...</p>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="page page--centered">
        <section className="content-card" aria-labelledby="movie-not-found-title">
          <p className="eyebrow">Movie catalogue</p>
          <h1 id="movie-not-found-title">Movie not found</h1>
          <p className="muted">That movie is not available in the active catalogue.</p>
          <Link className="button-link" to="/">
            Return to catalogue
          </Link>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="page page--centered">
        <section className="content-card" role="alert">
          <p className="eyebrow">Movie catalogue</p>
          <h1>Movie details are unavailable</h1>
          <p>{error}</p>
          <div className="detail-actions">
            <button type="button" onClick={() => void handleRetry()}>
              Retry
            </button>
            <Link className="button-link button-secondary" to="/">
              Return to catalogue
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (!movie) {
    return null;
  }

  return (
    <main className="page">
      <article className="movie-detail">
        <Link className="text-link" to="/">
          ← Back to catalogue
        </Link>
        <p className="eyebrow">Movie details</p>
        <h1>{movie.title}</h1>

        <dl className="movie-detail__facts">
          <div>
            <dt>Year</dt>
            <dd>{movie.releaseYear ?? INFORMATION_UNAVAILABLE}</dd>
          </div>
          <div>
            <dt>Genres</dt>
            <dd>
              {movie.genres.length > 0
                ? movie.genres.map((genre) => genre.name).join(", ")
                : INFORMATION_UNAVAILABLE}
            </dd>
          </div>
        </dl>

        <section>
          <h2>Overview</h2>
          <p>{movie.overview ?? INFORMATION_UNAVAILABLE}</p>
        </section>
      </article>
    </main>
  );
}

export default MovieDetailPage;
