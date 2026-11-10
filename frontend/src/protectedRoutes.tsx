import type { ReactElement } from "react";

import ProfilePage from "./pages/ProfilePage.tsx";
import PreferencesPage from "./pages/PreferencesPage.tsx";
import RecommendationsPage from "./pages/RecommendationsPage.tsx";
import WatchlistPage from "./pages/WatchlistPage.tsx";

// Central registry of routes that require a signed-in account. App wraps every
// entry in RequireAuth; public routes (catalogue, movie detail, explanation,
// login, register) must not be listed here.
export const PROTECTED_ROUTES: { path: string; element: ReactElement }[] = [
  { path: "/recommendations", element: <RecommendationsPage /> },
  { path: "/preferences", element: <PreferencesPage /> },
  { path: "/profile", element: <ProfilePage /> },
  { path: "/watchlist", element: <WatchlistPage /> },
];
