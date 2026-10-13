import { useEffect, useId, useState } from "react";

import type { Genre } from "../api/movies.ts";
import { listGenres, PreferenceApiError } from "../api/preferences.ts";
import type { RecommendationResult } from "../api/recommendations.ts";
import { useAuth } from "../auth/authState.ts";
import MovieGrid from "./MovieGrid.tsx";

type RecommendationFilterProps = {
  snapshot: RecommendationResult;
  ariaLabel: string;
};

type GenreLoad =
  | { snapshot: RecommendationResult; status: "ready"; genres: Genre[] }
  | { snapshot: RecommendationResult; status: "error"; message: string };

function RecommendationFilter({ snapshot, ariaLabel }: RecommendationFilterProps) {
  const { handleUnauthorized } = useAuth();
  const selectId = useId();
  const [selection, setSelection] = useState<{
    snapshot: RecommendationResult;
    genreId: string;
  } | null>(null);
  const [genreLoad, setGenreLoad] = useState<GenreLoad | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);

  // A newly accepted response is a new snapshot even when catalogueRevision is
  // unchanged. Old filter state must never hide movies from that new response.
  const selectedGenreId =
    selection && selection.snapshot === snapshot ? selection.genreId : "";
  const currentGenreLoad = genreLoad?.snapshot === snapshot ? genreLoad : null;
  const genres = currentGenreLoad?.status === "ready" ? currentGenreLoad.genres : [];

  useEffect(() => {
    const controller = new AbortController();

    // Read the canonical list, not just genres present in these cards: a valid
    // genre with zero snapshot matches must still be selectable (S06).
    listGenres(controller.signal)
      .then((genres) => {
        if (!controller.signal.aborted) {
          setGenreLoad({ snapshot, status: "ready", genres });
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof PreferenceApiError && error.status === 401) {
          handleUnauthorized();
          return;
        }
        setGenreLoad({
          snapshot,
          status: "error",
          message: error instanceof Error ? error.message : "Something went wrong",
        });
      });

    return () => controller.abort();
  }, [snapshot, handleUnauthorized, reloadVersion]);

  // filter() preserves server ordering and leaves the original array intact.
  // It neither fetches recommendations nor writes account preferences.
  const visibleMovies = selectedGenreId === ""
    ? snapshot.movies
    : snapshot.movies.filter((movie) =>
        movie.genres.some((genre) => genre.id === Number(selectedGenreId)),
      );

  function clearFilter() {
    setSelection(null);
  }

  function retryGenres() {
    setGenreLoad(null);
    setReloadVersion((version) => version + 1);
  }

  return (
    <div className="recommendation-filter">
      <div className="recommendation-filter__controls">
        <div className="recommendation-filter__field">
          <label htmlFor={selectId}>Filter by genre</label>
          <select
            id={selectId}
            value={selectedGenreId}
            disabled={genres.length === 0}
            onChange={(event) => setSelection({ snapshot, genreId: event.target.value })}
          >
            <option value="">All genres</option>
            {genres.map((genre) => (
              <option key={genre.id} value={String(genre.id)}>{genre.name}</option>
            ))}
          </select>
        </div>
        <button type="button" className="button-secondary" onClick={clearFilter}
          disabled={selectedGenreId === ""}>
          Clear filter
        </button>
      </div>

      {!currentGenreLoad ? (
        <p className="muted" role="status">Loading genre filters...</p>
      ) : currentGenreLoad.status === "error" ? (
        <div className="recommendation-filter__error" role="alert">
          <p>Genre filters are unavailable. {currentGenreLoad.message}</p>
          <button type="button" className="button-secondary" onClick={retryGenres}>
            Retry filter options
          </button>
        </div>
      ) : genres.length === 0 ? (
        <p className="muted" role="status">No genres are available for filtering.</p>
      ) : null}

      <p className="muted" aria-live="polite">
        Showing {visibleMovies.length} of {snapshot.movies.length} movies
      </p>
      {snapshot.movies.length === 0 ? (
        <p role="status">No recommendations available yet.</p>
      ) : visibleMovies.length === 0 ? (
        <div className="recommendation-empty-state" role="status">
          <h3>No movies match this filter.</h3>
          <p>Clear filter to see the full recommendation list.</p>
          <button type="button" className="button-secondary" onClick={clearFilter}>
            Show all movies
          </button>
        </div>
      ) : (
        <MovieGrid ariaLabel={ariaLabel} movies={visibleMovies}
          showReasons={snapshot.personalised} />
      )}
    </div>
  );
}

export default RecommendationFilter;
