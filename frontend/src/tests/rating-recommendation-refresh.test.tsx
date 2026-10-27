// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../App";
import {
  AuthContext,
  type AuthContextValue,
} from "../auth/authState.ts";
import MovieRating from "../components/MovieRating.tsx";
import RecommendationsPage from "../pages/RecommendationsPage.tsx";

const action = { id: 28, name: "Action" };
const comedy = { id: 35, name: "Comedy" };

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

function deferred() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => { resolve = done; });
  return { promise, resolve };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
  window.sessionStorage.clear();
});

describe("S4-T04 recommendation generation after a rating save", () => {
  function mountRating() {
    const invalidateRecommendations = vi.fn();
    const auth: AuthContextValue = {
      status: "authenticated",
      user: { id: "a", email: "a@example.com" },
      refresh: async () => {},
      signIn: async () => {},
      signOut: async () => {},
      handleUnauthorized: vi.fn(),
      recommendationVersion: 0,
      recommendationScope: "scope",
      invalidateRecommendations,
    };
    render(
      <MemoryRouter initialEntries={["/movies/test"]}>
        <AuthContext.Provider value={auth}>
          <Routes>
            <Route path="/movies/test" element={<MovieRating movieId="movie-a" />} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    );
    return { invalidateRecommendations };
  }

  const ratingResponse = (rating: number | null) =>
    json({ data: { movieId: "movie-a", rating } });

  it("advances the generation only after the save is committed, keeping the navigation context", async () => {
    const put = deferred();
    vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) =>
      init?.method === "PUT" ? put.promise : ratingResponse(null));
    const { invalidateRecommendations } = mountRating();

    await screen.findByRole("group", { name: "Your rating (1 to 5)" });
    expect(invalidateRecommendations).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("radio", { name: "5 stars" }));
    expect(invalidateRecommendations).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save rating" }));
    await screen.findByText("Saving...");
    expect(invalidateRecommendations).not.toHaveBeenCalled();

    await act(async () => { put.resolve(new Response(
      JSON.stringify({ data: { movieId: "movie-a", rating: 5 } }), { status: 200 })); });
    await screen.findByText("Rating saved.");
    expect(invalidateRecommendations).toHaveBeenCalledTimes(1);
    expect(invalidateRecommendations).toHaveBeenCalledWith({ keepNavigationContext: true });
  });

  it("does not advance the generation when the save fails and keeps the draft for retry", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) =>
      init?.method === "PUT"
        ? json({ error: { code: "SERVICE_UNAVAILABLE", message: "Try later" } }, 503)
        : ratingResponse(2));
    const { invalidateRecommendations } = mountRating();

    await screen.findByRole("group", { name: "Your rating (1 to 5)" });
    fireEvent.click(screen.getByRole("radio", { name: "5 stars" }));
    fireEvent.click(screen.getByRole("button", { name: "Save rating" }));

    expect(await screen.findByRole("button", { name: "Retry save" })).toBeInTheDocument();
    expect(screen.getByText("Your saved rating: 2/5")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "5 stars" })).toBeChecked();
    expect(invalidateRecommendations).not.toHaveBeenCalled();
  });
});

