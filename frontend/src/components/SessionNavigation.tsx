import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/authState.ts";

export default function SessionNavigation({ currentPage, showRecommendationsLink = true }: {
  currentPage?: "recommendations";
  showRecommendationsLink?: boolean;
}) {
  const auth = useAuth();
  const { status, refresh } = auth;
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (status === "unknown") void refresh();
  }, [status, refresh]);

  async function signOut() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await auth.signOut();
      navigate("/", { replace: true });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to sign out");
    } finally {
      setBusy(false);
    }
  }

  return <div className="session-actions">
    {auth.status === "unknown" || auth.status === "checking" ?
      <span role="status">Checking session...</span> : null}
    {auth.status === "error" ? <span role="alert">Unable to check your session. <button type="button" onClick={() => void auth.refresh()}>Retry</button></span> : null}
    {auth.status === "unauthenticated" ? <>
      <Link className="button-link" to="/login">Sign in</Link>
      <Link className="button-link button-secondary" to="/register">Create account</Link>
    </> : null}
    {auth.status === "authenticated" ? <>
      <span className="muted">{auth.user.email}</span>
      {showRecommendationsLink && currentPage !== "recommendations" ? <Link className="button-link button-secondary" to="/recommendations">My recommendations</Link> : null}
      <button type="button" className="button-secondary" disabled={busy} onClick={() => void signOut()}>{busy ? "Signing out..." : "Sign out"}</button>
    </> : null}
    {error ? <span role="alert">{error}</span> : null}
  </div>;
}
