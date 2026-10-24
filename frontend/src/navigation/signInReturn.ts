const PROTECTED_DESTINATIONS = new Set([
  "/preferences", "/recommendations", "/profile",
]);

/** Only an explicit protected-route attempt may override the Home landing. */
export function signInDestination(state: unknown): string {
  if (!state || typeof state !== "object" || !("signInReturnTo" in state)) return "/";
  const destination = state.signInReturnTo;
  if (typeof destination !== "string" || destination.length > 2048 ||
    !destination.startsWith("/") || destination.startsWith("//") ||
    /[\\\s]/.test(destination) ||
    [...destination].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return "/";
  try {
    const base = new URL("https://movie-app.invalid");
    const parsed = new URL(destination, base);
    if (parsed.origin !== base.origin || !PROTECTED_DESTINATIONS.has(parsed.pathname)) return "/";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}

export function signInReturnState(state: unknown) {
  const destination = signInDestination(state);
  return destination === "/" ? undefined : { signInReturnTo: destination };
}
