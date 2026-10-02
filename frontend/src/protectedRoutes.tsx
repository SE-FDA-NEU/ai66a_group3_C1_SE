import type { ReactElement } from "react";

import ProtectedPlaceholderPage from "./pages/ProtectedPlaceholderPage.tsx";
import PreferencesPage from "./pages/PreferencesPage.tsx";
import RecommendationsPage from "./pages/RecommendationsPage.tsx";

// Central registry of routes that require a signed-in account. App wraps every
// entry in RequireAuth; public routes (catalogue, movie detail, explanation,
// login, register) must not be listed here.
export const PROTECTED_ROUTES: { path: string; element: ReactElement }[] = [
  { path: "/recommendations", element: <RecommendationsPage /> },
  { path: "/preferences", element: <PreferencesPage /> },
  { path: "/profile", element: <ProtectedPlaceholderPage title="Profile" /> },
];
