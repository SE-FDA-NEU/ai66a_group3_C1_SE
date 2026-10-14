import { Fragment, useEffect, type ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";

import { useAuth } from "./authState.ts";

function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const needsCheck = auth.status === "unknown";
  const { refresh } = auth;

  useEffect(() => {
    if (needsCheck) {
      void refresh();
    }
  }, [needsCheck, refresh]);

  if (auth.status === "unauthenticated") {
    return <Navigate to={auth.justSignedOut ? "/" : "/login"} replace />;
  }

  if (auth.status === "error") {
    return (
      <main className="page page--centered">
        <section className="content-card" role="alert">
          <h1>We couldn't check your session</h1>
          <p id="session-error-message">
            {auth.message} Choose Retry to check again.
          </p>
          <div className="detail-actions">
            <button
              type="button"
              onClick={() => void refresh()}
              aria-describedby="session-error-message"
            >
              Retry
            </button>
            <Link className="button-link button-secondary" to="/">
              Browse the catalogue
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (auth.status !== "authenticated") {
    return <main className="page page--centered">Checking session...</main>;
  }

  // Keying by account id remounts the subtree when the account changes, so no
  // component state from a previous account survives.
  return <Fragment key={auth.user.id}>{children}</Fragment>;
}

export default RequireAuth;
