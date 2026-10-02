import { useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../auth/authState.ts";

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

function RecommendationsPage() {
  const auth = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState("");
  const user = auth.status === "authenticated" ? auth.user : null;

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

      <section className="content-card recommendations-card" aria-labelledby="popular-title">
        <div className="section-heading">
          <p className="eyebrow">Your next watch</p>
          <h2 id="popular-title">Popular</h2>
        </div>
        <RecommendationState status="empty" />
      </section>
    </main>
  );
}

export default RecommendationsPage;
