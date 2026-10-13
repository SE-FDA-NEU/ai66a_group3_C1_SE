import { Link } from "react-router-dom";

import type { Genre, MovieSummary } from "../api/movies.ts";
import { movieDetailReturnState } from "../navigation/movieDetailReturn.ts";

const INFORMATION_UNAVAILABLE = "Information unavailable";

type MovieCardProps = {
  movie: MovieSummary;
  matchedGenres?: Genre[];
  returnTo?: string;
};

function MovieCard({ movie, matchedGenres, returnTo }: MovieCardProps) {
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
        {matchedGenres && matchedGenres.length > 0 ? (
          <p className="movie-reason">
            Matches your genres: {matchedGenres.map((genre) => genre.name).join(" · ")}
          </p>
        ) : null}
      </div>
      <Link
        className="movie-card__link"
        to={`/movies/${encodeURIComponent(movie.id)}`}
        state={returnTo ? movieDetailReturnState(returnTo) : undefined}
        aria-label={`View details for ${movie.title}`}
      >
        View details
      </Link>
    </article>
  );
}

export default MovieCard;
