import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import {
  getRecommendations,
  RecommendationApiError,
  type RecommendationResult,
} from "../api/recommendations.ts";
import { useAuth } from "../auth/authState.ts";
import MovieGrid from "../components/MovieGrid.tsx";

const RECOMMENDATION_LIMIT = 10;

type RecommendationStateProps = {
  status: "loading" | "empty";
};

export function RecommendationState({ status }: RecommendationStateProps) {
  if (status === "loading") {
    return <p role="status">Loading recommendations...</p>;
  }

  return (
    <div className="recommendation-empty-state" role="status">
      <h3>No recommendations available yet.</h3>
      <p>Enter your preferences to get personalised recommendations.</p>
      <Link className="text-link" to="/preferences">
        Enter preferences &rarr;
      </Link>
    </div>
  );
}

type RecommendationLoad =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; result: RecommendationResult };

function RecommendationsPage() {
  const auth = useAuth();
  const { handleUnauthorized } = auth;
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState("");
  const [load, setLoad] = useState<RecommendationLoad>({ status: "loading" });
  const [reloadVersion, setReloadVersion] = useState(0);
  const requestGenerationRef = useRef(0);
  const user = auth.status === "authenticated" ? auth.user : null;
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) {
      return;
    }

    const controller = new AbortController();
    const requestGeneration = ++requestGenerationRef.current;
    let isActive = true;
    const isCurrentRequest = () =>
      isActive &&
      !controller.signal.aborted &&
      requestGenerationRef.current === requestGeneration;

    getRecommendations(RECOMMENDATION_LIMIT, controller.signal)
      .then((result) => {
        if (isCurrentRequest()) {
          setLoad({ status: "ready", result });
        }
      })
      .catch((error: unknown) => {
        if (!isCurrentRequest()) {
          return;
        }

        if (error instanceof RecommendationApiError && error.status === 401) {
          handleUnauthorized();
          return;
        }

        setLoad({
          status: "error",
          message: error instanceof Error ? error.message : "Something went wrong",
        });
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [handleUnauthorized, reloadVersion, userId]);

  function handleRetry() {
    setLoad({ status: "loading" });
    setReloadVersion((version) => version + 1);
  }

  const result = load.status === "ready" ? load.result : null;
  const sectionTitle = result
    ? result.noMatch
      ? "Popular alternatives"
      : result.personalised
      ? "Recommended for you"
      : "Popular"
    : "Your recommendations";

  async function handleSignOut() {
    setError("");
    setIsSigningOut(true);

    try {
      await auth.signOut();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Something went wrong");
      setIsSigningOut(false);
    }
  }

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <p className="eyebrow">AI Movie Recommendation System</p>
          <h1>Recommendations</h1>
        </div>

        <div className="session-actions">
          {user ? <span className="muted">{user.email}</span> : null}
          <button
            type="button"
            className="button-secondary"
            onClick={handleSignOut}
            disabled={isSigningOut}
          >
            {isSigningOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </header>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <section
        className="content-card recommendations-card"
        aria-labelledby="recommendations-title"
      >
        <div className="section-heading">
          <p className="eyebrow">Your next watch</p>
          <h2 id="recommendations-title">{sectionTitle}</h2>
          {result && result.mode === "popular" ? (
            <p className="muted recommendation-mode">Not personalised</p>
          ) : null}
        </div>
        {load.status === "loading" ? (
          <RecommendationState status="loading" />
        ) : load.status === "error" ? (
          <div className="recommendation-empty-state" role="alert">
            <h3>Recommendations are unavailable</h3>
            <p>{load.message}</p>
            <button type="button" onClick={handleRetry}>
              Retry
            </button>
          </div>
        ) : load.result.noMatch ? (
          <>
            <div className="recommendation-empty-state" role="status">
              <h3>No movies matched your favourite genres.</h3>
              <p>
                {load.result.movies.length > 0
                  ? "Try these popular alternatives, edit your preferences, or retry."
                  : "Edit your preferences or retry to look for recommendations again."}
              </p>
              <div className="recommendation-actions">
                <Link className="text-link" to="/preferences">
                  Edit preferences
                </Link>
                <button type="button" onClick={handleRetry}>
                  Retry
                </button>
              </div>
            </div>
            {load.result.movies.length > 0 ? (
              <MovieGrid
                ariaLabel="Popular alternatives"
                movies={load.result.movies}
                showReasons={false}
              />
            ) : null}
          </>
        ) : load.result.movies.length === 0 ? (
          <RecommendationState status="empty" />
        ) : (
          <MovieGrid
            ariaLabel={sectionTitle}
            movies={load.result.movies}
            showReasons={load.result.personalised}
          />
        )}
      </section>
    </main>
  );
}

export default RecommendationsPage;
