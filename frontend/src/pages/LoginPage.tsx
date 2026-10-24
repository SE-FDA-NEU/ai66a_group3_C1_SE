import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/authState.ts";
import { signInDestination, signInReturnState } from "../navigation/signInReturn.ts";
import AuthLayout from "../components/AuthLayout.tsx";
import { useFeedback } from "../feedback.ts";

const INVALID_CREDENTIALS_MESSAGE = "Email or password is incorrect";

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();
  const feedback = useFeedback();
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
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
      feedback.announce({ kind: "error", title: "A couple of details are missing", message: "Enter your email and password." });
      return;
    }

    setIsSubmitting(true);

    try {
      await signIn(email, password);
      if (!mounted.current) return;
      navigate(signInDestination(location.state), { replace: true });
    } catch (error) {
      if (!mounted.current) return;
      if (error instanceof Error && error.message) {
        setError(error.message);
      } else {
        setError(INVALID_CREDENTIALS_MESSAGE);
      }
    } finally {
      if (mounted.current) setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout mode="sign-in">
        <p className="eyebrow">Welcome back</p>
        <h1 id="login-title">Sign in</h1>
        <p className="muted">Your taste. Right where you left it.</p>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
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
          Need an account? <Link className="button-link button-secondary" to="/register" state={signInReturnState(location.state)}>Create an account</Link>
        </p>
    </AuthLayout>
  );
}

export default LoginPage;
