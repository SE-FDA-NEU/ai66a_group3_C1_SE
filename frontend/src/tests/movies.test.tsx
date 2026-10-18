// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../App";

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

const movies = Array.from({ length: 10 }, (_, index) => ({
  id: `movie-${index + 1}`,
  title: `Movie ${index + 1}`,
  releaseYear: index === 0 ? null : 2000 + index,
  genres: [{ id: 28, name: "Action" }],
  popularityScore: 100 - index,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("T15 public catalogue UI", () => {
  it("loads ten public movie cards from the catalogue API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) =>
      String(input) === "/api/auth/me" ? jsonResponse({ error: { code: "AUTHENTICATION_REQUIRED" } }, 401) : jsonResponse({
        data: { movies },
        meta: { count: 10, limit: 10, page: 1, total: 10, totalPages: 1,
          unfilteredTotal: 10, catalogueRevision: "revision-test" },
      }),
    );

    render(<App />);

    expect(screen.getByText("Loading movies...")).toBeInTheDocument();
    expect(await screen.findByText("Movie 10")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(10);
    expect(fetchMock).toHaveBeenCalledWith("/api/movies?limit=10", expect.anything());
    expect(screen.getByText("Information unavailable")).toBeInTheDocument();
  });

  it("opens the selected movie detail route using its internal id", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url === "/api/auth/me") return jsonResponse({ error: { code: "AUTHENTICATION_REQUIRED" } }, 401);
      if (url === "/api/movies?limit=10") return jsonResponse({
          data: { movies },
          meta: { count: 10, limit: 10, catalogueRevision: "revision-test" },
        });
      if (url === "/api/movies/movie-3") return jsonResponse({
          data: {
            movie: {
              ...movies[2],
              overview: "A local seeded movie.",
              voteAverage: 7.5,
              voteCount: 100,
            },
          },
          meta: { catalogueRevision: "revision-test" },
        });
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    render(<App />);

    fireEvent.click(
      await screen.findByRole("link", { name: "View details for Movie 3" }),
    );

    expect(window.location.pathname).toBe("/movies/movie-3");
    expect(
      await screen.findByRole("heading", { name: "Movie 3" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/movies/movie-3");
  });

  it("shows unavailable text for missing detail year and overview", async () => {
    window.history.pushState({}, "", "/movies/incomplete");

    vi.spyOn(globalThis, "fetch").mockImplementationOnce(() =>
      jsonResponse({
        data: {
          movie: {
            id: "incomplete",
            title: "Incomplete Movie",
            releaseYear: null,
            genres: [],
            overview: null,
            popularityScore: null,
            voteAverage: null,
            voteCount: null,
          },
        },
        meta: { catalogueRevision: "revision-test" },
      }),
    );

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Incomplete Movie" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Information unavailable").length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("shows the documented not-found state for an unknown movie id", async () => {
    window.history.pushState({}, "", "/movies/does-not-exist");

    vi.spyOn(globalThis, "fetch").mockImplementationOnce(() =>
      jsonResponse(
        {
          error: {
            code: "MOVIE_NOT_FOUND",
            message: "Movie not found",
            requestId: "req-test",
          },
        },
        404,
      ),
    );

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Movie not found" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Return to catalogue" }),
    ).toHaveAttribute("href", "/");
  });

  it("retries the public catalogue request after an unavailable response", async () => {
    let attempt = 0;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      if (String(input) === "/api/auth/me") return jsonResponse({ error: { code: "AUTHENTICATION_REQUIRED" } }, 401);
      attempt += 1;
      return attempt === 1 ? jsonResponse(
          {
            error: {
              code: "CATALOGUE_UNAVAILABLE",
              message: "Movie catalogue is unavailable",
              requestId: "req-test",
            },
          },
          503,
        ) : jsonResponse({
          data: { movies },
          meta: { count: 10, limit: 10, catalogueRevision: "revision-test" },
        });
    });

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Movie 10")).toBeInTheDocument();
    expect(attempt).toBe(2);
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/me", expect.anything());
  });

  it("keeps public details accessible after session checking without private rating requests", async () => {
    window.history.pushState({}, "", "/movies/public-movie");

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((input) => {
        if (String(input) === "/api/auth/me")
          return jsonResponse(
            { error: { code: "AUTHENTICATION_REQUIRED" } },
            401,
          );
        return Promise.reject(
          new Error(`Unexpected private request: ${String(input)}`),
        );
      })
      .mockImplementationOnce(() =>
        jsonResponse({
          data: {
            movie: {
              id: "public-movie",
              title: "Public Movie",
              releaseYear: 2025,
              genres: [{ id: 18, name: "Drama" }],
              overview: "Public detail.",
              popularityScore: 10,
              voteAverage: 8,
              voteCount: 20,
            },
          },
          meta: { catalogueRevision: "revision-test" },
        }),
      );

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Public Movie" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("link", { name: "Sign in to rate this movie" }),
    ).toHaveAttribute("href", "/login");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith("/api/movies/public-movie");
  });
});
