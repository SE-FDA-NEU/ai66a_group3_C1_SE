import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { getProfile, resetProfile, ProfileApiError, type ProfileSummary } from "../api/profile.ts";
import { useAuth } from "../auth/authState.ts";
import { invalidatePersonalisationAfterReset } from "../auth/resetInvalidation.ts";
import ConfirmDialog from "../components/ConfirmDialog.tsx";
import { useFeedback } from "../feedback.ts";

const SUCCESS = "Your personalisation profile was reset.";
type ResetState = "idle" | "pending" | "success" | "rejected" | "reconciling" | "unconfirmed" | "reconciled";

export default function ProfilePage() {
  const auth = useAuth();
  return auth.status === "authenticated" ?
    <AccountProfile key={auth.user.id} accountId={auth.user.id} email={auth.user.email} /> : null;
}

function AccountProfile({ accountId, email }: { accountId: string; email: string }) {
  const auth = useAuth();
  const { handleUnauthorized } = auth;
  const feedback = useFeedback();
  const [summary, setSummary] = useState<ProfileSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState("");
  const [resetState, setResetState] = useState<ResetState>("idle");
  const [resetError, setResetError] = useState("");
  const [dialog, setDialog] = useState(false);
  const mounted = useRef(false);
  const generation = useRef(0);
  const busy = useRef(false);
  const readController = useRef<AbortController | null>(null);
  const writeController = useRef<AbortController | null>(null);
  const pendingNotice = useRef<number | null>(null);
  const summaryHeading = useRef<HTMLHeadingElement>(null);

  const read = useCallback(async (reconcile = false) => {
    const attempt = ++generation.current;
    readController.current?.abort();
    const controller = new AbortController();
    readController.current = controller;
    setLoading(true);
    setReadError("");
    if (reconcile) setResetState("reconciling");
    try {
      const result = await getProfile(controller.signal);
      if (!mounted.current || controller.signal.aborted || attempt !== generation.current) return;
      setSummary(result);
      if (reconcile) setResetState("reconciled");
    } catch (error) {
      if (!mounted.current || controller.signal.aborted || attempt !== generation.current) return;
      if (error instanceof ProfileApiError && error.status === 401) {
        handleUnauthorized();
        return;
      }
      setReadError(error instanceof Error ? error.message : "Profile unavailable. Please refresh.");
      if (reconcile) setResetState("unconfirmed");
    } finally {
      if (mounted.current && !controller.signal.aborted && attempt === generation.current) setLoading(false);
    }
  }, [handleUnauthorized]);

  useEffect(() => {
    mounted.current = true;
    const attempt = ++generation.current;
    const controller = new AbortController();
    readController.current = controller;
    // The first render already represents loading. Subsequent state updates
    // belong to the request callbacks, not the synchronous effect body.
    getProfile(controller.signal).then(result => {
      if (controller.signal.aborted || attempt !== generation.current) return;
      setSummary(result);
    }).catch(error => {
      if (controller.signal.aborted || attempt !== generation.current) return;
      if (error instanceof ProfileApiError && error.status === 401) handleUnauthorized();
      else setReadError(error instanceof Error ? error.message : "Profile unavailable. Please refresh.");
    }).finally(() => {
      if (!controller.signal.aborted && attempt === generation.current) setLoading(false);
    });
    return () => {
      mounted.current = false;
      generation.current += 1;
      readController.current?.abort();
      writeController.current?.abort();
      if (pendingNotice.current !== null) feedback.dismiss(pendingNotice.current);
    };
  }, [handleUnauthorized, feedback]);

  async function confirmReset() {
    if (busy.current || loading || !summary) return;
    busy.current = true;
    const attempt = ++generation.current;
    readController.current?.abort();
    const controller = new AbortController();
    writeController.current = controller;
    setResetState("pending");
    setResetError("");
    const notice = feedback.announce({ kind: "pending", title: "Resetting personalisation…" });
    pendingNotice.current = notice;
    let reconcile = false;
    let acknowledged = false;
    try {
      await resetProfile(controller.signal);
      if (!mounted.current || controller.signal.aborted || attempt !== generation.current) return;
      acknowledged = true;
      invalidatePersonalisationAfterReset(auth, accountId);
      // The prior summary cannot be shown as current after a committed reset.
      // The existing profile client provides the fresh summary below.
      setSummary(null);
      setResetState("success");
      setDialog(false);
      feedback.update(notice, { kind: "success", title: SUCCESS });
    } catch (error) {
      if (!mounted.current || controller.signal.aborted || attempt !== generation.current) return;
      if (error instanceof ProfileApiError && error.status === 401) {
        feedback.dismiss(notice);
        handleUnauthorized();
        return;
      }
      setDialog(false);
      if (error instanceof ProfileApiError && error.outcome === "rejected") {
        setResetState("rejected");
        setResetError(error.message);
        feedback.update(notice, { kind: "error", title: "Reset was not completed", message: error.message });
      } else {
        reconcile = true;
        setResetState("reconciling");
        feedback.update(notice, { kind: "info", title: "Reset result not confirmed", message: "Checking your current profile before another attempt." });
      }
    } finally {
      if (mounted.current && !controller.signal.aborted && attempt === generation.current) {
        busy.current = false;
        pendingNotice.current = null;
      }
    }
    if (!mounted.current || controller.signal.aborted || attempt !== generation.current) return;
    // No second POST: a fresh GET reconciles uncertain writes. A read failure
    // after an acknowledged success cannot turn that success into a failure.
    if (reconcile) await read(true);
    else if (acknowledged) await read();
    if (mounted.current) summaryHeading.current?.focus();
  }

  const uncertain = resetState === "reconciling" || resetState === "unconfirmed" || resetState === "reconciled";
  const pending = resetState === "pending";
  const canReset = !!summary && !loading && !readError && !pending && resetState !== "unconfirmed" && resetState !== "reconciling";
  return <main className="page profile-page">
    <header className="profile-heading">
      <p className="eyebrow">YOUR MOVIE TASTE</p>
      <h1>Your profile</h1>
      <p className="muted">{email}</p>
    </header>
    <section className="content-card profile-summary" aria-labelledby="profile-summary-title" aria-busy={loading}>
      <div className="profile-section-heading"><h2 id="profile-summary-title" ref={summaryHeading} tabIndex={-1}>Your saved taste</h2>
        <span className="profile-label">Private to your account</span></div>
      {loading ? <p role="status">{resetState === "reconciling" ? "Checking your current profile…" : "Loading your profile…"}</p> : null}
      {readError ? <div className="profile-message profile-message--error" role="alert">
        <h3>Profile unavailable</h3><p>{readError}</p>
        {summary ? <p>The summary below was last confirmed before this read failed.</p> : null}
        <button type="button" className="button-secondary" disabled={loading || pending}
          onClick={() => void read(uncertain)}>Refresh profile</button>
      </div> : null}
      {summary ? <>
        <h3>Favourite genres</h3>
        {summary.genres.length ? <ul className="profile-genres" aria-label="Saved genres">
          {summary.genres.map(genre => <li key={genre.id}>{genre.name}</li>)}
        </ul> : <p className="muted">No saved genres yet.</p>}
        <dl className="profile-stats">
          <div><dt>Saved genres</dt><dd data-testid="profile-genres-count">{summary.genres.length}</dd></div>
          <div><dt>Ratings</dt><dd data-testid="profile-ratings-count">{summary.ratingCount}</dd></div>
          <div><dt>Watchlist movies</dt><dd data-testid="profile-watchlist-count">{summary.watchlistCount}</dd></div>
        </dl>
      </> : null}
      <div className="detail-actions">
        <Link className="button-link button-secondary" to="/preferences">Change my genres</Link>
        <Link className="button-link button-secondary" to="/recommendations">My recommendations</Link>
        <Link className="button-link button-secondary" to="/watchlist">View watchlist</Link>
      </div>
    </section>
    <section className="content-card profile-reset" aria-labelledby="profile-reset-title">
      <div><p className="eyebrow">A FRESH START</p><h2 id="profile-reset-title">Reset personalisation</h2>
        <p>Clear your saved genres and ratings. Your account and watchlist stay with you.</p></div>
      {resetState === "success" ? <p className="profile-message profile-message--success" role="status">{SUCCESS}</p> : null}
      {resetState === "rejected" ? <div className="profile-message profile-message--error" role="alert">
        <p>Reset was not completed. {resetError}</p><p>Your displayed profile has not been cleared. You can confirm a new attempt.</p>
      </div> : null}
      {uncertain ? <div className="profile-message" role="status">
        <h3>Reset result not confirmed</h3>
        <p>We couldn't confirm whether the reset completed.</p>
        <p>{resetState === "reconciled" ? "The summary shows your current server data. Review it before confirming another reset." :
          "Refresh your profile before trying another reset. Previously shown data may have changed."}</p>
        {resetState === "unconfirmed" ? <button type="button" className="button-secondary" onClick={() => void read(true)}>Check current profile</button> : null}
      </div> : null}
      <button type="button" disabled={!canReset} onClick={() => setDialog(true)}>Reset personalisation</button>
    </section>
    <ConfirmDialog open={dialog} title="Reset your personalisation?" confirmLabel="Reset personalisation" pending={pending}
      onCancel={() => { if (!busy.current) setDialog(false); }} onConfirm={() => void confirmReset()}>
      <p>This clears your saved genres and ratings.</p><p>Your account and watchlist will be kept.</p>
    </ConfirmDialog>
  </main>;
}
