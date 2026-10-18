import { useEffect, useId, useState } from "react";
import type { Genre, PageMeta } from "../api/movies.ts";
import { listGenres, PreferenceApiError } from "../api/preferences.ts";
import type { RecommendationResult } from "../api/recommendations.ts";
import { useAuth } from "../auth/authState.ts";
import { resultSummary } from "../navigation/listPage.ts";
import MovieGrid from "./MovieGrid.tsx";
import PageControls from "./PageControls.tsx";

type Props = {
  snapshot: RecommendationResult;
  meta: PageMeta;
  genreId?: number;
  onGenreChange: (genreId?: number) => void;
  ariaLabel: string;
  returnTo?: string;
};

export default function RecommendationFilter({ snapshot, meta, genreId, onGenreChange,
  ariaLabel, returnTo }: Props) {
  const { handleUnauthorized } = useAuth();
  const selectId = useId();
  const [genres, setGenres] = useState<Genre[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    listGenres(controller.signal).then(result => {
      if (!controller.signal.aborted) { setGenres(result); setError(""); setLoading(false); }
    }).catch(failure => {
      if (controller.signal.aborted) return;
      if (failure instanceof PreferenceApiError && failure.status === 401) {
        handleUnauthorized(); return;
      }
      setError(failure instanceof Error ? failure.message : "Something went wrong");
      setLoading(false);
    });
    return () => controller.abort();
  }, [handleUnauthorized, retry]);

  return <div className="recommendation-filter">
    <div className="recommendation-filter__controls">
      <div className="recommendation-filter__field">
        <label htmlFor={selectId}>Filter by genre</label>
        <select id={selectId} value={genreId === undefined ? "" : String(genreId)}
          disabled={loading || !!error || genres.length === 0}
          onChange={event => onGenreChange(event.target.value ? Number(event.target.value) : undefined)}>
          <option value="">All genres</option>
          {genres.map(genre => <option key={genre.id} value={genre.id}>{genre.name}</option>)}
        </select>
      </div>
      <button type="button" className="button-secondary" disabled={genreId === undefined}
        onClick={() => onGenreChange(undefined)}>Clear filter</button>
    </div>
    {loading ? <p className="muted" role="status">Loading genre filters...</p> : null}
    {error ? <div className="recommendation-filter__error" role="alert">
      <p>Genre filters are unavailable. {error}</p>
      <button type="button" onClick={() => { setLoading(true); setRetry(value => value + 1); }}>Retry filter options</button>
    </div> : null}
    {!loading && !error && genres.length === 0 ? <p role="status">No genres are available for filtering.</p> : null}
    <p className="muted" aria-live="polite">{resultSummary(meta, genreId !== undefined)}</p>
    {genreId !== undefined && meta.total === 0 ?
      <div className="recommendation-empty-state" role="status">
        <h3>No movies match this filter.</h3>
        <button type="button" onClick={() => onGenreChange(undefined)}>Show all movies</button>
      </div> : snapshot.movies.length > 0 ?
      <MovieGrid ariaLabel={ariaLabel} movies={snapshot.movies}
        showReasons={snapshot.personalised} returnTo={returnTo} /> : null}
    <PageControls meta={meta} />
  </div>;
}
