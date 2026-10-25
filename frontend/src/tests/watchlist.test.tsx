// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

import { AuthContext, type AuthContextValue } from "../auth/authState.ts";
import MovieWatchlist from "../components/MovieWatchlist.tsx";
import WatchlistPage from "../pages/WatchlistPage.tsx";

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

function authenticated(id = "a"): AuthContextValue {
  return {
    status: "authenticated", user: { id, email: `${id}@example.com` },
    refresh: async () => {}, signIn: async () => {}, signOut: async () => {},
    handleUnauthorized: () => {}, recommendationVersion: 0,
    recommendationScope: "scope", invalidateRecommendations: () => {},
  };
}

function renderDetail(auth = authenticated()) {
  return render(<AuthContext.Provider value={auth}><MemoryRouter>
    <MovieWatchlist movieId="movie-a" />
  </MemoryRouter></AuthContext.Provider>);
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("guest sees sign-in guidance and makes no private request", () => {
  const fetch = vi.spyOn(globalThis, "fetch");
  renderDetail({ ...authenticated(), status: "unauthenticated" });
  expect(screen.getByRole("link", { name: "Sign in to save this movie" })).toHaveAttribute("href", "/login");
  expect(fetch).not.toHaveBeenCalled();
});

it("blocks duplicate writes and confirms only after the PUT response", async () => {
  let complete!: (value: Response) => void;
  const pending = new Promise<Response>(resolve => { complete = resolve; });
  const calls: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    calls.push(init?.method ?? "GET");
    if (init?.method === "PUT") return pending;
    if (String(input) === "/api/me/watchlist/movie-a")
      return json({ data: { movieId: "movie-a", inWatchlist: false, addedAt: null } });
    throw new Error("Unexpected request");
  });
  renderDetail();
  const add = await screen.findByRole("button", { name: "Add to watchlist" });
  fireEvent.click(add);
  expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  expect(screen.getByText("Not in your watchlist")).toBeInTheDocument();
  await act(async () => complete(new Response(JSON.stringify({ data: {
    movieId: "movie-a", inWatchlist: true, addedAt: "2026-10-24T09:00:00Z",
  } }), { status: 200 })));
  expect(await screen.findByText("Saved to your watchlist")).toBeInTheDocument();
  expect(calls).toEqual(["GET", "PUT"]);
});

it("rereads membership after an unconfirmed write and keeps the real result", async () => {
  let reads = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => {
    if (init?.method === "PUT") return Promise.reject(new TypeError("network timeout"));
    reads += 1;
    return json({ data: { movieId: "movie-a", inWatchlist: reads > 1,
      addedAt: reads > 1 ? "2026-10-24T09:00:00Z" : null } });
  });
  renderDetail();
  fireEvent.click(await screen.findByRole("button", { name: "Add to watchlist" }));
  expect(await screen.findByText("Saved to your watchlist")).toBeInTheDocument();
  expect(reads).toBe(2);
});

it("shows a failed write truthfully and allows a retry", async () => {
  let writes = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => {
    if (init?.method === "PUT") {
      writes += 1;
      return writes === 1 ? json({ error: { code: "SERVICE_UNAVAILABLE", message: "Unavailable" } }, 503) :
        json({ data: { movieId: "movie-a", inWatchlist: true, addedAt: "2026-10-24T09:00:00Z" } });
    }
    return json({ data: { movieId: "movie-a", inWatchlist: false, addedAt: null } });
  });
  renderDetail();
  fireEvent.click(await screen.findByRole("button", { name: "Add to watchlist" }));
  expect(await screen.findByText("Change was not saved. Please retry.")).toBeInTheDocument();
  expect(screen.getByText("Not in your watchlist")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Add to watchlist" }));
  expect(await screen.findByText("Saved to your watchlist")).toBeInTheDocument();
  expect(writes).toBe(2);
});

it("offers retry after a membership read error", async () => {
  let reads = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(() => {
    reads += 1;
    return reads === 1 ? json({ error: { message: "Unavailable" } }, 503) :
      json({ data: { movieId: "movie-a", inWatchlist: false, addedAt: null } });
  });
  renderDetail();
  fireEvent.click(await screen.findByRole("button", { name: "Retry watchlist status" }));
  await screen.findByText("Not in your watchlist");
  expect(reads).toBe(2);
});

it("discards an old account's pending membership reply", async () => {
  let complete!: (value: Response) => void;
  const pending = new Promise<Response>(resolve => { complete = resolve; });
  let reads = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(() => {
    reads += 1;
    return reads === 1 ? pending : json({ data: { movieId: "movie-a", inWatchlist: false, addedAt: null } });
  });
  const view = renderDetail(authenticated("a"));
  view.rerender(<AuthContext.Provider value={authenticated("b")}><MemoryRouter>
    <MovieWatchlist movieId="movie-a" />
  </MemoryRouter></AuthContext.Provider>);
  await screen.findByText("Not in your watchlist");
  await act(async () => complete(new Response(JSON.stringify({ data: {
    movieId: "movie-a", inWatchlist: true, addedAt: "2026-10-24T09:00:00Z",
  } }), { status: 200 })));
  expect(screen.getByText("Not in your watchlist")).toBeInTheDocument();
});

it("discards a pending reply after logout", async () => {
  let complete!: (value: Response) => void;
  const pending = new Promise<Response>(resolve => { complete = resolve; });
  const fetch = vi.spyOn(globalThis, "fetch").mockReturnValue(pending);
  const view = renderDetail();
  view.rerender(<AuthContext.Provider value={{ ...authenticated(), status: "unauthenticated" }}>
    <MemoryRouter><MovieWatchlist movieId="movie-a" /></MemoryRouter>
  </AuthContext.Provider>);
  await act(async () => complete(new Response(JSON.stringify({ data: {
    movieId: "movie-a", inWatchlist: true, addedAt: "2026-10-24T09:00:00Z",
  } }), { status: 200 })));
  expect(screen.queryByText("Saved to your watchlist")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Sign in to save this movie" })).toBeVisible();
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("last-row removal reconciles totals and returns to page one", async () => {
  const movie = { id: "movie-a", title: "Movie A", releaseYear: 2025, genres: [],
    popularityScore: null, posterUrl: null, addedAt: "2026-10-24T09:00:00Z" };
  let removed = false;
  const requests: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const path = String(input);
    requests.push(`${init?.method ?? "GET"} ${path}`);
    if (init?.method === "DELETE") {
      removed = true;
      return json({ data: { movieId: "movie-a", inWatchlist: false } });
    }
    if (path.startsWith("/api/me/watchlist?")) {
      const page = Number(new URL(`http://test${path}`).searchParams.get("page"));
      return json({ data: { movies: removed ? [] : [movie] }, meta: {
        count: removed ? 0 : 1, page, limit: 10, total: removed ? 0 : 11,
        totalPages: removed ? 0 : 2, unfilteredTotal: removed ? 0 : 11,
        catalogueRevision: "revision-a",
      } });
    }
    throw new Error(`Unexpected ${path}`);
  });
  render(<AuthContext.Provider value={authenticated()}><MemoryRouter initialEntries={["/watchlist?page=2"]}>
    <Routes><Route path="/watchlist" element={<WatchlistPage />} /></Routes>
  </MemoryRouter></AuthContext.Provider>);
  fireEvent.click(await screen.findByRole("button", { name: "Remove Movie A from watchlist" }));
  await screen.findByText("No saved movies yet");
  await waitFor(() => expect(requests.some(value => value.includes("page=1"))).toBe(true));
});
