import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider } from "./auth/AuthContext.tsx";
import RequireAuth from "./auth/RequireAuth.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import RegisterPage from "./pages/RegisterPage.tsx";
import { PROTECTED_ROUTES } from "./protectedRoutes.tsx";

function HomePage() {
  return (
    <main className="page page--centered">
      <section className="content-card">
        <p className="eyebrow">AI Movie Recommendation System</p>
        <h1>Find your next movie</h1>
        <p className="muted">Sign in to access your recommendations.</p>
        <div className="home-actions">
          <Link className="button-link" to="/login">
            Sign in
          </Link>
          <Link className="button-link button-secondary" to="/register">
            Create account
          </Link>
        </div>
      </section>
    </main>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          {PROTECTED_ROUTES.map(({ path, element }) => (
            <Route key={path} path={path} element={<RequireAuth>{element}</RequireAuth>} />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
