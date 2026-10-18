// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../App";
import { resolveMovieDetailReturn } from "../navigation/movieDetailReturn.ts";
import MovieDetailPage from "../pages/MovieDetailPage.tsx";
import { AuthProvider } from "../auth/AuthContext.tsx";

const action = { id: 28, name: "Action" };
const drama = { id: 18, name: "Drama" };
const recommendation = {
  id: "movie-a",
  title: "Movie A",
  releaseYear: 2025,
  genres: [action, drama],
  popularityScore: 95,
  reason: { matchedGenres: [action] },
};
const detail = {
  ...recommendation,
  overview: "A recommendation worth considering.",
  voteAverage: 8.2,
  voteCount: 120,
};

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("S3-T17 movie-detail return context", () => {
  it("returns to the current account's recommendation flow without changing preferences", async () => {
    const requests: Array<{ method: string; url: string }> = [];
    const savedPreferenceIds = [action.id, drama.id];
    window.history.pushState({}, "", "/recommendations");

    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const request = {
        method: init?.method ?? "GET",
        url: String(input),
      };
      requests.push(request);

      if (request.method === "GET" && request.url === "/api/auth/me") {
        return jsonResponse({
          data: { user: { id: "account-a", email: "a@example.com" } },
        });
      }
      if (
        request.method === "GET" &&
        request.url === "/api/me/recommendations?limit=10"
      ) {
        return jsonResponse({
          data: {
            movies: [recommendation],
            mode: "personalised",
            personalised: true,
            noMatch: false,
          },
        });
      }
      if (request.method === "GET" && request.url === "/api/genres") {
        return jsonResponse({ data: { genres: [action, drama] } });
      }
      if (request.method === "GET" && request.url === "/api/movies/movie-a") {
        return jsonResponse({ data: { movie: detail } });
      }
      if (request.url === "/api/me/ratings/movie-a")
        return jsonResponse({ data: { movieId: "movie-a", rating: null } });
      if (request.method === "PUT" && request.url === "/api/me/preferences") {
        savedPreferenceIds.splice(0);
        return jsonResponse({ data: { genres: [] } });
      }

      return Promise.reject(
        new Error(`Unexpected request: ${request.method} ${request.url}`),
      );
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Recommended for you" }, { timeout: 5000 }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("link", { name: "View details for Movie A" }),
    );

    expect(window.location.pathname).toBe("/movies/movie-a");
    expect(window.history.state.usr).toEqual({ returnTo: "/recommendations" });
    expect(
      await screen.findByText("A recommendation worth considering."),
    ).toBeInTheDocument();

    const backLink = screen.getByRole("link", {
      name: "Back to recommendations",
    });
    expect(backLink).toHaveAttribute("href", "/recommendations");
    fireEvent.click(backLink);

    expect(window.location.pathname).toBe("/recommendations");
    expect(
      await screen.findByRole("heading", { name: "Recommended for you" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Matches your genres: Action")).toBeInTheDocument();
    expect(savedPreferenceIds).toEqual([action.id, drama.id]);
    expect(
      requests.filter(
        (request) => request.url === "/api/me/recommendations?limit=10",
      ),
    ).toHaveLength(2);
    expect(
      requests.some(
        (request) =>
          request.method === "PUT" && request.url === "/api/me/preferences",
      ),
    ).toBe(false);
  });

  it("preserves recommendation return context for no-match alternatives", async () => {
    window.history.pushState(
      {},
      "",
      "/recommendations?source=no-match#alternatives",
    );

    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const method = init?.method ?? "GET";
      const url = String(input);

      if (method === "GET" && url === "/api/auth/me") {
        return jsonResponse({
          data: { user: { id: "account-a", email: "a@example.com" } },
        });
      }
      if (method === "GET" && url === "/api/me/recommendations?limit=10") {
        return jsonResponse({
          data: {
            movies: [{ ...recommendation, reason: { matchedGenres: [] } }],
            mode: "popular",
            personalised: false,
            noMatch: true,
          },
        });
      }
      if (method === "GET" && url === "/api/genres") {
        return jsonResponse({ data: { genres: [action, drama] } });
      }
      if (method === "GET" && url === "/api/movies/movie-a") {
        return jsonResponse({ data: { movie: detail } });
      }
      if (url === "/api/me/ratings/movie-a")
        return jsonResponse({ data: { movieId: "movie-a", rating: null } });
      return Promise.reject(new Error(`Unexpected request: ${method} ${url}`));
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Popular alternatives" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Filter by genre" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("link", { name: "View details for Movie A" }),
    );

    expect(window.location.pathname).toBe("/movies/movie-a");
    expect(window.history.state.usr).toEqual({
      returnTo: "/recommendations?source=no-match#alternatives",
    });
    expect(
      await screen.findByRole("link", { name: "Back to recommendations" }),
    ).toHaveAttribute("href", "/recommendations?source=no-match#alternatives");
  });

  it("uses the catalogue fallback when a detail route is opened directly", async () => {
    window.history.pushState({}, "", "/movies/movie-a");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((input) => {
        if (String(input) === "/api/auth/me") return jsonResponse({}, 401);
        if (String(input) === "/api/movies?limit=10")
          return jsonResponse({ data: { movies: [recommendation] },
            meta: { count: 1, limit: 10, page: 1, total: 1, totalPages: 1,
              unfilteredTotal: 1, catalogueRevision: "revision" } });
        return Promise.reject(
          new Error(`Unexpected request: ${String(input)}`),
        );
      })
      .mockImplementationOnce(() => jsonResponse({ data: { movie: detail } }));
    render(<App />);

    const returnLink = await screen.findByRole("link", {
      name: "Return to catalogue",
    });
    expect(returnLink).toHaveAttribute("href", "/");
    fireEvent.click(returnLink);

    expect(window.location.pathname).toBe("/");
    expect(
      await screen.findByRole("heading", { name: "Find your next movie" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/movies/movie-a");
    expect(fetchMock).toHaveBeenCalledWith("/api/movies?limit=10", expect.anything());
  });

  it("rejects an external return URL before rendering the detail back link", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(() =>
      jsonResponse({ data: { movie: detail } }),
    );

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/movies/movie-a",
            state: { returnTo: "https://evil.example/steal-session" },
          },
        ]}
      >
        <AuthProvider>
          <Routes>
            <Route path="/movies/:movieId" element={<MovieDetailPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    const returnLink = await screen.findByRole("link", {
      name: "Return to catalogue",
    });
    expect(returnLink).toHaveAttribute("href", "/");
    expect(returnLink).not.toHaveAttribute(
      "href",
      "https://evil.example/steal-session",
    );
  });

  it.each([
    "//evil.example/steal-session",
    "javascript:alert(1)",
    "https://evil.example/steal-session",
    "/profile",
    "/recommendations\\evil.example",
  ])("falls back for unsafe return target %s", (returnTo) => {
    expect(resolveMovieDetailReturn({ returnTo })).toEqual({
      label: "Return to catalogue",
      to: "/",
    });
  });

  it("preserves query and fragment context on an allowed internal list", () => {
    expect(
      resolveMovieDetailReturn({
        returnTo: "/recommendations?source=saved#results",
      }),
    ).toEqual({
      label: "Back to recommendations",
      to: "/recommendations?source=saved#results",
    });
  });
});
