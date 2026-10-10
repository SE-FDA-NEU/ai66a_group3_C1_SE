import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import type { Genre } from "../api/movies.ts";
import {
  getPreferences,
  listGenres,
  PreferenceApiError,
} from "../api/preferences.ts";
import { useAuth } from "../auth/authState.ts";

const MAX_GENRES = 5;
const LIMIT_MESSAGE =
  "You can select up to 5 genres. Your previous 5 selections are still selected.";

function PreferencesPage() {
  const { handleUnauthorized } = useAuth();
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [limitError, setLimitError] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      listGenres(controller.signal),
      getPreferences(controller.signal),
    ])
      .then(([availableGenres, savedGenres]) => {
        const availableIds = new Set(availableGenres.map((genre) => genre.id));

        setGenres(availableGenres);
        setSelectedIds(
          new Set(
            savedGenres
              .map((genre) => genre.id)
              .filter((genreId) => availableIds.has(genreId)),
          ),
        );
        setLimitError("");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        if (error instanceof PreferenceApiError && error.status === 401) {
          handleUnauthorized();
          return;
        }

        setError(error instanceof Error ? error.message : "Something went wrong");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [handleUnauthorized, reloadVersion]);

  function handleRetry() {
    setIsLoading(true);
    setError("");
    setReloadVersion((value) => value + 1);
  }

  function handleGenreChange(genreId: number, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (!checked) {
        next.delete(genreId);
        setLimitError("");
        return next;
      }

      if (current.size >= MAX_GENRES) {
        setLimitError(LIMIT_MESSAGE);
        return current;
      }

      next.add(genreId);
      setLimitError("");
      return next;
    });
  }

  return (
    <main className="page page--centered">
      <section
        className="content-card preferences-card"
        aria-labelledby="preferences-title"
      >
        <p className="eyebrow">AI Movie Recommendation System</p>
        <h1 id="preferences-title">Movie Preferences</h1>
        <p className="muted" id="genre-selection-help">
          Choose up to 5 favourite genres from the active movie catalogue.
        </p>

        {isLoading ? (
          <p className="preference-status" role="status">
            Loading genres...
          </p>
        ) : error ? (
          <div className="preference-status" role="alert">
            <h2>Genres are unavailable</h2>
            <p>{error}</p>
            <button type="button" onClick={handleRetry}>
              Retry
            </button>
          </div>
        ) : genres.length === 0 ? (
          <div className="preference-status">
            <h2>No genres available</h2>
            <p className="muted">
              The active catalogue does not contain any genres yet.
            </p>
            <Link className="text-link" to="/">
              Return to catalogue
            </Link>
          </div>
        ) : (
          <fieldset
            className="genre-picker"
            aria-describedby="genre-selection-help genre-selection-count"
          >
            <legend>Favourite genres</legend>
            <p id="genre-selection-count" className="selection-count" aria-live="polite">
              {selectedIds.size} of {MAX_GENRES} selected
            </p>
            <div className="genre-options">
              {genres.map((genre) => (
                <label className="genre-option" key={genre.id}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(genre.id)}
                    onChange={(event) =>
                      handleGenreChange(genre.id, event.currentTarget.checked)
                    }
                  />
                  <span>{genre.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {limitError ? (
          <p className="form-error preference-limit" role="alert">
            {limitError}
          </p>
        ) : null}
      </section>
    </main>
  );
}

export default PreferencesPage;
