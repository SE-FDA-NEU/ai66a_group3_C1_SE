import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { ApiError, getCurrentUser, login, logout } from "../api/auth.ts";
import { useFeedback } from "../feedback.ts";
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
  const feedback = useFeedback();
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
          if (accountIdRef.current && accountIdRef.current !== user.id) feedback.dismiss();
          if (navigationScopeRef.current.userId !== user.id)
            rotateNavigationScope(user.id);
          accountIdRef.current = user.id;
          setState({ status: "authenticated", user });
        }
      })
      .catch((error: unknown) => {
        if (generation !== sessionGeneration.current) return;
        if (error instanceof ApiError && error.status === 401) {
          if (accountIdRef.current) feedback.dismiss();
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
  }, [rotateNavigationScope, feedback]);

  const signIn = useCallback(async (email: string, password: string) => {
    const generation = ++sessionGeneration.current;
    pendingCheck.current = null;
    const notice = feedback.announce({ kind: "pending", title: "Signing you in…" });
    try {
      const user = await login(email, password);
      if (generation === sessionGeneration.current) {
        rotateNavigationScope(user.id);
        accountIdRef.current = user.id;
        setState({ status: "authenticated", user });
        feedback.update(notice, { kind: "success", title: "You're signed in", message: "Make yourself at home." });
      }
    } catch (error) {
      if (generation === sessionGeneration.current)
        feedback.update(notice, { kind: "error", title: "Sign-in not confirmed", message: "Check the form and try again." });
      throw error;
    }
  }, [rotateNavigationScope, feedback]);

  const signOut = useCallback(async () => {
    const generation = ++sessionGeneration.current;
    pendingCheck.current = null;
    const notice = feedback.announce({ kind: "pending", title: "Signing you out…" });
    try {
      await logout();
      if (generation === sessionGeneration.current) {
        rotateNavigationScope(null);
        accountIdRef.current = null;
        setRecommendationVersion((version) => version + 1);
        setState({ status: "unauthenticated", justSignedOut: true });
        feedback.update(notice, { kind: "success", title: "You're signed out", message: "Your saved taste stays with your account." });
      }
    } catch (error) {
      if (generation === sessionGeneration.current)
        feedback.update(notice, { kind: "error", title: "Sign-out not confirmed", message: "Please try signing out again." });
      throw error;
    }
  }, [rotateNavigationScope, feedback]);

  const handleUnauthorized = useCallback(() => {
    sessionGeneration.current += 1;
    pendingCheck.current = null;
    rotateNavigationScope(null);
    accountIdRef.current = null;
    setState({ status: "unauthenticated" });
    feedback.announce({ kind: "info", title: "Please sign in again", message: "Your session needs to be renewed." });
  }, [rotateNavigationScope, feedback]);

  // The guard sends a deliberate sign-out to "/"; once there, forget the flag so
  // returning to a guarded route redirects to /login.
  if (
    state.status === "unauthenticated" &&
    state.justSignedOut &&
    pathname === "/"
  ) {
    setState({ status: "unauthenticated" });
  }
  
  const invalidateRecommendations = useCallback(
    (options?: { keepNavigationContext?: boolean }) => {
      if (!options?.keepNavigationContext) rotateNavigationScope(accountIdRef.current);
      setRecommendationVersion((version) => version + 1);
    },
    [rotateNavigationScope],
  );

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
