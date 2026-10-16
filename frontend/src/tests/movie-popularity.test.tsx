// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../App";
import { listPopularMovies } from "../api/movies.ts";
import { formatPopularityScore } from "../formatPopularity.ts";

const action = { id: 28, name: "Action" };

function movie(id: string, title: string, popularityScore: number | null) {
  return {
    id,
    title,
    releaseYear: 2024,
    genres: [action],
    popularityScore,
  };
}

function json(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function listBody(movies: unknown[]) {
  return {
    data: { movies },
    meta: { count: movies.length, limit: 10, catalogueRevision: "revision-test" },
  };
}

function detailBody(summary: ReturnType<typeof movie>) {
  return {
    data: {
      movie: {
        ...summary,
        overview: "Synthetic overview.",
        voteAverage: 7,
        voteCount: 10,
      },
    },
    meta: { catalogueRevision: "revision-test" },
  };
}

function popularityOf(container: HTMLElement) {
  return within(container).getByText("TMDb popularity").nextElementSibling
    ?.textContent;
}

function cardTitled(title: string) {
  return screen.getByRole("heading", { name: title }).closest("article")!;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("S3-T36 TMDb popularity formatting", () => {
  it.each([
    [95, "95"],
    [80, "80"],
    [0, "0"],
    [12.3456, "12.35"],
    [7.5, "7.5"],
    [1234.567, "1234.57"],
  ])("formats %s as %s", (score, expected) => {
    expect(formatPopularityScore(score)).toBe(expected);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["-Infinity", Number.NEGATIVE_INFINITY],
    ["a numeric string", "95"],
  ])("shows Information unavailable for %s", (_name, score) => {
    expect(formatPopularityScore(score)).toBe("Information unavailable");
  });

  it("keeps the original API number untouched while the display is rounded", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(() =>
      json(listBody([movie("a", "Movie A", 12.3456)])),
    );

    const [loaded] = await listPopularMovies();

    expect(loaded.popularityScore).toBe(12.3456);
    expect(formatPopularityScore(loaded.popularityScore)).toBe("12.35");
    expect(loaded.popularityScore).toBe(12.3456);
  });
});

describe("S3-T36 popularity on shared movie cards", () => {
  it("shows the label and score on the public catalogue for a guest", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() =>
        json(listBody([movie("a", "Movie A", 95), movie("b", "Movie B", 80)])),
      );

    render(<App />);

    expect(await screen.findByText("Movie A")).toBeInTheDocument();
    expect(popularityOf(cardTitled("Movie A"))).toBe("95");
    expect(popularityOf(cardTitled("Movie B"))).toBe("80");
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/me/")),
    ).toEqual([]);
  });

  it("keeps the backend order on /popular, 95 before 80, with no re-sorting", async () => {
    window.history.pushState({}, "", "/popular");
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(() =>
      json(listBody([movie("high", "High", 95), movie("low", "Low", 80)])),
    );

    render(<App />);

    await screen.findByText("High");
    const cards = screen.getAllByRole("article");
    expect(
      cards.map((card) => within(card).getByRole("heading").textContent),
    ).toEqual(["High", "Low"]);
    expect(cards.map(popularityOf)).toEqual(["95", "80"]);
  });

  it("preserves the backend tie-break order for equal scores", async () => {
    window.history.pushState({}, "", "/popular");
    // Deliberately not alphabetical and not by id: the server order is the truth.
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(() =>
      json(
        listBody([
          movie("m-2", "Zeta", 80),
          movie("m-3", "Alpha", 80),
          movie("m-1", "Beta", 80),
        ]),
      ),
    );

    render(<App />);

    await screen.findByText("Zeta");
    expect(
      screen
        .getAllByRole("article")
        .map((card) => within(card).getByRole("heading").textContent),
    ).toEqual(["Zeta", "Alpha", "Beta"]);
  });

  it("displays zero as a valid value and unavailable values without NaN", async () => {
    window.history.pushState({}, "", "/popular");
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(() =>
      json(
        listBody([
          movie("zero", "Zero", 0),
          movie("none", "None", null),
          movie("round", "Round", 12.3456),
        ]),
      ),
    );

    render(<App />);

    await screen.findByText("Zero");
    expect(popularityOf(cardTitled("Zero"))).toBe("0");
    expect(popularityOf(cardTitled("None"))).toBe("Information unavailable");
    expect(popularityOf(cardTitled("Round"))).toBe("12.35");
    expect(document.body.textContent).not.toMatch(/NaN|Infinity|%/);
  });

  it("shows popularity on personalised recommendation cards beside the genre reason", async () => {
    window.history.pushState({}, "", "/recommendations");
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url === "/api/auth/me") {
        return json({ data: { user: { id: "user-1", email: "v@example.com" } } });
      }
      if (url === "/api/genres") return json({ data: { genres: [action] } });
      if (url.startsWith("/api/me/recommendations")) {
        return json({
          data: {
            movies: [
              { ...movie("a", "Movie A", 90), reason: { matchedGenres: [action] } },
            ],
            mode: "personalised",
            personalised: true,
            noMatch: false,
          },
        });
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    render(<App />);

    await screen.findByText("Movie A");
    const card = cardTitled("Movie A");
    expect(popularityOf(card)).toBe("90");
    expect(card).toHaveTextContent("Matches your genres: Action");
  });
});

