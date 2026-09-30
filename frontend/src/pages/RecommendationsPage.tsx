import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError, getCurrentUser, logout, type User } from "../api/auth.ts";

function RecommendationsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const currentUser = await getCurrentUser();
        if (active) {
          setUser(currentUser);
        }
      } catch (error) {
        if (!active) {
          return;
        }

        if (error instanceof ApiError && error.status === 401) {
          navigate("/login", { replace: true });
          return;
        }

        setError(error instanceof Error ? error.message : "Something went wrong");
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadSession();

    return () => {
      active = false;
    };
  }, [navigate]);

  async function handleSignOut() {
    setError("");
    setIsSigningOut(true);

    try {
      await logout();
      navigate("/", { replace: true });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Something went wrong");
      setIsSigningOut(false);
    }
  }

  if (isLoading) {
    return <main className="page page--centered">Checking session...</main>;
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
