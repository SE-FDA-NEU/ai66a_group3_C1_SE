// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "../auth/AuthContext.tsx";
import SimilarMovies from "../components/SimilarMovies.tsx";
import MovieDetailPage from "../pages/MovieDetailPage.tsx";

const drama = { id: 18, name: "Drama" };
const user = { id: "account-a", email: "a@example.com" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function summary(id: string) {
  return { id, title: `Title ${id}`, releaseYear: 2025, genres: [drama], popularityScore: 50 };
}

function detail(id: string) {
  return { ...summary(id), overview: `Overview ${id}`, voteAverage: null, voteCount: null };
}

function similar(...ids: string[]) {
  return json({ data: { movies: ids.map(summary) } });
}

function deferred() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

type Handler = (init?: RequestInit) => Response | Promise<Response>;

// Unlisted paths fail loudly. Guests are the default: /api/auth/me is 401.
function installApi(handlers: Record<string, Handler>) {
  const requests: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const path = String(input);
    requests.push(path);
    const handler = handlers[path];
    if (handler) return handler(init);
    if (path === "/api/auth/me") return json({ error: { code: "AUTHENTICATION_REQUIRED" } }, 401);
    throw new Error(`Unexpected request: ${path}`);
  });
  return requests;
}

function movieRoutes(id: string) {
  return {
    [`/api/movies/${id}`]: () => json({ data: { movie: detail(id) } }),
  };
}