describe("S3-T36 popularity on the movie-details page", () => {
  it("shows the same label and value as the card for the same movie", async () => {
    window.history.pushState({}, "", "/popular");
    const selected = movie("a", "Movie A", 12.3456);
    vi.spyOn(globalThis, "fetch")
      .mockImplementationOnce(() => json(listBody([selected])))
      .mockImplementationOnce(() => json(detailBody(selected)))
      .mockImplementation((input) =>
        String(input) === "/api/auth/me"
          ? json({ error: { code: "AUTHENTICATION_REQUIRED" } }, 401)
          : Promise.reject(new Error(`Unexpected request: ${String(input)}`)),
      );

    render(<App />);

    const detailsLink = await screen.findByRole("link", {
      name: "View details for Movie A",
    });
    const cardValue = popularityOf(cardTitled("Movie A"));
    fireEvent.click(detailsLink);
    await screen.findByRole("heading", { level: 1, name: "Movie A" });

    expect(cardValue).toBe("12.35");
    expect(popularityOf(screen.getByRole("main"))).toBe(cardValue);
  });

  it.each([
    ["zero", 0, "0"],
    ["unavailable", null, "Information unavailable"],
  ])("shows a %s popularity value", async (_name, score, expected) => {
    window.history.pushState({}, "", "/movies/a");
    vi.spyOn(globalThis, "fetch")
      .mockImplementationOnce(() => json(detailBody(movie("a", "Movie A", score))))
      .mockImplementation(() =>
        json({ error: { code: "AUTHENTICATION_REQUIRED" } }, 401),
      );

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: "Movie A" });
    expect(popularityOf(screen.getByRole("main"))).toBe(expected);
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
  });

  it("keeps popularity separate from the account-owned Your rating control", async () => {
    window.history.pushState({}, "", "/movies/a");
    const requests: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      requests.push(url);
      if (url === "/api/movies/a") return json(detailBody(movie("a", "Movie A", 80)));
      if (url === "/api/auth/me") {
        return json({ data: { user: { id: "user-1", email: "v@example.com" } } });
      }
      if (url === "/api/me/ratings/a") {
        return json({ data: { movieId: "a", rating: 4 } });
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    render(<App />);

    await screen.findByText("Your saved rating: 4/5");
    expect(popularityOf(screen.getByRole("main"))).toBe("80");
    expect(
      screen.getByRole("heading", { name: "Your rating" }),
    ).toBeInTheDocument();
    expect(screen.getByText("TMDb popularity").closest(".movie-rating")).toBeNull();
  });

  it("does not request any personal rating for a guest", async () => {
    window.history.pushState({}, "", "/movies/a");
    const requests: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      requests.push(url);
      if (url === "/api/movies/a") return json(detailBody(movie("a", "Movie A", 95)));
      return json({ error: { code: "AUTHENTICATION_REQUIRED" } }, 401);
    });

    render(<App />);

    await screen.findByText("Sign in to save a rating to your account.");
    expect(popularityOf(screen.getByRole("main"))).toBe("95");
    expect(requests.some((url) => url.startsWith("/api/me/ratings"))).toBe(false);
  });
});
