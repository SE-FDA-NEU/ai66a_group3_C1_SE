// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import App from "../App.tsx";

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status,
    headers: { "Content-Type": "application/json" } }));
}

const genre = { id: 28, name: "Action" };
const catalogue = Array.from({ length: 25 }, (_, index) => ({
  id: `movie-${index + 1}`, title: `Movie ${String(index + 1).padStart(2, "0")}`,
  releaseYear: 2025, genres: [genre], popularityScore: 100 - index,
}));

afterEach(() => { cleanup(); vi.restoreAllMocks(); window.history.replaceState({}, "", "/"); });

it("restores Home page 2 after details and keeps public access during session verification", async () => {
  const calls: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(input => {
    const url = String(input); calls.push(url);
    if (url === "/api/auth/me") return json({ error: { code: "AUTHENTICATION_REQUIRED" } }, 401);
    if (url.startsWith("/api/movies?")) {
      const page = Number(new URL(url, "http://localhost").searchParams.get("page") ?? 1);
      const movies = catalogue.slice((page - 1) * 10, page * 10);
      return json({ data: { movies }, meta: { count: movies.length, limit: 10, page,
        total: 25, totalPages: 3, unfilteredTotal: 25, catalogueRevision: "rev-a" } });
    }
    if (url === "/api/movies/movie-11") return json({ data: { movie: {
      ...catalogue[10], overview: "Page two detail", voteAverage: null,
      voteCount: null, backdropUrl: null } } });
    throw new Error(`Unexpected request ${url}`);
  });
  render(<App />);
  expect(screen.getByText("Checking session...")).toBeInTheDocument();
  expect(await screen.findByText("Showing 1-10 of 25 movies")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(await screen.findByText("Showing 11-20 of 25 movies")).toBeInTheDocument();
  expect(window.location.search).toBe("?page=2");
  fireEvent.click(screen.getByRole("link", { name: "View details for Movie 11" }));
  expect(await screen.findByText("Page two detail")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: "Return to catalogue" }));
  expect(await screen.findByText("Showing 11-20 of 25 movies")).toBeInTheDocument();
  expect(window.location.search).toBe("?page=2");
  expect(calls.some(url => url.includes("api.themoviedb.org"))).toBe(false);
});

