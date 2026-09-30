import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ApiError, register } from "../api/auth.ts";

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
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      await register(email.trim(), password);
      navigate("/login", { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.code === "EMAIL_ALREADY_REGISTERED") {
        setRequestError("This email is already registered");
      } else if (error instanceof Error) {
        setRequestError(error.message);
      } else {
        setRequestError("Service is temporarily unavailable");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="page page--centered registration-page">
      <section className="auth-card" aria-labelledby="register-title">
        <p className="eyebrow">AI Movie Recommendation System</p>
        <h1 id="register-title">Create your account</h1>
        <p className="muted">Save your movie preferences and get recommendations made for you.</p>

        {requestError ? <p className="form-error" role="alert">{requestError}</p> : null}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <label htmlFor="register-email">Email</label>
          <input
            id="register-email"
            name="email"
            type="email"
            autoComplete="email"
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

        <p className="auth-footer">Already have an account? <Link to="/login">Sign in</Link></p>
      </section>
    </main>
  );
}

export default RegisterPage;
