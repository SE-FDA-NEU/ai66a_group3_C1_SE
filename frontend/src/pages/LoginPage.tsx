import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/authState.ts";
import { signInDestination, signInReturnState } from "../navigation/signInReturn.ts";

const INVALID_CREDENTIALS_MESSAGE = "Email or password is incorrect";

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(
  event: React.SyntheticEvent<HTMLFormElement, SubmitEvent>) {
  event.preventDefault();
    if (isSubmitting) return;
    setError("");

    if (!email.trim() || !password) {
      setError("Email and password are required");
      return;
    }

    setIsSubmitting(true);

    try {
      await signIn(email, password);
      navigate(signInDestination(location.state), { replace: true });
    } catch (error) {
      if (error instanceof Error && error.message) {
        setError(error.message);
      } else {
        setError(INVALID_CREDENTIALS_MESSAGE);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="page page--centered">
      <section className="auth-card" aria-labelledby="login-title">
        <p className="eyebrow">AI Movie Recommendation System</p>
        <h1 id="login-title">Sign in</h1>
        <p className="muted">Sign in to keep your movie preferences and ratings. Choose when to personalise your experience.</p>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="auth-footer">
          Need an account? <Link to="/register" state={signInReturnState(location.state)}>Create an account</Link>
        </p>
      </section>
    </main>
  );
}

export default LoginPage;
