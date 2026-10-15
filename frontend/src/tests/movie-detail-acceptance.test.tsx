// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../App";

type Genre = { id: number; name: string };
type CatalogueMovie = {
  id: string;
  title: string;
  releaseYear: number | null;
  genres: Genre[];
  overview: string | null;
  popularityScore: number;
  voteAverage: number;
  voteCount: number;
};

const action: Genre = { id: 28, name: "Action" };
const comedy: Genre = { id: 35, name: "Comedy" };
const drama: Genre = { id: 18, name: "Drama" };
const account = { id: "account-a", email: "a@example.com" };

const movieA: CatalogueMovie = {
  id: "movie-a",
  title: "Movie A",
  releaseYear: 2025,
  genres: [action, drama],
  overview: "A recommendation worth considering.",
  popularityScore: 95,
  voteAverage: 8.2,
  voteCount: 120,
};
const movieB: CatalogueMovie = {
  id: "movie-b",
  title: "Movie B",
  releaseYear: 2024,
  genres: [comedy],
  overview: "A comedy outside the saved genres.",
  popularityScore: 90,
  voteAverage: 7.1,
  voteCount: 80,
};

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

/**
 * A stateful stand-in for the API. Saved genres live in `savedGenreIds`, so a
 * second render of <App /> (a page refresh) reads what the first one wrote.
 */
function installServer(options?: {
  movies?: CatalogueMovie[];
  savedGenreIds?: number[];
}) {
  const movies = options?.movies ?? [movieA, movieB];
  const catalogueGenres = [action, comedy, drama];
  const state = {
    savedGenreIds: [...(options?.savedGenreIds ?? [])],
    unavailableMovieIds: new Set<string>(),
    requests: [] as string[],
  };

  vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const method = init?.method ?? "GET";
    const url = String(input);
    state.requests.push(`${method} ${url}`);

    const savedGenres = () =>
      catalogueGenres.filter((genre) => state.savedGenreIds.includes(genre.id));

    if (method === "GET" && url === "/api/auth/me") {
      return jsonResponse({ data: { user: account } });
    }
    if (method === "GET" && url === "/api/genres") {
      return jsonResponse({ data: { genres: catalogueGenres } });
    }
    if (method === "GET" && url === "/api/me/preferences") {
      return jsonResponse({ data: { genres: savedGenres() } });
    }
    if (method === "PUT" && url === "/api/me/preferences") {
      const body = JSON.parse(String(init?.body)) as { genreIds: number[] };
      state.savedGenreIds = [...body.genreIds];
      return jsonResponse({ data: { genres: savedGenres() } });
    }
    if (method === "GET" && url === "/api/me/recommendations?limit=10") {
      const ranked = [...movies]
        .sort((first, second) => second.popularityScore - first.popularityScore)
        .map((movie) => ({
          ...movie,
          reason: {
            matchedGenres: movie.genres.filter((genre) =>
              state.savedGenreIds.includes(genre.id),
            ),
          },
        }))
        .filter((movie) => movie.reason.matchedGenres.length > 0);

      return jsonResponse({
        data: {
          movies: ranked,
          mode: ranked.length > 0 ? "personalised" : "popular",
          personalised: ranked.length > 0,
          noMatch: false,
        },
      });
    }
    if (method === "GET" && url.startsWith("/api/movies/")) {
      const movieId = decodeURIComponent(url.slice("/api/movies/".length));
      const movie = movies.find((candidate) => candidate.id === movieId);

      if (!movie || state.unavailableMovieIds.has(movieId)) {
        return jsonResponse(
          {
            error: {
              code: "MOVIE_NOT_FOUND",
              message: "Movie not found",
              requestId: "req-test",
            },
          },
          404,
        );
      }
      return jsonResponse({ data: { movie } });
    }

    return Promise.reject(new Error(`Unexpected request: ${method} ${url}`));
  });

  return state;
}

