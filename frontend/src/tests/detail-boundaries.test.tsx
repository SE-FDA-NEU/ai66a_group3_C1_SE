// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

import { AuthContext, type AuthContextValue } from "../auth/authState.ts";
import ActionFeedback from "../components/ActionFeedback.tsx";
import MovieRating from "../components/MovieRating.tsx";
import MovieWatchlist from "../components/MovieWatchlist.tsx";
import MovieDetailPage from "../pages/MovieDetailPage.tsx";
import WatchlistPage from "../pages/WatchlistPage.tsx";

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function delayed() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>(done => { resolve = done; });
  return { promise, resolve };
}

function account(id = "a"): AuthContextValue {
  return {
    status: "authenticated", user: { id, email: `${id}@example.test` },
    refresh: vi.fn().mockResolvedValue(undefined), signIn: vi.fn(), signOut: vi.fn(),
    handleUnauthorized: vi.fn(), invalidateRecommendations: vi.fn(),
    recommendationScope: `scope-${id}`, recommendationVersion: 0,
  };
}

function Location() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}{location.hash}</output>;
}

const savedMovie = {
  id: "movie-b", title: "B's movie", genres: [], releaseYear: 2025,
  popularityScore: 80, posterUrl: null, addedAt: "2026-10-24T09:00:00Z",
};

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("TC-S4-T16-WATCH-001 never restores account A's watchlist page for account B", async () => {
  const requests: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async input => {
    const url = String(input);
    requests.push(url);
    const page = Number(new URL(url, "http://test").searchParams.get("page"));
    return response({ data: { movies: [savedMovie] }, meta: {
      page, limit: 10, total: 20, totalPages: 2, catalogueRevision: "rev-b",
      unfilteredTotal: 20, count: 1,
    } });
  });
  render(<AuthContext.Provider value={account("b")}><MemoryRouter initialEntries={[{
    pathname: "/watchlist", search: "?page=2&source=detail", hash: "#saved",
    state: { listViewContext: { route: "/watchlist", accountId: "a", catalogueRevision: "rev-a" } },
  }]}><Location /><WatchlistPage /></MemoryRouter></AuthContext.Provider>);
  await screen.findByText("B's movie");
  expect(screen.getByTestId("location")).toHaveTextContent("/watchlist?page=1&source=detail#saved");
  expect(requests.length).toBeGreaterThan(0);
  expect(requests.every(url => !url.includes("page=2") && !url.includes("rev-a"))).toBe(true);
});

it.each(["movie", "account", "logout"] as const)(
  "TC-S4-T16-WATCH-002 ignores delayed membership after a %s change even if fetch ignores abort",
  async change => {
    const pending = delayed();
    const a = account();
    const b = change === "account" ? account("b") : a;
    let reads = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async input => {
      if (++reads === 1) return pending.promise;
      const id = String(input).split("/").at(-1);
      return response({ data: { movieId: id, inWatchlist: false, addedAt: null } });
    });
    const view = (auth: AuthContextValue, movieId: string) =>
      <AuthContext.Provider value={auth}><MemoryRouter><ActionFeedback>
        <MovieWatchlist movieId={movieId} />
      </ActionFeedback></MemoryRouter></AuthContext.Provider>;
    const rendered = render(view(a, "movie-a"));
    const next = change === "logout" ? { ...a, status: "unauthenticated" as const } : b;
    rendered.rerender(view(next, change === "movie" ? "movie-b" : "movie-a"));
    await act(async () => pending.resolve(response({ data: {
      movieId: "movie-a", inWatchlist: true, addedAt: "2026-10-24T09:00:00Z",
    } })));
    expect(screen.queryByText("Saved to your watchlist")).not.toBeInTheDocument();
    if (change !== "logout") expect(await screen.findByText("Not in your watchlist")).toBeVisible();
    else expect(screen.getByRole("link", { name: "Sign in to save this movie" })).toBeVisible();
  },
);

it.each(["movie", "account"] as const)(
  "TC-S4-T16-WATCH-003 a late membership 401 cannot sign out the new %s context",
  async change => {
    const pending = delayed();
    const a = account();
    const b = change === "account" ? account("b") : a;
    let first = true;
    vi.spyOn(globalThis, "fetch").mockImplementation(async input => {
      if (first) { first = false; return pending.promise; }
      return response({ data: { movieId: String(input).split("/").at(-1), inWatchlist: false } });
    });
    const view = (auth: AuthContextValue, movieId: string) =>
      <AuthContext.Provider value={auth}><MemoryRouter><Routes>
        <Route path="/" element={<MovieWatchlist movieId={movieId} />} />
        <Route path="/login" element={<h1>Stale login redirect</h1>} />
      </Routes></MemoryRouter></AuthContext.Provider>;
    const rendered = render(view(a, "movie-a"));
    rendered.rerender(view(b, change === "movie" ? "movie-b" : "movie-a"));
    await screen.findByText("Not in your watchlist");
    await act(async () => pending.resolve(response({ error: {
      code: "AUTHENTICATION_REQUIRED", message: "Session expired",
    } }, 401)));
    expect(a.handleUnauthorized).not.toHaveBeenCalled();
    expect(b.handleUnauthorized).not.toHaveBeenCalled();
    expect(screen.queryByText("Stale login redirect")).not.toBeInTheDocument();
  },
);

