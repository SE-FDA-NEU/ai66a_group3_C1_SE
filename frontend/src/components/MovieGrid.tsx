import type { Genre, MovieSummary } from "../api/movies.ts";
import MovieCard from "./MovieCard.tsx";

type MovieGridProps = {
  ariaLabel: string;
  movies: (MovieSummary & { reason?: { matchedGenres: Genre[] } })[];
  // Only personalised results explain themselves; popular cards stay plain.
  showReasons?: boolean;
  returnTo?: string;
};

function MovieGrid({
  ariaLabel,
  movies,
  showReasons = false,
  returnTo,
}: MovieGridProps) {
  return (
    <section aria-label={ariaLabel} className="movie-grid">
      {movies.map((movie) => (
        <MovieCard
          key={movie.id}
          movie={movie}
          matchedGenres={showReasons ? movie.reason?.matchedGenres : undefined}
          returnTo={returnTo}
        />
      ))}
    </section>
  );
}

export default MovieGrid;
