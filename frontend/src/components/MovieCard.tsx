import { Link } from "react-router-dom";

import type { Genre, MovieSummary } from "../api/movies.ts";
import { formatPopularityScore, POPULARITY_LABEL } from "../formatPopularity.ts";
import { movieDetailReturnState } from "../navigation/movieDetailReturn.ts";
import type { ListViewContext } from "../navigation/listViewState.ts";
import MoviePoster from "./MoviePoster.tsx";
import type { RecommendationMovie } from "../api/recommendations.ts";

const INFORMATION_UNAVAILABLE = "Information unavailable";

type MovieCardProps = {
  movie: MovieSummary;
  matchedGenres?: Genre[];
  ranking?: {
    ratingAdjustment: number;
    adjustedScore: number | null;
    basis: NonNullable<RecommendationMovie["basis"]>;
  };
  returnTo?: string;
  returnContext?: ListViewContext;
};

function MovieCard({ movie, matchedGenres, ranking, returnTo, returnContext }: MovieCardProps) {
  return (
    <article className="movie-card">
      <MoviePoster movieId={movie.id} title={movie.title} posterUrl={movie.posterUrl} />
      <div className="movie-card__body">
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
        {ranking ? <>
          <dl className="movie-popularity">
            <dt>Personal adjusted score</dt>
            <dd>{formatPopularityScore(ranking.adjustedScore)}</dd>
          </dl>
          <p className="movie-reason">{ranking.basis === "rating_unavailable"
            ? "Personal rating signals are temporarily unavailable. Showing baseline order."
            : ranking.basis === "rating_signals"
              ? `Related rating signals: ${ranking.ratingAdjustment > 0 ? "+" : ""}${ranking.ratingAdjustment}`
              : "No effective rating adjustment."}</p>
        </> : null}
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
