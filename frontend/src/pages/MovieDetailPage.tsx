import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import { getMovie, MovieApiError, type MovieDetail } from "../api/movies.ts";
import { formatPopularityScore, POPULARITY_LABEL } from "../formatPopularity.ts";
import { resolveMovieDetailReturn } from "../navigation/movieDetailReturn.ts";
import MovieBackdropHero from "../components/MovieBackdropHero.tsx";
import MovieRating from "../components/MovieRating.tsx";

const INFORMATION_UNAVAILABLE = "Information unavailable";

type DetailLoad = { movieId: string } & (
  | { status: "ready"; movie: MovieDetail }
  | { status: "notFound" }
  | { status: "error"; message: string }
);

function MovieDetailPage() {
  const { movieId = "" } = useParams();
  const location = useLocation();
  const returnDestination = resolveMovieDetailReturn(location.state);
  const [load, setLoad] = useState<DetailLoad | null>(null);
  const [retry, setRetry] = useState(0);
  // A route change must not leave the previous movie's private widget mounted.
  const currentLoad = load?.movieId === movieId ? load : null;
  const movie = currentLoad?.status === "ready" ? currentLoad.movie : null;

  useEffect(() => {
    let cancelled = false;

    getMovie(movieId)
      .then((result) => {
        if (!cancelled) {
          setLoad({ movieId, status: "ready", movie: result });
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        if (
          error instanceof MovieApiError &&
          (error.status === 404 || error.code === "MOVIE_NOT_FOUND")
        ) {
          setLoad({ movieId, status: "notFound" });
        } else {
          setLoad({
            movieId,
            status: "error",
            message:
              error instanceof Error ? error.message : "Something went wrong",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [movieId, retry]);

  function handleRetry() {
    setLoad(null);
    setRetry((value) => value + 1);
  }

  if (!currentLoad) {
    return (
      <main className="page page--centered">
        <p role="status">Loading movie...</p>
      </main>
    );
  }

  if (currentLoad.status === "notFound") {
    return (
      <main className="page page--centered">
        <section
          className="content-card"
          aria-labelledby="movie-not-found-title"
        >
          <p className="eyebrow">Movie catalogue</p>
          <h1 id="movie-not-found-title">Movie not found</h1>
          <p className="muted">
            That movie is not available in the active catalogue.
          </p>
          <Link className="button-link" to={returnDestination.to}>
            {returnDestination.label}
          </Link>
        </section>
      </main>
    );
  }

  if (currentLoad.status === "error") {
    return (
      <main className="page page--centered">
        <section className="content-card" role="alert">
          <p className="eyebrow">Movie catalogue</p>
          <h1>Movie details are unavailable</h1>
          <p>{currentLoad.message}</p>
          <div className="detail-actions">
            <button type="button" onClick={() => void handleRetry()}>
              Retry
            </button>
            <Link
              className="button-link button-secondary"
              to={returnDestination.to}
            >
              {returnDestination.label}
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
        <Link className="text-link movie-detail__return" to={returnDestination.to}>
          <span aria-hidden="true">&larr; </span>
          {returnDestination.label}
        </Link>
        <MovieBackdropHero
          key={`${movie.id}:${movie.backdropUrl ?? ""}`}
          title={movie.title}
          backdropUrl={movie.backdropUrl}
        />

        <div className="movie-detail__body">
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
            <div>
              <dt>{POPULARITY_LABEL}</dt>
              <dd>{formatPopularityScore(movie.popularityScore)}</dd>
            </div>
          </dl>

          <section>
            <h2>Overview</h2>
            <p>{movie.overview ?? INFORMATION_UNAVAILABLE}</p>
          </section>
          <MovieRating movieId={movie.id} />
        </div>
      </article>
    </main>
  );
}

export default MovieDetailPage;
