import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import {
  getRecommendations,
  RecommendationApiError,
  type RecommendationResult,
} from "../api/recommendations.ts";
import { useAuth } from "../auth/authState.ts";
import MovieGrid from "../components/MovieGrid.tsx";
import { currentReturnPath } from "../navigation/movieDetailReturn.ts";

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
  const location = useLocation();
  const auth = useAuth();
  const { handleUnauthorized } = auth;
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState("");
  const [load, setLoad] = useState<RecommendationLoad>({ status: "loading" });
  const user = auth.status === "authenticated" ? auth.user : null;

  // The route is keyed by user.id (RequireAuth), so a new account remounts this
  // page and aborts the previous account's request through the cleanup below.
  useEffect(() => {
    const controller = new AbortController();

    getRecommendations(10, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setLoad({ status: "ready", result });
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
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

    return () => controller.abort();
  }, [handleUnauthorized]);

  const result = load.status === "ready" ? load.result : null;
  const sectionTitle = result
    ? result.personalised
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
          </div>
        ) : load.result.movies.length === 0 ? (
          <RecommendationState status="empty" />
        ) : (
          <MovieGrid
            ariaLabel={sectionTitle}
            movies={load.result.movies}
            showReasons={load.result.personalised}
            returnTo={currentReturnPath(location)}
          />
        )}
      </section>
    </main>
  );
}

export default RecommendationsPage;
