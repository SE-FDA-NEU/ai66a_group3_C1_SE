import { Link } from "react-router-dom";

import type { Genre, MovieSummary } from "../api/movies.ts";
import { formatPopularityScore, POPULARITY_LABEL } from "../formatPopularity.ts";
import { movieDetailReturnState } from "../navigation/movieDetailReturn.ts";
import type { ListViewContext } from "../navigation/listViewState.ts";

const INFORMATION_UNAVAILABLE = "Information unavailable";

type MovieCardProps = {
  movie: MovieSummary;
  matchedGenres?: Genre[];
  returnTo?: string;
  returnContext?: ListViewContext;
};

function MovieCard({ movie, matchedGenres, returnTo, returnContext }: MovieCardProps) {
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
        <dl className="movie-popularity">
          <dt>{POPULARITY_LABEL}</dt>
          <dd>{formatPopularityScore(movie.popularityScore)}</dd>
        </dl>
        {matchedGenres && matchedGenres.length > 0 ? (
          <p className="movie-reason">
            Matches your genres: {matchedGenres.map((genre) => genre.name).join(" · ")}
          </p>
        ) : null}
      </div>
      <Link
        className="movie-card__link"
        to={`/movies/${encodeURIComponent(movie.id)}`}
        state={returnTo ? movieDetailReturnState(returnTo, returnContext) : undefined}
        aria-label={`View details for ${movie.title}`}
      >
        View details
      </Link>
    </article>
  );
}

export default MovieCard;
