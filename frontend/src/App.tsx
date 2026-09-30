import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";

import LoginPage from "./pages/LoginPage.tsx";
import RecommendationsPage from "./pages/RecommendationsPage.tsx";
import RegisterPage from "./pages/RegisterPage.tsx";

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
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/recommendations" element={<RecommendationsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