/** Equivalent to pressing F5: React state is discarded, the URL and server stay. */
function refreshPage() {
  cleanup();
  render(<App />);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("S3-T18 movie-detail acceptance (Story #19)", () => {
  it("keeps the account's saved genres through the whole preference-to-detail journey", async () => {
    const server = installServer();
    window.history.pushState({}, "", "/preferences");
    render(<App />);

    // Preference step: choose genres in the real picker and save them.
    fireEvent.click(await screen.findByRole("checkbox", { name: "Action" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Drama" }));
    fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));

    expect(
      await screen.findByRole("heading", { name: "Recommended for you" }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/recommendations");
    expect(server.savedGenreIds).toEqual([drama.id, action.id]);
    expect(
      screen.queryByRole("link", { name: "View details for Movie B" }),
    ).not.toBeInTheDocument();

    // AC1: View details opens the card's own route with all four fields.
    fireEvent.click(
      screen.getByRole("link", { name: "View details for Movie A" }),
    );

    expect(window.location.pathname).toBe("/movies/movie-a");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Movie A" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Year").nextElementSibling).toHaveTextContent("2025");
    expect(screen.getByText("Genres").nextElementSibling).toHaveTextContent(
      "Action, Drama",
    );
    expect(
      screen.getByText("A recommendation worth considering."),
    ).toBeInTheDocument();

    // AC4: returning continues the flow for the same signed-in account.
    fireEvent.click(
      screen.getByRole("link", { name: "Back to recommendations" }),
    );

    expect(window.location.pathname).toBe("/recommendations");
    expect(
      await screen.findByRole("heading", { name: "Recommended for you" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View details for Movie A" }),
    ).toBeInTheDocument();

    // Refresh on the list restores the personalised flow from the account.
    refreshPage();
    expect(
      await screen.findByRole("heading", { name: "Recommended for you" }),
    ).toBeInTheDocument();

    // Refresh on the picker restores the saved genres, not an empty form.
    window.history.pushState({}, "", "/preferences");
    refreshPage();
    expect(await screen.findByRole("checkbox", { name: "Action" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Drama" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Comedy" })).not.toBeChecked();
    expect(screen.getByText("2 of 5 selected")).toBeInTheDocument();

    // Only the first save wrote preferences; the detail round trip did not.
    expect(server.savedGenreIds).toEqual([drama.id, action.id]);
    expect(
      server.requests.filter((request) => request.startsWith("PUT ")),
    ).toEqual(["PUT /api/me/preferences"]);
  });

  it.each([
    [
      "year",
      { releaseYear: null },
      {
        year: "Information unavailable",
        genres: "Action, Drama",
        overview: "A recommendation worth considering.",
      },
    ],
    [
      "summary",
      { overview: null },
      {
        year: "2025",
        genres: "Action, Drama",
        overview: "Information unavailable",
      },
    ],
  ])(
    "shows Information unavailable only for the missing %s (AC3)",
    async (_missingField, patch, expected) => {
      installServer({ movies: [{ ...movieA, ...patch }] });
      window.history.pushState({}, "", "/movies/movie-a");
      render(<App />);

      expect(
        await screen.findByRole("heading", { level: 1, name: "Movie A" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Year").nextElementSibling?.textContent).toBe(
        expected.year,
      );
      expect(screen.getByText("Genres").nextElementSibling?.textContent).toBe(
        expected.genres,
      );
      expect(
        screen.getByRole("heading", { name: "Overview" }).nextElementSibling
          ?.textContent,
      ).toBe(expected.overview);
      expect(screen.getAllByText("Information unavailable")).toHaveLength(1);
    },
  );

  it("shows Movie not found with a way back to the list the viewer came from (AC2)", async () => {
    const server = installServer({ savedGenreIds: [action.id] });
    window.history.pushState({}, "", "/recommendations");
    render(<App />);

    const card = await screen.findByRole("link", {
      name: "View details for Movie A",
    });
    // The catalogue changed after the list was loaded.
    server.unavailableMovieIds.add("movie-a");
    fireEvent.click(card);

    expect(
      await screen.findByRole("heading", { name: "Movie not found" }),
    ).toBeInTheDocument();
    const backLink = screen.getByRole("link", { name: "Back to recommendations" });
    expect(backLink).toHaveAttribute("href", "/recommendations");

    fireEvent.click(backLink);
    expect(window.location.pathname).toBe("/recommendations");
    expect(
      await screen.findByRole("heading", { name: "Recommended for you" }),
    ).toBeInTheDocument();
    expect(server.savedGenreIds).toEqual([action.id]);
  });
});
