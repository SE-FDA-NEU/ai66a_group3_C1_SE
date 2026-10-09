import { Link } from "react-router-dom";

import type { MovieSummary } from "../api/movies.ts";

const INFORMATION_UNAVAILABLE = "Information unavailable";

type MovieCardProps = {
  movie: MovieSummary;
};

function MovieCard({ movie }: MovieCardProps) {
  return (
    <article className="movie-card">
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
  );
}

export default MovieCard;
