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
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}
