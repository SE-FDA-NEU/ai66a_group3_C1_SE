import { Fragment, useEffect, useRef, type ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";

import { useAuth } from "./authState.ts";
import { useFeedback } from "../feedback.ts";

function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  const needsCheck = auth.status === "unknown";
  const { refresh } = auth;
  const feedback = useFeedback();
  const notifiedLocation = useRef<string | null>(null);

  useEffect(() => {
    if (needsCheck) {
      void refresh();
    }
  }, [needsCheck, refresh]);

  useEffect(() => {
    if (auth.status !== "unauthenticated" || auth.justSignedOut || notifiedLocation.current === location.key) return;
    notifiedLocation.current = location.key;
    feedback.announce({ kind: "info", title: "Sign in to continue",
      message: location.pathname === "/preferences" ? "Your movie preferences belong to your account." :
        location.pathname === "/watchlist" ? "Your watchlist belongs to your account." :
        "Sign in to see your own recommendations." });
  }, [auth, location.key, location.pathname, feedback]);

  if (auth.status === "unauthenticated") {
    return <Navigate to={auth.justSignedOut ? "/" : "/login"} replace
      state={auth.justSignedOut ? undefined : {
        signInReturnTo: `${location.pathname}${location.search}${location.hash}`,
      }} />;
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
