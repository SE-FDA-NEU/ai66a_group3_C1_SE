import { useState } from "react";

import { useAuth } from "../auth/authState.ts";

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

      <section className="content-card">
        <h2>Your recommendations</h2>
        <p className="muted">
          Recommendation content will be connected when its API is available.
        </p>
      </section>
    </main>
  );
}

export default RecommendationsPage;
