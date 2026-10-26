import { createContext, useContext } from "react";

import type { User } from "../api/auth.ts";

export type AuthState =
  | { status: "unknown" }
  | { status: "checking" }
  | { status: "authenticated"; user: User }
  // justSignedOut: the account just chose to leave, so guards send it home once.
  | { status: "unauthenticated"; justSignedOut?: boolean }
  | { status: "error"; message: string };

export type AuthContextValue = AuthState & {
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  // Call when a protected API answers 401: drops the account so guards redirect.
  handleUnauthorized: () => void;
  recommendationVersion: number;
  // Opaque navigation scope; changes with account or recommendation data.
  recommendationScope: string;
  // Advances the request generation so older rankings are discarded. By default it
  // also rotates the navigation scope, which drops saved page/filter/hash context
  // (preferences, reset, account change). A rating save changes only the ranking
  // of the same account, so it keeps that context.
  invalidateRecommendations: (options?: { keepNavigationContext?: boolean }) => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}
