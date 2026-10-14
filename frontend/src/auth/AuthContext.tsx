import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { ApiError, getCurrentUser, login, logout } from "../api/auth.ts";
import {
  AuthContext,
  type AuthContextValue,
  type AuthState,
} from "./authState.ts";

// The provider is the single owner of account identity. Every guarded subtree is
// keyed by user.id (see RequireAuth), so clearing or replacing the user here is
// what discards account-scoped state in the browser.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "unknown" });
  const { pathname } = useLocation();
  const pendingCheck = useRef<Promise<void> | null>(null);
  const [recommendationVersion, setRecommendationVersion] = useState(0);
  
  const sessionGeneration = useRef(0);

  const refresh = useCallback(() => {
    if (pendingCheck.current) {
      return pendingCheck.current;
    }

    const generation = ++sessionGeneration.current;
    setState({ status: "checking" });
    const check = getCurrentUser()
      .then((user) => {
        if (generation === sessionGeneration.current)
          setState({ status: "authenticated", user });
      })
      .catch((error: unknown) => {
        if (generation !== sessionGeneration.current) return;
        if (error instanceof ApiError && error.status === 401) {
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
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const user = await login(email, password);
    sessionGeneration.current += 1;
    pendingCheck.current = null;
    setState({ status: "authenticated", user });
  }, []);

  const signOut = useCallback(async () => {
    await logout();
    sessionGeneration.current += 1;
    pendingCheck.current = null;
    setState({ status: "unauthenticated", justSignedOut: true });
  }, []);

  const handleUnauthorized = useCallback(() => {
    sessionGeneration.current += 1;
    pendingCheck.current = null;
    setState({ status: "unauthenticated" });
  }, []);

  // The guard sends a deliberate sign-out to "/"; once there, forget the flag so
  // returning to a guarded route redirects to /login.
  if (
    state.status === "unauthenticated" &&
    state.justSignedOut &&
    pathname === "/"
  ) {
    setState({ status: "unauthenticated" });
  }
  
  const invalidateRecommendations = useCallback(() => {
  setRecommendationVersion((version) => version + 1);
}, []);

  const value = useMemo<AuthContextValue>(
  () => ({
    ...state,
    refresh,
    signIn,
    signOut,
    handleUnauthorized,
    recommendationVersion,
    invalidateRecommendations,
  }),
  [
    state,
    refresh,
    signIn,
    signOut,
    handleUnauthorized,
    recommendationVersion,
    invalidateRecommendations,
  ],
);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
