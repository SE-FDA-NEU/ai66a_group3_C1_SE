// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../App";
import { RecommendationState } from "../pages/RecommendationsPage";

const action = { id: 28, name: "Action" };
const drama = { id: 18, name: "Drama" };

function movie(id: string, title: string, popularityScore: number, matchedGenres = [action]) {
  return {
    id,
    title,
    releaseYear: 2024,
    genres: [action, drama],
    popularityScore,
    reason: { matchedGenres },
  };
}

function popularBody(movies: unknown[], noMatch = false) {
  return { data: { movies, mode: "popular", personalised: false, noMatch } };
}

function personalisedBody(movies: unknown[]) {
  return { data: { movies, mode: "personalised", personalised: true, noMatch: false } };
}

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function renderRecommendations(recommendations: () => Promise<Response>) {
  window.history.pushState({}, "", "/recommendations");
  const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url = String(input);

    if (url === "/api/auth/me") {
      return jsonResponse({ data: { user: { id: "user-1", email: "viewer@example.com" } } });
    }
    if (url.startsWith("/api/me/recommendations")) {
      return recommendations();
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });

  render(<App />);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("T10 recommendation cards", () => {
  it("requests the protected API and shows popular cards in server order", async () => {
    const fetchMock = renderRecommendations(() =>
      jsonResponse(
        popularBody([
          movie("movie-a", "Movie A", 90, []),
          movie("movie-b", "Movie B", 80, []),
          movie("movie-c", "Movie C", 80, []),
        ]),
      ),
    );

    expect(await screen.findByRole("heading", { name: "Popular" })).toBeInTheDocument();
    expect(screen.getByText("Not personalised")).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(["Popular", "Movie A", "Movie B", "Movie C"]);
    expect(screen.queryByText(/Matches your genres/)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/me/recommendations?limit=10",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("does not sort the response again in the browser", async () => {
    renderRecommendations(() =>
      jsonResponse(
        popularBody([
          movie("movie-c", "Movie C", 80, []),
          movie("movie-a", "Movie A", 90, []),
          movie("movie-b", "Movie B", 80, []),
        ]),
      ),
    );

    await screen.findByText("Movie C");

    expect(
      screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(["Popular", "Movie C", "Movie A", "Movie B"]);
  });

  it("shows genres and matched-genre reasons for personalised results", async () => {
    renderRecommendations(() =>
      jsonResponse(
        personalisedBody([
          movie("movie-a", "Movie A", 90, [action]),
          movie("movie-b", "Movie B", 80, [action, drama]),
        ]),
      ),
    );

    expect(await screen.findByRole("heading", { name: "Recommended for you" })).toBeInTheDocument();
    expect(screen.queryByText("Not personalised")).not.toBeInTheDocument();
    expect(screen.getByText("Matches your genres: Action")).toBeInTheDocument();
    expect(screen.getByText("Matches your genres: Action · Drama")).toBeInTheDocument();
    expect(screen.getAllByText("Action · Drama")).toHaveLength(2);
  });

  it("links every card to its own movie detail", async () => {
    renderRecommendations(() =>
      jsonResponse(popularBody([movie("movie-a", "Movie A", 90, []), movie("movie-b", "Movie B", 80, [])])),
    );

    expect(await screen.findByRole("link", { name: "View details for Movie A" })).toHaveAttribute(
      "href",
      "/movies/movie-a",
    );
    expect(screen.getByRole("link", { name: "View details for Movie B" })).toHaveAttribute(
      "href",
      "/movies/movie-b",
    );
  });

  it("shows loading while the request is pending", async () => {
    renderRecommendations(() => new Promise<Response>(() => undefined));

    expect(await screen.findByRole("status")).toHaveTextContent("Loading recommendations...");
    expect(document.querySelectorAll(".movie-card")).toHaveLength(0);
  });

  it("renders zero cards and the empty state when the result is empty", async () => {
    renderRecommendations(() => jsonResponse(popularBody([])));

    expect(await screen.findByRole("heading", { name: "No recommendations available yet." })).toBeInTheDocument();
    expect(document.querySelectorAll(".movie-card")).toHaveLength(0);
    expect(screen.getByRole("link", { name: "Enter preferences →" })).toHaveAttribute(
      "href",
      "/preferences",
    );
  });

  it("sends the visitor to login when the protected API reports 401", async () => {
    renderRecommendations(() =>
      jsonResponse(
        { error: { code: "AUTHENTICATION_REQUIRED", message: "Authentication required" } },
        401,
      ),
    );

    await waitFor(() => expect(window.location.pathname).toBe("/login"));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(document.querySelectorAll(".movie-card")).toHaveLength(0);
  });

  it("shows the API message, not an empty result, when the request fails", async () => {
    renderRecommendations(() =>
      jsonResponse(
        { error: { code: "SERVICE_UNAVAILABLE", message: "Service is temporarily unavailable" } },
        503,
      ),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Service is temporarily unavailable");
    expect(screen.queryByRole("heading", { name: "No recommendations available yet." })).not.toBeInTheDocument();
    expect(document.querySelectorAll(".movie-card")).toHaveLength(0);
  });

  it("renders the loading state component", () => {
    render(<RecommendationState status="loading" />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading recommendations...");
  });
});
