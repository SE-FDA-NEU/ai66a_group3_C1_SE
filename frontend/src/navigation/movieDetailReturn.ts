export type MovieDetailReturnState = {
  returnTo: string;
};

export type MovieDetailReturnDestination = {
  label: string;
  to: string;
};

const DEFAULT_RETURN: MovieDetailReturnDestination = {
  label: "Return to catalogue",
  to: "/",
};

const SAFE_MOVIE_LIST_ROUTES = new Map([
  ["/", "Return to catalogue"],
  ["/popular", "Back to popular movies"],
  ["/recommendations", "Back to recommendations"],
]);

export function currentReturnPath(location: {
  pathname: string;
  search: string;
  hash: string;
}): string {
  return `${location.pathname}${location.search}${location.hash}`;
}

export function movieDetailReturnState(returnTo: string): MovieDetailReturnState {
  return { returnTo };
}

export function resolveMovieDetailReturn(
  state: unknown,
): MovieDetailReturnDestination {
  if (!isRecord(state) || typeof state.returnTo !== "string") {
    return DEFAULT_RETURN;
  }

  const returnTo = state.returnTo;
  if (
    !returnTo.startsWith("/") ||
    returnTo.startsWith("//") ||
    returnTo.includes("\\")
  ) {
    return DEFAULT_RETURN;
  }

  try {
    const base = new URL("https://movie-app.invalid/");
    const parsed = new URL(returnTo, base);
    const label = SAFE_MOVIE_LIST_ROUTES.get(parsed.pathname);

    if (parsed.origin !== base.origin || !label) {
      return DEFAULT_RETURN;
    }

    return {
      label,
      to: `${parsed.pathname}${parsed.search}${parsed.hash}`,
    };
  } catch {
    return DEFAULT_RETURN;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
