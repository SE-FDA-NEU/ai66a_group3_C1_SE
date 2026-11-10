import { Link } from "react-router-dom";

import type { Genre, MovieSummary } from "../api/movies.ts";
import type { RecommendationMovie } from "../api/recommendations.ts";
import { formatPopularityScore, POPULARITY_LABEL } from "../formatPopularity.ts";
import { movieDetailReturnState } from "../navigation/movieDetailReturn.ts";
import type { ListViewContext } from "../navigation/listViewState.ts";
import MoviePoster from "./MoviePoster.tsx";

const INFORMATION_UNAVAILABLE = "Information unavailable";
const RANKING_LABEL = "Ranking score for you";

type Ranking = Pick<RecommendationMovie, "ratingAdjustment" | "adjustedScore" | "basis">;

type MovieCardProps = {
  movie: MovieSummary;
  matchedGenres?: Genre[];
  ranking?: Ranking;
  returnTo?: string;
  returnContext?: ListViewContext;
};

// Wording follows the server's basis; the browser never recomputes the score.
// "baseline" covers both no ratings and a neutral rating, so it claims neither.
function rankingReason({ ratingAdjustment, adjustedScore, basis }: Ranking): string | null {
  if (basis === "rating_unavailable")
    return "Your rating signals are temporarily unavailable, so this score uses popularity only.";
  if (typeof adjustedScore !== "number" || !Number.isFinite(adjustedScore)) return null;
  if (basis === "rating_signals" && ratingAdjustment !== undefined && ratingAdjustment > 0)
    return "Your high ratings of related movies raised this score.";
  if (basis === "rating_signals" && ratingAdjustment !== undefined && ratingAdjustment < 0)
    return "Your low ratings of related movies lowered this score.";
  return "Your ratings have not changed this score.";
}

function MovieCard({ movie, matchedGenres, ranking, returnTo, returnContext }: MovieCardProps) {
  const reason = ranking ? rankingReason(ranking) : null;
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
        {ranking ? (
          <dl className="movie-popularity movie-ranking">
            <dt>{RANKING_LABEL}</dt>
            <dd>{formatPopularityScore(ranking.adjustedScore)}</dd>
          </dl>
        ) : null}
        {reason ? <p className="movie-ranking-reason">{reason}</p> : null}
        {matchedGenres && matchedGenres.length > 0 ? (
          <p className="movie-reason">
            Matches your genres: {matchedGenres.map((genre) => genre.name).join(" · ")}
          </p>
        ) : null}
      </div>
      <Link
        className="button-link button-secondary movie-card__link"
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
