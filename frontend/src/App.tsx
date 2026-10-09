import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import RecommendationExplanationPage from "./RecommendationExplanationPage.tsx";
import { AuthProvider } from "./auth/AuthContext.tsx";
import RequireAuth from "./auth/RequireAuth.tsx";
import HomePage from "./pages/HomePage.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import MovieDetailPage from "./pages/MovieDetailPage.tsx";
import PopularMoviesPage from "./pages/PopularMoviesPage.tsx";
import RegisterPage from "./pages/RegisterPage.tsx";
import { PROTECTED_ROUTES } from "./protectedRoutes.tsx";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/about-recommendations"
            element={<RecommendationExplanationPage />}
          />
          <Route path="/popular" element={<PopularMoviesPage />} />
          <Route path="/movies/:movieId" element={<MovieDetailPage />} />
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
