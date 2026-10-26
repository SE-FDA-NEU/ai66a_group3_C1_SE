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

  it("advances the generation only after the save is committed", async () => {
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

describe("S4-T04 save-to-rerank journey", () => {
  // The fake server owns the ranking rule so the browser only displays its order.
  function startJourney(ratings: Record<string, number>) {
    const requests: Array<{ method: string; url: string }> = [];
    const detail = {
      id: "movie-a", title: "Zenith Action", releaseYear: 2024, genres: [action],
      popularityScore: 80, overview: "An action film.", voteAverage: 7, voteCount: 10,
    };

    function recommendations() {
      const rating = ratings["movie-a"];
      const adjustment = rating === undefined || rating === 3 ? 0 : rating >= 4 ? 1 : -1;
      const basis = adjustment === 0 ? "baseline" : "rating_signals";
      const movies = [
        { id: "movie-a", title: "Zenith Action", releaseYear: 2024, genres: [action],
          popularityScore: 80, ratingAdjustment: adjustment, adjustedScore: 80 + adjustment,
          basis, reason: { matchedGenres: [action] } },
        { id: "movie-b", title: "Aardvark Comedy", releaseYear: 2024, genres: [comedy, action],
          popularityScore: 80, ratingAdjustment: 0, adjustedScore: 80,
          basis: "baseline", reason: { matchedGenres: [action] } },
      ].sort((x, y) => y.adjustedScore - x.adjustedScore || x.title.localeCompare(y.title));
      return { data: { movies, mode: "personalised", personalised: true, noMatch: false } };
    }

    window.history.pushState({}, "", "/recommendations");
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const method = init?.method ?? "GET";
      const url = String(input);
      requests.push({ method, url });
      if (url === "/api/auth/me")
        return json({ data: { user: { id: "account-a", email: "a@example.com" } } });
      if (url === "/api/genres") return json({ data: { genres: [action, comedy] } });
      if (url.startsWith("/api/me/recommendations")) return json(recommendations());
      if (url === "/api/movies/movie-a") return json({ data: { movie: detail } });
      if (url === "/api/me/watchlist/movie-a")
        return json({ data: { movieId: "movie-a", inWatchlist: false } });
      if (url === "/api/me/ratings/movie-a") {
        if (method === "PUT") {
          const rating = JSON.parse(String(init?.body)).rating as number;
          ratings["movie-a"] = rating;
          return json({ data: { movieId: "movie-a", rating } });
        }
        return json({ data: { movieId: "movie-a", rating: ratings["movie-a"] ?? null } });
      }
      return Promise.reject(new Error(`Unexpected request: ${method} ${url}`));
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

  it("a related rating of 5 moves the 80/80 Action candidate to 81 above Comedy 80", async () => {
    const requests = startJourney({});
    await screen.findByRole("heading", { name: "Recommended for you" }, { timeout: 5000 });
    expect(order()).toEqual(["Aardvark Comedy", "Zenith Action"]);

    await rateFromRecommendations(5);
    fireEvent.click(screen.getByRole("link", { name: "Back to recommendations" }));

    await waitFor(() => expect(order()).toEqual(["Zenith Action", "Aardvark Comedy"]));
    const boosted = screen.getByRole("heading", { name: "Zenith Action" }).closest("article")!;
    expect(within(boosted).getByText("TMDb popularity").nextElementSibling).toHaveTextContent("80");
    expect(within(boosted).getByText("Ranking score for you").nextElementSibling)
      .toHaveTextContent("81");

    const putIndex = requests.findIndex((request) => request.method === "PUT");
    const refetchedAfterSave = requests.slice(putIndex + 1)
      .some((request) => request.url.startsWith("/api/me/recommendations"));
    expect(refetchedAfterSave).toBe(true);
  });

  it("changing the rating to 1 gives 79 and puts Comedy 80 first", async () => {
    startJourney({ "movie-a": 5 });
    await screen.findByRole("heading", { name: "Recommended for you" }, { timeout: 5000 });
    expect(order()).toEqual(["Zenith Action", "Aardvark Comedy"]);

    await rateFromRecommendations(1);
    fireEvent.click(screen.getByRole("link", { name: "Back to recommendations" }));

    await waitFor(() => expect(order()).toEqual(["Aardvark Comedy", "Zenith Action"]));
    const lowered = screen.getByRole("heading", { name: "Zenith Action" }).closest("article")!;
    expect(within(lowered).getByText("TMDb popularity").nextElementSibling).toHaveTextContent("80");
    expect(within(lowered).getByText("Ranking score for you").nextElementSibling)
      .toHaveTextContent("79");
  });
});