function renderDetail(state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/movies/movie-a", state }]}>
      <AuthProvider>
        <Link to="/movies/movie-b">Open movie B</Link>
        <Routes>
          <Route path="/movies/:movieId" element={<MovieDetailPage />} />
          <Route path="/search" element={<p>Search page</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function similarSection() {
  return screen.getByRole("region", { name: "Similar movies" });
}

function cardTitles() {
  const cards = within(similarSection()).getByRole("region", { name: "Similar movie cards" });
  return within(cards).getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("S4-T08 similar movies on the details page", () => {
  it("shows loading, then at most five distinct cards in API order without the source", async () => {
    const response = deferred();
    installApi({
      ...movieRoutes("movie-a"),
      "/api/movies/movie-a/similar": () => response.promise,
    });
    renderDetail();

    expect(await screen.findByText("Loading similar movies...")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Title movie-a" })).toBeVisible();

    await act(async () => {
      response.resolve(similar("s1", "s2", "s2", "movie-a", "s3", "s4", "s5", "s6"));
    });

    expect(cardTitles()).toEqual(["Title s1", "Title s2", "Title s3", "Title s4", "Title s5"]);
    expect(screen.queryByText("Loading similar movies...")).not.toBeInTheDocument();
  });

  it("is public: a guest sees results and no private account request is made", async () => {
    const requests = installApi({
      ...movieRoutes("movie-a"),
      "/api/movies/movie-a/similar": () => similar("s1"),
    });
    renderDetail();

    await screen.findByRole("link", { name: "View details for Title s1" });
    expect(await screen.findByRole("link", { name: "Sign in to rate this movie" })).toBeInTheDocument();
    expect(requests.filter((path) => path.startsWith("/api/me/"))).toEqual([]);
  });

  it("does not depend on the rating or watchlist reads, and they do not depend on it", async () => {
    installApi({
      ...movieRoutes("movie-a"),
      "/api/auth/me": () => json({ data: { user } }),
      "/api/me/ratings/movie-a": () => json({ error: { code: "SERVICE_UNAVAILABLE" } }, 503),
      "/api/me/watchlist/movie-a": () => json({ error: { code: "SERVICE_UNAVAILABLE" } }, 503),
      "/api/movies/movie-a/similar": () => similar("s1", "s2"),
    });
    renderDetail();

    await screen.findByRole("link", { name: "View details for Title s2" });
    expect(cardTitles()).toEqual(["Title s1", "Title s2"]);

    cleanup();
    vi.restoreAllMocks();
    installApi({
      ...movieRoutes("movie-a"),
      "/api/auth/me": () => json({ data: { user } }),
      "/api/me/ratings/movie-a": () => json({ data: { movieId: "movie-a", rating: 4 } }),
      "/api/me/watchlist/movie-a": () => json({ data: { movieId: "movie-a", inWatchlist: false, addedAt: null } }),
      "/api/movies/movie-a/similar": () => json({ error: { code: "INDEX_UNAVAILABLE", message: "Search index is temporarily unavailable" } }, 503),
    });
    renderDetail();

    await screen.findByText("Your saved rating: 4/5");
    expect(within(similarSection()).getByRole("alert")).toBeInTheDocument();
  });

  it("shows a legitimate empty state and keeps the source details visible", async () => {
    installApi({
      ...movieRoutes("movie-a"),
      "/api/movies/movie-a/similar": () => similar(),
    });
    renderDetail();

    expect(await screen.findByText("No similar movies are available")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Title movie-a" })).toBeVisible();
    expect(screen.getByText("Overview movie-a")).toBeVisible();
    expect(screen.queryByRole("region", { name: "Similar movie cards" })).not.toBeInTheDocument();
    expect(within(similarSection()).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a recoverable error with Retry that re-reads the same movie and keeps details visible", async () => {
    let attempt = 0;
    const requests = installApi({
      ...movieRoutes("movie-a"),
      "/api/movies/movie-a/similar": () => ++attempt === 1
        ? json({ error: { code: "INDEX_UNAVAILABLE", message: "Search index is temporarily unavailable" } }, 503)
        : similar("s1"),
    });
    renderDetail();

    const alert = await within(await screen.findByRole("region", { name: "Similar movies" })).findByRole("alert");
    expect(alert).toHaveTextContent("Similar movies are unavailable. Search index is temporarily unavailable");
    expect(screen.queryByText("No similar movies are available")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Title movie-a" })).toBeVisible();
    expect(screen.getByText("Overview movie-a")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Retry similar movies" }));
    await screen.findByRole("link", { name: "View details for Title s1" });

    expect(requests.filter((path) => path === "/api/movies/movie-a/similar")).toHaveLength(2);
    expect(within(similarSection()).queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Title movie-a" })).toBeVisible();
  });

  it("opens the exact selected movie and keeps the safe return context", async () => {
    installApi({
      ...movieRoutes("movie-a"),
      ...movieRoutes("movie-b"),
      "/api/movies/movie-a/similar": () => similar("movie-b"),
      "/api/movies/movie-b/similar": () => similar(),
    });
    renderDetail({ returnTo: "/search?q=moon#results" });

    const card = await screen.findByRole("link", { name: "View details for Title movie-b" });
    expect(card).toHaveAttribute("href", "/movies/movie-b");
    fireEvent.click(card);

    expect(await screen.findByRole("heading", { name: "Title movie-b" })).toBeVisible();
    expect(screen.getByText("Overview movie-b")).toBeVisible();
    const back = await screen.findByRole("link", { name: "Back to search" });
    expect(back).toHaveAttribute("href", "/search?q=moon#results");
    fireEvent.click(back);
    expect(await screen.findByText("Search page")).toBeInTheDocument();
  });

  it("ignores an unsafe return path when moving between similar movies", async () => {
    installApi({
      ...movieRoutes("movie-a"),
      ...movieRoutes("movie-b"),
      "/api/movies/movie-a/similar": () => similar("movie-b"),
      "/api/movies/movie-b/similar": () => similar(),
    });
    renderDetail({ returnTo: "https://evil.example/steal-session" });

    fireEvent.click(await screen.findByRole("link", { name: "View details for Title movie-b" }));

    const back = await screen.findByRole("link", { name: "Return to catalogue" });
    expect(back).toHaveAttribute("href", "/");
  });

  it("clears the section on movie change and a delayed response for A cannot fill B", async () => {
    const oldResponse = deferred();
    const signals: Record<string, AbortSignal | null | undefined> = {};
    installApi({
      ...movieRoutes("movie-a"),
      ...movieRoutes("movie-b"),
      "/api/movies/movie-a/similar": (init) => {
        signals.a = init?.signal;
        return oldResponse.promise;
      },
      "/api/movies/movie-b/similar": () => similar("b1"),
    });
    renderDetail();

    await screen.findByText("Loading similar movies...");
    fireEvent.click(screen.getByRole("link", { name: "Open movie B" }));
    await screen.findByRole("link", { name: "View details for Title b1" });
    expect(signals.a?.aborted).toBe(true);

    await act(async () => {
      oldResponse.resolve(similar("a1", "a2"));
    });

    expect(cardTitles()).toEqual(["Title b1"]);
    expect(screen.queryByRole("link", { name: "View details for Title a1" })).not.toBeInTheDocument();
  });

  it("rekeys itself when only the movie ID changes, even if a transport ignores abort", async () => {
    const oldResponse = deferred();
    const nextResponse = deferred();
    installApi({
      "/api/movies/movie-a/similar": () => oldResponse.promise,
      "/api/movies/movie-b/similar": () => nextResponse.promise,
    });
    const view = (movieId: string) => (
      <MemoryRouter>
        <SimilarMovies movieId={movieId} returnTo="/" />
      </MemoryRouter>
    );
    const { rerender } = render(view("movie-a"));
    await screen.findByText("Loading similar movies...");

    rerender(view("movie-b"));
    expect(screen.getByText("Loading similar movies...")).toBeInTheDocument();
    await act(async () => {
      oldResponse.resolve(similar("a1"));
    });
    expect(screen.getByText("Loading similar movies...")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "View details for Title a1" })).not.toBeInTheDocument();

    await act(async () => {
      nextResponse.resolve(similar("b1"));
    });
    expect(cardTitles()).toEqual(["Title b1"]);
  });

  it("does not let a late failure for A replace B's results", async () => {
    const oldResponse = deferred();
    installApi({
      "/api/movies/movie-a/similar": () => oldResponse.promise,
      "/api/movies/movie-b/similar": () => similar("b1"),
    });
    const view = (movieId: string) => (
      <MemoryRouter>
        <SimilarMovies movieId={movieId} returnTo="/" />
      </MemoryRouter>
    );
    const { rerender } = render(view("movie-a"));
    await screen.findByText("Loading similar movies...");
    rerender(view("movie-b"));
    await screen.findByRole("link", { name: "View details for Title b1" });

    await act(async () => {
      oldResponse.resolve(json({ error: { message: "Old failure" } }, 503));
    });

    expect(cardTitles()).toEqual(["Title b1"]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