it("filters complete recommendations into two pages and preserves the view URL", async () => {
  const calls: string[] = [];
  const writes: string[] = [];
  let reranked = false;
  const base = Array.from({ length: 35 }, (_, index) => ({
    id: `rec-${index}`, title: `Rec ${index}`, releaseYear: 2025,
    genres: index >= 23 ? [genre] : [{ id: 18, name: "Drama" }],
    popularityScore: 35 - index,
    reason: { matchedGenres: [{ id: 18, name: "Drama" }] },
  }));
  vi.spyOn(globalThis, "fetch").mockImplementation((input, options) => {
    const url = String(input); calls.push(url);
    if (options?.method && options.method !== "GET") writes.push(`${options.method} ${url}`);
    if (url === "/api/auth/me") return json({ data: { user: { id: "viewer", email: "viewer@example.com" } } });
    if (url === "/api/genres") return json({ data: { genres: [genre, { id: 18, name: "Drama" }] } });
    if (url.startsWith("/api/me/recommendations?")) {
      const params = new URL(url, "http://localhost").searchParams;
      // Fixed server snapshots; the UI must never calculate or sort this order.
      const current = reranked ? [...base.slice(23), ...base.slice(0, 23)] : base;
      const candidates = params.get("genreId") === "28"
        ? current.filter(movie => movie.genres.some(item => item.id === 28)) : current;
      const page = Number(params.get("page") ?? 1);
      const movies = candidates.slice((page - 1) * 10, page * 10);
      return json({ data: { movies, mode: "personalised", personalised: true,
        noMatch: false }, meta: { count: movies.length, limit: 10, page,
        total: candidates.length, totalPages: Math.ceil(candidates.length / 10),
        unfilteredTotal: 35, catalogueRevision: "rev-a" } });
    }
    if (url === "/api/movies/rec-33") return json({ data: { movie: {
      ...base[33], overview: "Filtered page two detail", voteAverage: null,
      voteCount: null, backdropUrl: null } } });
    if (url === "/api/me/ratings/rec-33") {
      if (options?.method === "PUT") reranked = true;
      return json({ data: { movieId: "rec-33", rating: reranked ? 5 : null } });
    }
    if (url === "/api/me/watchlist/rec-33") return json({ data: { movieId: "rec-33", inWatchlist: false } });
    if (url.startsWith("/api/movies/rec-33/similar")) return json({ data: { movies: [] } });
    throw new Error(`Unexpected request ${url}`);
  });
  window.history.pushState({}, "", "/recommendations"); render(<App />);
  await waitFor(() => expect(screen.getByText("Showing 1-10 of 35 movies")).toBeInTheDocument());
  const filter = screen.getByRole("combobox", { name: "Filter by genre" });
  await waitFor(() => expect(filter).toBeEnabled());
  fireEvent.change(filter, { target: { value: "28" } });
  expect(await screen.findByText("Showing 1-10 of 12 matches (35 recommendations before filtering)")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(await screen.findByText("Showing 11-12 of 12 matches (35 recommendations before filtering)")).toBeInTheDocument();
  expect(window.location.search).toContain("page=2");
  expect(window.location.search).toContain("genreId=28");
  fireEvent.click(screen.getByRole("link", { name: "View details for Rec 33" }));
  expect(await screen.findByText("Filtered page two detail")).toBeInTheDocument();
  await screen.findByRole("group", { name: "Your rating (1 to 5)" });
  fireEvent.click(screen.getByRole("radio", { name: "5 stars" }));
  fireEvent.click(screen.getByRole("button", { name: "Save rating" }));
  await screen.findByText("Rating saved.");
  const beforeReturn = calls.length;
  fireEvent.click(screen.getByRole("link", { name: "Back to recommendations" }));
  expect(await screen.findByText("Showing 11-12 of 12 matches (35 recommendations before filtering)")).toBeInTheDocument();
  expect([...document.querySelectorAll(".movie-card h2")].map(node => node.textContent))
    .toEqual(["Rec 33", "Rec 34"]);
  expect(calls.slice(beforeReturn).find(url => url.startsWith("/api/me/recommendations")))
    .toContain("page=2&genreId=28&catalogueRevision=rev-a");
  fireEvent.click(screen.getByRole("button", { name: "Clear filter" }));
  expect(await screen.findByText("Showing 1-10 of 35 movies")).toBeInTheDocument();
  expect(window.location.search).toBe("?page=1");
  expect([...document.querySelectorAll(".movie-card h2")].map(node => node.textContent))
    .toEqual(base.slice(23, 33).map(movie => movie.title));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(await screen.findByText("Showing 11-20 of 35 movies")).toBeInTheDocument();
  expect([...document.querySelectorAll(".movie-card h2")].map(node => node.textContent))
    .toEqual([...base.slice(33), ...base.slice(0, 8)].map(movie => movie.title));
  expect(calls.every(url => !url.startsWith("/api/me/preferences"))).toBe(true);
  expect(writes).toEqual(["PUT /api/me/ratings/rec-33"]);
});

it("drops an old catalogue revision and restarts from page 1", async () => {
  let changed = false;
  vi.spyOn(globalThis, "fetch").mockImplementation(input => {
    const url = String(input);
    if (url === "/api/auth/me") return json({ error: { code: "AUTHENTICATION_REQUIRED" } }, 401);
    if (url.startsWith("/api/movies?")) {
      const params = new URL(url, "http://localhost").searchParams;
      if (params.get("page") === "2" && params.get("catalogueRevision") === "rev-a") {
        changed = true;
        return json({ error: { code: "CATALOGUE_CHANGED", message: "Movie catalogue changed" } }, 409);
      }
      const source = changed ? catalogue.slice(0, 20) : catalogue;
      const movies = source.slice(0, 10);
      return json({ data: { movies }, meta: { count: 10, limit: 10, page: 1,
        total: source.length, totalPages: Math.ceil(source.length / 10),
        unfilteredTotal: source.length, catalogueRevision: changed ? "rev-b" : "rev-a" } });
    }
    throw new Error(`Unexpected request ${url}`);
  });
  render(<App />);
  expect(await screen.findByText("Showing 1-10 of 25 movies")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(await screen.findByText("Showing 1-10 of 20 movies")).toBeInTheDocument();
  expect(window.location.search).toBe("?page=1");
});
