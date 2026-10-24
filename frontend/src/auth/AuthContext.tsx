import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { ApiError, getCurrentUser, login, logout } from "../api/auth.ts";
import {
  AuthContext,
  type AuthContextValue,
  type AuthState,
} from "./authState.ts";

const NAVIGATION_SCOPE_KEY = "movie-recommendation-navigation-scope";

type NavigationScope = { userId: string | null; id: string };

function newNavigationScope(userId: string | null): NavigationScope {
  return { userId, id: globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random()}` };
}

function readNavigationScope(): NavigationScope {
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(NAVIGATION_SCOPE_KEY) ?? "null");
    if (stored && typeof stored.id === "string" && stored.id.length <= 128 &&
      (stored.userId === null || typeof stored.userId === "string")) return stored;
  } catch { /* Session storage may be disabled; navigation still works in memory. */ }
  return newNavigationScope(null);
}

function saveNavigationScope(scope: NavigationScope) {
  try { window.sessionStorage.setItem(NAVIGATION_SCOPE_KEY, JSON.stringify(scope)); }
  catch { /* Session storage is only a navigation hint, never an auth source. */ }
}

// The provider is the single owner of account identity. Every guarded subtree is
// keyed by user.id (see RequireAuth), so clearing or replacing the user here is
// what discards account-scoped state in the browser.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "unknown" });
  const { pathname } = useLocation();
  const pendingCheck = useRef<Promise<void> | null>(null);
  const [recommendationVersion, setRecommendationVersion] = useState(0);
  const [navigationScope, setNavigationScope] = useState(readNavigationScope);
  const navigationScopeRef = useRef(navigationScope);
  const recommendationScope = navigationScope.id;
  const accountIdRef = useRef<string | null>(null);
  
  const sessionGeneration = useRef(0);

  const rotateNavigationScope = useCallback((userId: string | null) => {
    const next = newNavigationScope(userId);
    navigationScopeRef.current = next;
    saveNavigationScope(next);
    setNavigationScope(next);
  }, []);

  const refresh = useCallback(() => {
    if (pendingCheck.current) {
      return pendingCheck.current;
    }

    const generation = ++sessionGeneration.current;
    setState({ status: "checking" });
    const check = getCurrentUser()
      .then((user) => {
        if (generation === sessionGeneration.current) {
          if (navigationScopeRef.current.userId !== user.id)
            rotateNavigationScope(user.id);
          accountIdRef.current = user.id;
          setState({ status: "authenticated", user });
        }
      })
      .catch((error: unknown) => {
        if (generation !== sessionGeneration.current) return;
        if (error instanceof ApiError && error.status === 401) {
          if (navigationScopeRef.current.userId !== null)
            rotateNavigationScope(null);
          accountIdRef.current = null;
          setState({ status: "unauthenticated" });
          return;
        }
        setState({
          status: "error",
          message:
            error instanceof Error ? error.message : "Something went wrong",
        });
      })
      .finally(() => {
        if (generation === sessionGeneration.current)
          pendingCheck.current = null;
      });

    pendingCheck.current = check;
    return check;
  }, [rotateNavigationScope]);

  const signIn = useCallback(async (email: string, password: string) => {
    const generation = ++sessionGeneration.current;
    pendingCheck.current = null;
    const user = await login(email, password);
    if (generation === sessionGeneration.current) {
      rotateNavigationScope(user.id);
      accountIdRef.current = user.id;
      setState({ status: "authenticated", user });
    }
  }, [rotateNavigationScope]);

  const signOut = useCallback(async () => {
    const generation = ++sessionGeneration.current;
    pendingCheck.current = null;
    await logout();
    if (generation === sessionGeneration.current) {
      rotateNavigationScope(null);
      accountIdRef.current = null;
      setRecommendationVersion((version) => version + 1);
      setState({ status: "unauthenticated", justSignedOut: true });
    }
  }, [rotateNavigationScope]);

  const handleUnauthorized = useCallback(() => {
    sessionGeneration.current += 1;
    pendingCheck.current = null;
    rotateNavigationScope(null);
    accountIdRef.current = null;
    setState({ status: "unauthenticated" });
  }, [rotateNavigationScope]);

  // The guard sends a deliberate sign-out to "/"; once there, forget the flag so
  // returning to a guarded route redirects to /login.
  if (
    state.status === "unauthenticated" &&
    state.justSignedOut &&
    pathname === "/"
  ) {
    setState({ status: "unauthenticated" });
  }
  
  const invalidateRecommendations = useCallback((options?: { preserveNavigation?: boolean }) => {
    if (!options?.preserveNavigation) rotateNavigationScope(accountIdRef.current);
    setRecommendationVersion((version) => version + 1);
  }, [rotateNavigationScope]);

  const value = useMemo<AuthContextValue>(
  () => ({
    ...state,
    refresh,
    signIn,
    signOut,
    handleUnauthorized,
    recommendationVersion,
    recommendationScope,
    invalidateRecommendations,
  }),
  [
    state,
    refresh,
    signIn,
    signOut,
    handleUnauthorized,
    recommendationVersion,
    recommendationScope,
    invalidateRecommendations,
  ],
);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