describe("S4-T04 delayed responses around a rating save", () => {
  const card = (id: string, title: string, adjustment: number, genre = action) => ({
    id, title, releaseYear: 2024, genres: [genre], popularityScore: 80,
    ratingAdjustment: adjustment, adjustedScore: 80 + adjustment,
    basis: adjustment === 0 ? "baseline" : "rating_signals",
    reason: { matchedGenres: [genre] },
  });
  const body = (movies: unknown[]) => ({
    data: { movies, mode: "personalised", personalised: true, noMatch: false },
  });

  it("a pre-save response that arrives late cannot restore the old ranking", async () => {
    const preSave = deferred();
    let calls = 0;
    let oldSignal: AbortSignal | null | undefined;
    const latest = [card("movie-a", "Zenith Action", 1),
      card("movie-b", "Aardvark Comedy", 0, comedy)];
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      if (url === "/api/genres") return json({ data: { genres: [action, comedy] } });
      if (url.startsWith("/api/me/recommendations")) {
        calls += 1;
        if (calls === 1) { oldSignal = init?.signal; return preSave.promise; }
        const genreId = new URL(url, "http://localhost").searchParams.get("genreId");
        const selected = latest.filter(movie => !genreId || String(movie.genres[0].id) === genreId);
        return json({ ...body(selected), meta: { count: selected.length, limit: 10,
          page: 1, total: selected.length, totalPages: 1, unfilteredTotal: 2,
          catalogueRevision: "rev-current" } });
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    const auth = (version: number): AuthContextValue => ({
      status: "authenticated", user: { id: "a", email: "a@example.com" },
      refresh: async () => {}, signIn: async () => {}, signOut: async () => {},
      handleUnauthorized: vi.fn(), recommendationVersion: version,
      recommendationScope: "scope", invalidateRecommendations: vi.fn(),
    });
    const tree = (version: number) => (
      <MemoryRouter initialEntries={["/recommendations"]}>
        <AuthContext.Provider value={auth(version)}><RecommendationsPage /></AuthContext.Provider>
      </MemoryRouter>
    );
    const view = render(tree(0));
    await waitFor(() => expect(calls).toBe(1));

    // A committed rating save advances the generation while the first request is pending.
    view.rerender(tree(1));
    await screen.findByRole("heading", { name: "Zenith Action" });
    expect(oldSignal?.aborted).toBe(true);

    await act(async () => { preSave.resolve(new Response(JSON.stringify(body([
      card("movie-b", "Aardvark Comedy", 0, comedy), card("movie-a", "Zenith Action", 0)])),
    { status: 200 })); });

    const order = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)
      .filter((text) => text === "Zenith Action" || text === "Aardvark Comedy");
    expect(order).toEqual(["Zenith Action", "Aardvark Comedy"]);
    const boosted = screen.getByRole("heading", { name: "Zenith Action" }).closest("article")!;
    expect(within(boosted).getByText("Ranking score for you").nextElementSibling)
      .toHaveTextContent("81");
    await waitFor(() => expect(screen.getByRole("combobox")).toBeEnabled());
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "35" } });
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Zenith Action" })).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Aardvark Comedy" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filter" }));
    await screen.findByRole("heading", { name: "Zenith Action" });
    expect([...document.querySelectorAll(".movie-card h2")].map(node => node.textContent))
      .toEqual(["Zenith Action", "Aardvark Comedy"]);
    expect(within(screen.getByRole("heading", { name: "Zenith Action" }).closest("article")!)
      .getByText("Ranking score for you").nextElementSibling).toHaveTextContent("81");
  });
});