it.each([
  ["movie", 200], ["movie", 401], ["movie", 503],
  ["account", 200], ["account", 401], ["account", 503],
] as const)(
  "TC-S4-T16-WRITE-001 a late watchlist write cannot affect the new %s with HTTP %i",
  async (change, status) => {
    const pending = delayed();
    const a = account();
    const b = change === "account" ? account("b") : a;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, options) => {
      if (options?.method === "PUT") return pending.promise;
      return response({ data: { movieId: String(input).split("/").at(-1), inWatchlist: false } });
    });
    const view = (auth: AuthContextValue, movieId: string) =>
      <AuthContext.Provider value={auth}><MemoryRouter><ActionFeedback>
        <MovieWatchlist movieId={movieId} />
      </ActionFeedback></MemoryRouter></AuthContext.Provider>;
    const rendered = render(view(a, "movie-a"));
    fireEvent.click(await screen.findByRole("button", { name: "Add to watchlist" }));
    expect(screen.getByTestId("action-feedback")).toHaveTextContent("Adding to watchlist");
    rendered.rerender(view(b, change === "movie" ? "movie-b" : "movie-a"));
    await screen.findByText("Not in your watchlist");
    await act(async () => pending.resolve(status === 200 ? response({ data: {
      movieId: "movie-a", inWatchlist: true, addedAt: "2026-10-24T09:00:00Z",
    } }) : response({ error: { code: "STALE_FAILURE", message: "Old write failed" } }, status)));
    expect(screen.queryByTestId("action-feedback")).not.toBeInTheDocument();
    expect(screen.getByText("Not in your watchlist")).toBeVisible();
    expect(a.handleUnauthorized).not.toHaveBeenCalled();
    expect(b.handleUnauthorized).not.toHaveBeenCalled();
  },
);

it.each(["movie", "account"] as const)(
  "TC-S4-T16-WRITE-002 a late rating save cannot invalidate ranking for the new %s",
  async change => {
    const pending = delayed();
    const a = account();
    const b = change === "account" ? account("b") : a;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, options) => {
      if (options?.method === "PUT") return pending.promise;
      return response({ data: { movieId: String(input).split("/").at(-1), rating: null } });
    });
    const view = (auth: AuthContextValue, movieId: string) =>
      <AuthContext.Provider value={auth}><MemoryRouter><ActionFeedback>
        <MovieRating movieId={movieId} />
      </ActionFeedback></MemoryRouter></AuthContext.Provider>;
    const rendered = render(view(a, "movie-a"));
    fireEvent.click(await screen.findByRole("radio", { name: "4 stars" }));
    fireEvent.click(screen.getByRole("button", { name: "Save rating" }));
    rendered.rerender(view(b, change === "movie" ? "movie-b" : "movie-a"));
    await screen.findByText("Not rated yet");
    await act(async () => pending.resolve(response({ data: { movieId: "movie-a", rating: 4 } })));
    expect(a.invalidateRecommendations).not.toHaveBeenCalled();
    expect(b.invalidateRecommendations).not.toHaveBeenCalled();
    expect(screen.queryByTestId("action-feedback")).not.toBeInTheDocument();
    expect(screen.getByText("Not rated yet")).toBeVisible();
  },
);

it("TC-S4-T16-FAIL-001 membership outage cannot hide source details, rating or similar movies", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async input => {
    const url = String(input);
    if (url.startsWith("/api/me/watchlist/")) return response({ error: {
      code: "SERVICE_UNAVAILABLE", message: "Membership temporarily unavailable",
    } }, 503);
    if (url.startsWith("/api/me/ratings/")) return response({ data: { movieId: "movie-a", rating: 3 } });
    if (url.endsWith("/similar")) return response({ data: { movies: [{
      ...savedMovie, id: "movie-c", title: "Independent similar movie",
    }] } });
    return response({ data: { movie: {
      ...savedMovie, id: "movie-a", title: "Source movie", overview: "Source overview stays visible",
      voteAverage: null, voteCount: null, backdropUrl: null,
    } } });
  });
  render(<AuthContext.Provider value={account()}><MemoryRouter initialEntries={["/movies/movie-a"]}>
    <Routes><Route path="/movies/:movieId" element={<MovieDetailPage />} /></Routes>
  </MemoryRouter></AuthContext.Provider>);
  expect(await screen.findByRole("heading", { name: "Source movie" })).toBeVisible();
  expect(await screen.findByRole("button", { name: "Retry watchlist status" })).toBeVisible();
  expect(screen.getByText("Source overview stays visible")).toBeVisible();
  expect(await screen.findByText("Your saved rating: 3/5")).toBeVisible();
  expect(await screen.findByRole("link", { name: "View details for Independent similar movie" })).toBeVisible();
  expect(within(screen.getByRole("region", { name: "Your watchlist" })).getByRole("alert"))
    .toHaveTextContent("Membership temporarily unavailable");
});
