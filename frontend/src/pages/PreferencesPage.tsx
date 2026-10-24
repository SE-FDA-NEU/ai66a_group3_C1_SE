import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import type { Genre } from "../api/movies.ts";
import {
  getPreferences,
  listGenres,
  PreferenceApiError,
  savePreferences,
} from "../api/preferences.ts";
import { useAuth } from "../auth/authState.ts";

const MAX_GENRES = 5;
const LIMIT_MESSAGE =
  "You can select up to 5 genres. Your previous 5 selections are still selected. Clear one genre to choose a different one.";
const SELECTION_REQUIRED_MESSAGE =
  "Select at least one genre (up to 5), then choose Save preferences.";

function PreferencesPage() {
  const {
    handleUnauthorized,
    invalidateRecommendations,
  } = useAuth();
  const navigate = useNavigate();

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [genres, setGenres] = useState<Genre[]>([]);
  const [unavailableSavedGenres, setUnavailableSavedGenres] = useState<Genre[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [limitError, setLimitError] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);

  const saveControllerRef = useRef<AbortController | null>(null);
  const saveRequestIdRef = useRef(0);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      saveRequestIdRef.current += 1;
      saveControllerRef.current?.abort();
      saveControllerRef.current = null;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      listGenres(controller.signal),
      getPreferences(controller.signal),
    ])
      .then(([availableGenres, savedGenres]) => {
        if (controller.signal.aborted) {
          return;
        }

        const availableIds = new Set(availableGenres.map((genre) => genre.id));

        setGenres(availableGenres);
        setUnavailableSavedGenres(
          savedGenres.filter((genre) => !availableIds.has(genre.id)),
        );
        setSelectedIds(new Set(savedGenres.map((genre) => genre.id)));
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
    setSaveError("");
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

  async function handleSave() {
    if (isSaving) return;

    if (selectedIds.size < 1 || selectedIds.size > MAX_GENRES) {
      setSaveError(SELECTION_REQUIRED_MESSAGE);
      return;
    }

    saveControllerRef.current?.abort();

    const controller = new AbortController();
    const requestId = ++saveRequestIdRef.current;

    saveControllerRef.current = controller;

    const isCurrentRequest = () =>
      isMountedRef.current &&
      !controller.signal.aborted &&
      saveRequestIdRef.current === requestId;

    setSaveError("");
    setIsSaving(true);

    try {
      await savePreferences(
        Array.from(selectedIds).sort((a, b) => a - b),
        controller.signal,
      );

      if (!isCurrentRequest()) return;

      invalidateRecommendations();
      navigate("/recommendations");
    } catch (error: unknown) {
      if (!isCurrentRequest()) return;

      if (
        error instanceof PreferenceApiError &&
        error.status === 401
      ) {
        handleUnauthorized();
        return;
      }

      setSaveError(
        `${
          error instanceof Error
            ? error.message
            : "Your preferences could not be saved."
        } Your selections are kept. Choose Save preferences to try again.`,
      );
    } finally {
      if (isCurrentRequest()) {
        setIsSaving(false);
        saveControllerRef.current = null;
      }
    }
  }
  return (
    <main className="page page--centered">
      <section
        className="content-card preferences-card"
        aria-labelledby="preferences-title"
      >
        <nav className="page-nav" aria-label="Preference navigation">
          <Link className="text-link" to="/recommendations">
            Back to recommendations
          </Link>
          <Link className="text-link" to="/">
            Browse the catalogue
          </Link>
        </nav>
        <p className="eyebrow">Your taste, your choice</p>
        <h1 id="preferences-title">Movie Preferences</h1>
        <p className="muted" id="genre-selection-help">
          Choose 1 to 5 favourite genres from the active movie catalogue, then
          choose Save preferences. Once you have 5, clear one to pick a
          different genre.
        </p>

        {isLoading ? (
          <p className="preference-status" role="status">
            Loading genres...
          </p>
        ) : error ? (
          <div className="preference-status" role="alert">
            <h2 id="preference-load-error-title">Genres are unavailable</h2>
            <p id="preference-load-error-message">
              {error} Choose Retry to load the genres again.
            </p>
            <button
              type="button"
              onClick={handleRetry}
              aria-describedby="preference-load-error-title preference-load-error-message"
            >
              Retry
            </button>
          </div>
        ) : genres.length === 0 && unavailableSavedGenres.length === 0 ? (
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
            aria-describedby={
              saveError
                ? "genre-selection-help genre-selection-count preference-save-error"
                : "genre-selection-help genre-selection-count"
            }
          >
            <legend>Favourite genres</legend>
            <p id="genre-selection-count" className="selection-count" aria-live="polite">
              {selectedIds.size} of {MAX_GENRES} selected
            </p>
            {genres.length > 0 ? (
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
                    <span className="genre-option__name">{genre.name}</span>
                    <span className="genre-option__state" aria-hidden="true">{selectedIds.has(genre.id) ? "✓" : "+"}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="preference-status preference-status--compact">
                <h2>No active genres available</h2>
                <p className="muted">
                  You can still review saved genres that are no longer in the
                  active catalogue.
                </p>
              </div>
            )}

            {unavailableSavedGenres.length > 0 ? (
              <section
                className="unavailable-genres"
                aria-labelledby="unavailable-genres-title"
              >
                <h2 id="unavailable-genres-title">Saved but unavailable</h2>
                <p className="muted">
                  These saved genres are not in the active catalogue. They remain
                  selected and count toward the 5-genre limit; clear one only if
                  you want to remove it from this draft.
                </p>
                <div className="genre-options">
                  {unavailableSavedGenres.map((genre) => (
                    <label
                      className="genre-option genre-option--unavailable"
                      key={genre.id}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(genre.id)}
                        onChange={(event) =>
                          handleGenreChange(genre.id, event.currentTarget.checked)
                        }
                      />
                      <span>{genre.name} (saved, unavailable)</span>
                    </label>
                  ))}
                </div>
              </section>
            ) : null}
          </fieldset>
        )}

        {limitError ? (
          <p className="form-error preference-limit" role="alert">
            {limitError}
          </p>
        ) : null}
        {saveError ? (
          <p
            id="preference-save-error"
            className="form-error preference-save-error"
            role="alert"
          >
            {saveError}
          </p>
        ) : null}
        {!isLoading && !error ? (
          <div className="preference-actions">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save preferences"}
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}

export default PreferencesPage;
