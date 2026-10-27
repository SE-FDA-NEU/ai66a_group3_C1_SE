import type { Genre, MovieSummary } from "../api/movies.ts";
import type { RecommendationMovie } from "../api/recommendations.ts";
import type { ListViewContext } from "../navigation/listViewState.ts";
import MovieCard from "./MovieCard.tsx";

type MovieGridProps = {
  ariaLabel: string;
  movies: (MovieSummary & { reason?: { matchedGenres: Genre[] } } &
    Pick<RecommendationMovie, "ratingAdjustment" | "adjustedScore" | "basis">)[];
  // Only personalised results explain themselves and show their ranking score;
  // popular cards stay plain.
  showReasons?: boolean;
  returnTo?: string;
  returnContext?: ListViewContext;
};

function MovieGrid({
  ariaLabel,
  movies,
  showReasons = false,
  returnTo,
  returnContext,
}: MovieGridProps) {
  return (
    <section aria-label={ariaLabel} className="movie-grid">
      {movies.map((movie) => (
        <MovieCard
          key={movie.id}
          movie={movie}
          matchedGenres={showReasons ? movie.reason?.matchedGenres : undefined}
          ranking={showReasons && movie.basis !== undefined ? {
            ratingAdjustment: movie.ratingAdjustment,
            adjustedScore: movie.adjustedScore,
            basis: movie.basis,
          } : undefined}
          returnTo={returnTo}
          returnContext={returnContext}
        />
      ))}
    </section>
  );
}

export default MovieGrid;
