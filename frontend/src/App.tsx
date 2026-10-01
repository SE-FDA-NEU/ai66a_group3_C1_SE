import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import RecommendationExplanationPage from "./RecommendationExplanationPage.tsx";
import HomePage from "./pages/HomePage.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import MovieDetailPage from "./pages/MovieDetailPage.tsx";
import RecommendationsPage from "./pages/RecommendationsPage.tsx";
import RegisterPage from "./pages/RegisterPage.tsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/about-recommendations"
          element={<RecommendationExplanationPage />}
        />
        <Route path="/movies/:movieId" element={<MovieDetailPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/recommendations" element={<RecommendationsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