describe("S4-T04 save-to-rerank journey", () => {
  type Genre = typeof action;
  const catalogue: Record<string, { title: string; genres: Genre[] }> = {
    // Deterministic fixture: both candidates have raw popularity 80, but only the
    // Action movie shares a genre with the rated movie, as the backend ranker does.
    "movie-a": { title: "Zenith Action", genres: [action] },
    "movie-b": { title: "Aardvark Comedy", genres: [comedy] },
  };
  const sign = (rating: number) => (rating <= 2 ? -1 : rating === 3 ? 0 : 1);

  // The fake server owns the ranking rule so the browser only displays its order.
  function startJourney(ratings: Record<string, number>, url = "/recommendations") {
    const requests: Array<{ method: string; url: string }> = [];
    const detail = {
      id: "movie-a", title: "Zenith Action", releaseYear: 2024, genres: [action],
      popularityScore: 80, overview: "An action film.", voteAverage: 7, voteCount: 10,
    };

    function recommendations(requested: string) {
      const page = Number(new URL(requested, "http://localhost").searchParams.get("page") ?? 1);
      const movies = Object.entries(catalogue).map(([id, { title, genres }]) => {
        const adjustment = Object.entries(ratings).reduce((sum, [ratedId, rating]) =>
          sum + (catalogue[ratedId].genres.some((g) => genres.some((h) => h.id === g.id))
            ? sign(rating) : 0), 0);
        return { id, title, releaseYear: 2024, genres, popularityScore: 80,
          ratingAdjustment: adjustment, adjustedScore: 80 + adjustment,
          basis: adjustment === 0 ? "baseline" : "rating_signals",
          reason: { matchedGenres: genres } };
      }).sort((x, y) => y.adjustedScore - x.adjustedScore || x.title.localeCompare(y.title));
      return { data: { movies, mode: "personalised", personalised: true, noMatch: false },
        meta: { count: movies.length, limit: 10, page, total: 12, totalPages: 2,
          unfilteredTotal: 12, catalogueRevision: "rev-1" } };
    }

    window.history.pushState({}, "", url);
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const method = init?.method ?? "GET";
      const requested = String(input);
      requests.push({ method, url: requested });
      if (requested === "/api/auth/me")
        return json({ data: { user: { id: "account-a", email: "a@example.com" } } });
      if (requested === "/api/genres") return json({ data: { genres: [action, comedy] } });
      if (requested.startsWith("/api/me/recommendations")) return json(recommendations(requested));
      if (requested === "/api/movies/movie-a") return json({ data: { movie: detail } });
      if (requested === "/api/me/watchlist/movie-a")
        return json({ data: { movieId: "movie-a", inWatchlist: false } });
      if (requested === "/api/me/ratings/movie-a") {
        if (method === "PUT") {
          const rating = JSON.parse(String(init?.body)).rating as number;
          ratings["movie-a"] = rating;
          return json({ data: { movieId: "movie-a", rating } });
        }
        return json({ data: { movieId: "movie-a", rating: ratings["movie-a"] ?? null } });
      }
      return Promise.reject(new Error(`Unexpected request: ${method} ${requested}`));
    });
    render(<App />);
    return requests;
  }

  const order = () => screen.getAllByRole("heading", { level: 2 })
    .map((heading) => heading.textContent)
    .filter((text) => text === "Zenith Action" || text === "Aardvark Comedy");

  async function rateFromRecommendations(value: number) {
    await screen.findByRole("heading", { name: "Recommended for you" }, { timeout: 5000 });
    fireEvent.click(screen.getByRole("link", { name: "View details for Zenith Action" }));
    await screen.findByRole("group", { name: "Your rating (1 to 5)" });
    fireEvent.click(screen.getByRole("radio", { name: `${value} ${value === 1 ? "star" : "stars"}` }));
    fireEvent.click(screen.getByRole("button", { name: "Save rating" }));
    await screen.findByText("Rating saved.");
  }

  function scores(title: string) {
    const article = screen.getByRole("heading", { name: title }).closest("article")!;
    return {
      popularity: within(article).getByText("TMDb popularity").nextElementSibling,
      ranking: within(article).getByText("Ranking score for you").nextElementSibling,
    };
  }

  it("a related rating of 5 moves the 80/80 Action candidate to 81 above Comedy 80", async () => {
    const requests = startJourney({});
    await screen.findByRole("heading", { name: "Recommended for you" }, { timeout: 5000 });
    expect(order()).toEqual(["Aardvark Comedy", "Zenith Action"]);

    await rateFromRecommendations(5);
    fireEvent.click(screen.getByRole("link", { name: "Back to recommendations" }));

    await waitFor(() => expect(order()).toEqual(["Zenith Action", "Aardvark Comedy"]));
    expect(scores("Zenith Action").popularity).toHaveTextContent("80");
    expect(scores("Zenith Action").ranking).toHaveTextContent("81");
    expect(scores("Aardvark Comedy").popularity).toHaveTextContent("80");
    expect(scores("Aardvark Comedy").ranking).toHaveTextContent("80");

    const putIndex = requests.findIndex((request) => request.method === "PUT");
    expect(requests.slice(putIndex + 1)
      .some((request) => request.url.startsWith("/api/me/recommendations"))).toBe(true);
  });

  it("changing the rating to 1 gives 79 and puts Comedy 80 first", async () => {
    startJourney({ "movie-a": 5 });
    await screen.findByRole("heading", { name: "Recommended for you" }, { timeout: 5000 });
    expect(order()).toEqual(["Zenith Action", "Aardvark Comedy"]);

    await rateFromRecommendations(1);
    fireEvent.click(screen.getByRole("link", { name: "Back to recommendations" }));

    await waitFor(() => expect(order()).toEqual(["Aardvark Comedy", "Zenith Action"]));
    expect(scores("Zenith Action").popularity).toHaveTextContent("80");
    expect(scores("Zenith Action").ranking).toHaveTextContent("79");
    expect(scores("Aardvark Comedy").ranking).toHaveTextContent("80");
  });

  it("returns to the same page, filter, query and hash after saving a rating", async () => {
    const list = "/recommendations?page=2&genreId=28&source=t34#results";
    const requests = startJourney({}, list);
    await rateFromRecommendations(5);
    expect(screen.getByRole("link", { name: "Back to recommendations" }))
      .toHaveAttribute("href", list);
    const beforeReturn = requests.length;
    fireEvent.click(screen.getByRole("link", { name: "Back to recommendations" }));

    await waitFor(() => expect(order()).toEqual(["Zenith Action", "Aardvark Comedy"]));
    expect(window.location.pathname).toBe("/recommendations");
    expect(window.location.search).toBe("?page=2&genreId=28&source=t34");
    expect(window.location.hash).toBe("#results");
    expect(scores("Zenith Action").ranking).toHaveTextContent("81");
    const refetch = requests.slice(beforeReturn)
      .filter((request) => request.url.startsWith("/api/me/recommendations"));
    expect(refetch).toHaveLength(1);
    expect(refetch[0].url).toContain("page=2");
    expect(refetch[0].url).toContain("genreId=28");
    expect(refetch[0].url).toContain("catalogueRevision=rev-1");
  });
});
