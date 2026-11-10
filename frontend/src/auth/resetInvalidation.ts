import type { AuthContextValue } from "./authState.ts";

// Profile, Preferences and Rating have route-local snapshots. A confirmed reset
// discards Profile's current summary at the call site; leaving the route unmounts
// it, and the existing clients refetch Preferences and Rating when reopened.
// Recommendations additionally retain navigation/result context, so advance
// their shared request generation and rotate the account's navigation scope.
export function invalidatePersonalisationAfterReset(
  auth: AuthContextValue,
  accountId: string,
): void {
  if (auth.status !== "authenticated" || auth.user.id !== accountId) return;
  auth.invalidateRecommendations();
}
