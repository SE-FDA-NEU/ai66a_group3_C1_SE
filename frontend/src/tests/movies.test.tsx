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
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementationOnce(() =>
      jsonResponse({
        data: { movies },
        meta: { count: 10, limit: 10, catalogueRevision: "revision-test" },
      }),
    );

    render(<App />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading movies...");
    expect(await screen.findByText("Movie 10")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(10);
    expect(fetchMock).toHaveBeenCalledWith("/api/movies?limit=10");
    expect(screen.getByText("Information unavailable")).toBeInTheDocument();
  });

  it("opens the selected movie detail route using its internal id", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(() =>
        jsonResponse({
          data: { movies },
          meta: { count: 10, limit: 10, catalogueRevision: "revision-test" },
        }),
      )
      .mockImplementationOnce(() =>
        jsonResponse({
          data: {
            movie: {
              ...movies[2],
              overview: "A local seeded movie.",
              voteAverage: 7.5,
              voteCount: 100,
            },
          },
          meta: { catalogueRevision: "revision-test" },
        }),
      );

    render(<App />);

    fireEvent.click(
      await screen.findByRole("link", { name: "View details for Movie 3" }),
    );

    expect(window.location.pathname).toBe("/movies/movie-3");
    expect(await screen.findByRole("heading", { name: "Movie 3" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/movies/movie-3");
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

    expect(await screen.findByRole("heading", { name: "Incomplete Movie" })).toBeInTheDocument();
    expect(screen.getAllByText("Information unavailable").length).toBeGreaterThanOrEqual(2);
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

    expect(await screen.findByRole("heading", { name: "Movie not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to catalogue" })).toHaveAttribute("href", "/");
  });

  it("retries the public catalogue request after an unavailable response", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(() =>
        jsonResponse(
          {
            error: {
              code: "CATALOGUE_UNAVAILABLE",
              message: "Movie catalogue is unavailable",
              requestId: "req-test",
            },
          },
          503,
        ),
      )
      .mockImplementationOnce(() =>
        jsonResponse({
          data: { movies },
          meta: { count: 10, limit: 10, catalogueRevision: "revision-test" },
        }),
      );

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Movie 10")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps public movie detail accessible without an auth request", async () => {
    window.history.pushState({}, "", "/movies/public-movie");

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementationOnce(() =>
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

    expect(await screen.findByRole("heading", { name: "Public Movie" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/movies/public-movie");
  });
});
