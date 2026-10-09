// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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

const popularMovies = Array.from({ length: 10 }, (_, index) => ({
  id: `popular-${index + 1}`,
  title: `Popular Movie ${index + 1}`,
  releaseYear: 2026 - index,
  genres: [{ id: 18, name: "Drama" }],
  popularityScore: 100 - index,
}));

function movieListResponse(movies = popularMovies) {
  return {
    data: { movies },
    meta: {
      count: movies.length,
      limit: 10,
      catalogueRevision: "revision-test",
    },
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("S3-T20 public popular-movie page", () => {
  it("opens for a guest, shows loading and renders ten movies in API order", async () => {
    window.history.pushState({}, "", "/popular");
    let resolveRequest: (response: Response) => void = () => undefined;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    render(<App />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading popular movies...");
    expect(window.location.pathname).toBe("/popular");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith("/api/movies/popular?limit=10");
    expect(fetchMock).not.toHaveBeenCalledWith("/api/auth/me", expect.anything());

    resolveRequest(
      new Response(JSON.stringify(movieListResponse()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(await screen.findByText("Popular Movie 10")).toBeInTheDocument();
    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(10);
    expect(
      cards.map((card) => within(card).getByRole("heading").textContent),
    ).toEqual(popularMovies.map((movie) => movie.title));
  });

  it("is reachable from the public catalogue navigation", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(() => jsonResponse(movieListResponse([])))
      .mockImplementationOnce(() => jsonResponse(movieListResponse(popularMovies.slice(0, 1))));

    render(<App />);

    fireEvent.click(await screen.findByRole("link", { name: "Popular movies" }));

    expect(window.location.pathname).toBe("/popular");
    expect(await screen.findByText("Popular Movie 1")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/movies/popular?limit=10");
  });

  it("shows the exact empty-state message", async () => {
    window.history.pushState({}, "", "/popular");
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(() =>
      jsonResponse(movieListResponse([])),
    );

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: "Popular movies are not available yet",
      }),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("article")).toHaveLength(0);
  });

  it("retries after an unavailable response", async () => {
    window.history.pushState({}, "", "/popular");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(() =>
        jsonResponse(
          {
            error: {
              code: "CATALOGUE_UNAVAILABLE",
              message: "Movie catalogue is unavailable",
            },
          },
          503,
        ),
      )
      .mockImplementationOnce(() =>
        jsonResponse(movieListResponse(popularMovies.slice(0, 1))),
      );

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Movie catalogue is unavailable",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Popular Movie 1")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/movies/popular?limit=10");
  });

  it("opens the selected movie detail using its internal id", async () => {
    window.history.pushState({}, "", "/popular");
    const selectedMovie = popularMovies[2];
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(() => jsonResponse(movieListResponse([selectedMovie])))
      .mockImplementationOnce(() =>
        jsonResponse({
          data: {
            movie: {
              ...selectedMovie,
              overview: "Popular movie detail.",
              voteAverage: 8.1,
              voteCount: 120,
            },
          },
          meta: { catalogueRevision: "revision-test" },
        }),
      );

    render(<App />);

    fireEvent.click(
      await screen.findByRole("link", {
        name: `View details for ${selectedMovie.title}`,
      }),
    );

    expect(window.location.pathname).toBe(`/movies/${selectedMovie.id}`);
    expect(await screen.findByText("Popular movie detail.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(2, `/api/movies/${selectedMovie.id}`);
  });

  it("does not overwrite preferences when a signed-in viewer opens the page", async () => {
    const savedGenreIds = [18, 28];
    const requests: Array<{ method: string; url: string }> = [];
    window.history.pushState({}, "", "/preferences");

    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const request = { method: init?.method ?? "GET", url: String(input) };
      requests.push(request);

      if (request.method === "GET" && request.url === "/api/auth/me") {
        return jsonResponse({
          data: { user: { id: "viewer-1", email: "viewer@example.com" } },
        });
      }
      if (
        request.method === "GET" &&
        request.url === "/api/movies/popular?limit=10"
      ) {
        return jsonResponse(movieListResponse(popularMovies.slice(0, 1)));
      }
      if (request.method === "PUT" && request.url === "/api/me/preferences") {
        savedGenreIds.splice(0);
      }

      return Promise.reject(
        new Error(`Unexpected request: ${request.method} ${request.url}`),
      );
    });

    render(<App />);
    expect(
      await screen.findByRole("heading", { name: "Movie Preferences" }),
    ).toBeInTheDocument();

    window.history.pushState({}, "", "/popular");
    fireEvent.popState(window);

    expect(await screen.findByText("Popular Movie 1")).toBeInTheDocument();
    expect(savedGenreIds).toEqual([18, 28]);
    expect(requests).toEqual([
      { method: "GET", url: "/api/auth/me" },
      { method: "GET", url: "/api/movies/popular?limit=10" },
    ]);
    await waitFor(() => expect(window.location.pathname).toBe("/popular"));
  });
});
