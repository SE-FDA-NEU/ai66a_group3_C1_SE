import type { Genre, MovieSummary } from "../api/movies.ts";
import type { RecommendationMovie } from "../api/recommendations.ts";
import type { ListViewContext } from "../navigation/listViewState.ts";
import MovieCard from "./MovieCard.tsx";

type MovieGridProps = {
  ariaLabel: string;
  movies: (MovieSummary & Partial<RecommendationMovie> & {
    reason?: { matchedGenres: Genre[] };
  })[];
  // Only personalised results explain themselves; popular cards stay plain.
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
          ranking={showReasons && movie.basis !== undefined &&
            typeof movie.ratingAdjustment === "number" ? {
              basis: movie.basis,
              ratingAdjustment: movie.ratingAdjustment,
              adjustedScore: movie.adjustedScore ?? null,
            } : undefined}
          returnTo={returnTo}
          returnContext={returnContext}
        />
      ))}
    </section>
  );
}

export default MovieGrid;
