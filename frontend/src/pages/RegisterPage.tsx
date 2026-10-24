import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { ApiError, register } from "../api/auth.ts";
import { signInReturnState } from "../navigation/signInReturn.ts";
import AuthLayout from "../components/AuthLayout.tsx";
import { useFeedback } from "../feedback.ts";

type FieldErrors = Partial<Record<"email" | "password", string>>;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRegistration(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!email.trim()) errors.email = "Email is required";
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = "Enter a valid email address";
  if (!password) errors.password = "Password is required";
  else if (password.length < 8) errors.password = "Password must be at least 8 characters";
  return errors;
}

function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const feedback = useFeedback();
  const mounted = useRef(false);
  const pendingNotice = useRef<number | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (pendingNotice.current !== null) feedback.dismiss(pendingNotice.current);
    };
  }, [feedback]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [requestError, setRequestError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const errors = validateRegistration(email, password);
    setFieldErrors(errors);
    setRequestError("");
    if (Object.keys(errors).length > 0) {
      feedback.announce({ kind: "error", title: "Check your details", message: "Please correct the highlighted fields." });
      return;
    }

    setIsSubmitting(true);
    const notice = feedback.announce({ kind: "pending", title: "Creating your account…" });
    pendingNotice.current = notice;
    try {
      await register(email.trim(), password);
      if (!mounted.current) return;
      feedback.update(notice, { kind: "success", title: "Account created", message: "You're ready to sign in." });
      pendingNotice.current = null;
      navigate("/login", { replace: true, state: signInReturnState(location.state) });
    } catch (error) {
      if (!mounted.current) return;
      feedback.update(notice, { kind: "error", title: "Account creation not confirmed", message: "Check the form before trying again." });
      pendingNotice.current = null;
      if (error instanceof ApiError && error.code === "EMAIL_ALREADY_REGISTERED") {
        setRequestError("This email is already registered");
      } else {
        setRequestError("Service is temporarily unavailable");
      }
    } finally {
      if (mounted.current) setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout mode="register">
        <p className="eyebrow">Your next chapter</p>
        <h1 id="register-title">Create your account</h1>
        <p className="muted">A place for your preferences and ratings.</p>

        {requestError ? <p className="form-error" role="alert">{requestError}</p> : null}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <label htmlFor="register-email">Email</label>
          <input
            id="register-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "register-email-error" : undefined}
          />
          {fieldErrors.email ? <p id="register-email-error" className="form-error">{fieldErrors.email}</p> : null}

          <label htmlFor="register-password">Password</label>
          <input
            id="register-password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? "register-password-error" : undefined}
          />
          {fieldErrors.password ? <p id="register-password-error" className="form-error">{fieldErrors.password}</p> : null}
          <p className="field-hint">Use at least 8 characters.</p>

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="auth-footer">Already have an account? <Link to="/login" state={signInReturnState(location.state)}>Sign in</Link></p>
    </AuthLayout>
  );
}

export default RegisterPage;
