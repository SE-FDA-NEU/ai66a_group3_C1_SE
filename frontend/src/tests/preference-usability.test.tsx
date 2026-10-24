// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../App";

const NETWORK_MESSAGE =
  "We can't reach the server. Check your connection, then try again.";
const user = { id: "user-1", email: "viewer@example.com" };
const genres = [
  { id: 28, name: "Action" },
  { id: 35, name: "Comedy" },
  { id: 18, name: "Drama" },
  { id: 27, name: "Horror" },
  { id: 10749, name: "Romance" },
  { id: 878, name: "Science Fiction" },
];
const movie = {
  id: "movie-a",
  title: "Movie A",
  releaseYear: 2025,
  genres: [genres[0]],
  popularityScore: 90,
  reason: { matchedGenres: [genres[0]] },
};

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function htmlResponse(status: number) {
  return Promise.resolve(
    new Response("<html>Bad gateway</html>", {
      status,
      headers: { "Content-Type": "text/html" },
    }),
  );
}

type Handler = (init?: RequestInit) => Promise<Response>;

/** Every route answers with a success body unless `overrides` replaces it. */
function installApi(overrides: Record<string, Handler[]> = {}) {
  const queues = Object.fromEntries(
    Object.entries(overrides).map(([key, handlers]) => [key, [...handlers]]),
  );
  const requests: string[] = [];

  vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const method = init?.method ?? "GET";
    const key = `${method} ${String(input)}`;
    requests.push(key);

    const queued = queues[key]?.shift();
    if (queued) {
      return queued(init);
    }
    if (key === "GET /api/auth/me") {
      return jsonResponse({ data: { user } });
    }
    if (key === "GET /api/genres") {
      return jsonResponse({ data: { genres } });
    }
    if (key === "GET /api/me/preferences") {
      return jsonResponse({ data: { genres: [] } });
    }
    if (key === "PUT /api/me/preferences") {
      const body = JSON.parse(String(init?.body)) as { genreIds: number[] };
      return jsonResponse({
        data: { genres: genres.filter((genre) => body.genreIds.includes(genre.id)) },
      });
    }
    if (key === "GET /api/me/recommendations?limit=10") {
      return jsonResponse({
        data: {
          movies: [movie],
          mode: "personalised",
          personalised: true,
          noMatch: false,
        },
      });
    }
    if (key === "GET /api/movies?limit=10") {
      return jsonResponse({ data: { movies: [] }, meta: { count: 0, limit: 10 } });
    }

    return Promise.reject(new Error(`Unexpected request: ${key}`));
  });

  return { requests };
}

function open(path: string) {
  window.history.pushState({}, "", path);
  render(<App />);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("S3-T24 preference and recommendation controls", () => {
  describe("visible purpose and navigation", () => {
    it("explains Start on the home page and links to the saved recommendations", async () => {
      installApi();
      open("/");

      const start = await screen.findByRole("link", { name: "Start" });
      expect(start).toHaveAccessibleDescription(
        /choose your favourite genres for personalised recommendations/i,
      );

      fireEvent.click(screen.getByRole("link", { name: "My recommendations" }));
      expect(window.location.pathname).toBe("/recommendations");
      expect(
        await screen.findByRole("heading", { name: "Recommended for you" }),
      ).toBeInTheDocument();
    });

    it("reaches preferences and the catalogue from a non-empty recommendation list", async () => {
      installApi();
      open("/recommendations");

      await screen.findByRole("link", { name: "View details for Movie A" });
      const nav = screen.getByRole("navigation", {
        name: "Recommendation navigation",
      });

      expect(nav).toHaveTextContent("Change my genres");
      fireEvent.click(screen.getByRole("link", { name: "Change my genres" }));
      expect(window.location.pathname).toBe("/preferences");
      expect(
        await screen.findByRole("checkbox", { name: "Action" }),
      ).toBeInTheDocument();
    });

    it("lets the picker go back to recommendations or the catalogue without a typed route", async () => {
      installApi();
      open("/preferences");

      await screen.findByRole("checkbox", { name: "Action" });
      const nav = screen.getByRole("navigation", {
        name: "Preference navigation",
      });

      expect(
        nav.querySelector('a[href="/recommendations"]'),
      ).toHaveTextContent("Back to recommendations");
      expect(nav.querySelector('a[href="/"]')).toHaveTextContent(
        "Browse the catalogue",
      );

      fireEvent.click(screen.getByRole("link", { name: "Back to recommendations" }));
      expect(window.location.pathname).toBe("/recommendations");
    });
  });

  describe("keyboard and labels", () => {
    it("names every genre control, groups them, and keeps Save focusable and enabled", async () => {
      installApi();
      open("/preferences");

      const group = await screen.findByRole("group", { name: "Favourite genres" });
      expect(group).toHaveAccessibleDescription(
        /Choose 1 to 5 favourite genres.*0 of 5 selected/s,
      );
      for (const genre of genres) {
        const checkbox = screen.getByRole("checkbox", { name: genre.name });
        checkbox.focus();
        expect(checkbox).toHaveFocus();
      }

      // A disabled button leaves the tab order, so zero selections must keep
      // Save enabled for keyboard and screen-reader users to reach it.
      const save = screen.getByRole("button", { name: "Save preferences" });
      expect(save).toBeEnabled();
      save.focus();
      expect(save).toHaveFocus();
    });
  });

  describe("validation messages", () => {
    it("asks for a genre, stays on the page, sends nothing, and clears once a genre is chosen", async () => {
      const { requests } = installApi();
      open("/preferences");

      await screen.findByRole("checkbox", { name: "Action" });
      fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(
        "Select at least one genre (up to 5), then choose Save preferences.",
      );
      expect(window.location.pathname).toBe("/preferences");
      expect(requests).not.toContain("PUT /api/me/preferences");
      expect(
        screen.getByRole("group", { name: "Favourite genres" }),
      ).toHaveAccessibleDescription(/Select at least one genre/);

      fireEvent.click(screen.getByRole("checkbox", { name: "Action" }));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("tells the viewer how to change a full selection", async () => {
      installApi();
      open("/preferences");

      await screen.findByRole("checkbox", { name: "Action" });
      for (const genre of genres.slice(0, 5)) {
        fireEvent.click(screen.getByRole("checkbox", { name: genre.name }));
      }
      fireEvent.click(screen.getByRole("checkbox", { name: "Science Fiction" }));

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Your previous 5 selections are still selected. Clear one genre to choose a different one.",
      );
    });
  });

  describe("recoverable failures keep the draft", () => {
    it("keeps the draft after a service error and saves on the next attempt", async () => {
      installApi({
        "PUT /api/me/preferences": [
          () =>
            jsonResponse(
              {
                error: {
                  code: "SERVICE_UNAVAILABLE",
                  message: "Service is temporarily unavailable",
                },
              },
              503,
            ),
        ],
      });
      open("/preferences");

      fireEvent.click(await screen.findByRole("checkbox", { name: "Drama" }));
      fireEvent.click(screen.getByRole("checkbox", { name: "Horror" }));
      fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Service is temporarily unavailable");
      expect(alert).toHaveTextContent(
        "Your selections are kept. Choose Save preferences to try again.",
      );
      expect(screen.getByRole("checkbox", { name: "Drama" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Horror" })).toBeChecked();

      const save = screen.getByRole("button", { name: "Save preferences" });
      expect(save).toBeEnabled();
      fireEvent.click(save);

      await waitFor(() =>
        expect(window.location.pathname).toBe("/recommendations"),
      );
    });

    it("explains a network failure on save instead of showing the browser error", async () => {
      installApi({
        "PUT /api/me/preferences": [
          () => Promise.reject(new TypeError("Failed to fetch")),
        ],
      });
      open("/preferences");

      fireEvent.click(await screen.findByRole("checkbox", { name: "Action" }));
      fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(NETWORK_MESSAGE);
      expect(alert).not.toHaveTextContent("Failed to fetch");
      expect(window.location.pathname).toBe("/preferences");
      expect(screen.getByRole("checkbox", { name: "Action" })).toBeChecked();
    });

    it("replaces a bodiless gateway error on the genre list with guidance and a described Retry", async () => {
      installApi({ "GET /api/genres": [() => htmlResponse(502)] });
      open("/preferences");

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(
        "The service is temporarily unavailable. Please try again in a moment.",
      );
      expect(alert).not.toHaveTextContent("Something went wrong");

      const retry = screen.getByRole("button", { name: "Retry" });
      expect(retry).toHaveAccessibleDescription(
        /Genres are unavailable.*Choose Retry to load the genres again/s,
      );
      fireEvent.click(retry);

      expect(
        await screen.findByRole("checkbox", { name: "Action" }),
      ).toBeInTheDocument();
    });

    it("offers Retry and a way out when the session check cannot reach the API", async () => {
      installApi({
        "GET /api/auth/me": [
          () => Promise.reject(new TypeError("Failed to fetch")),
        ],
      });
      open("/preferences");

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("We couldn't check your session");
      expect(alert).toHaveTextContent(NETWORK_MESSAGE);
      expect(alert).not.toHaveTextContent("Something went wrong");
      expect(
        screen.getByRole("link", { name: "Browse the catalogue" }),
      ).toHaveAttribute("href", "/");

      fireEvent.click(screen.getByRole("button", { name: "Retry" }));

      expect(
        await screen.findByRole("checkbox", { name: "Action" }),
      ).toBeInTheDocument();
      expect(window.location.pathname).toBe("/preferences");
    });

    it("explains a recommendation outage and recovers through a described Retry", async () => {
      installApi({
        "GET /api/me/recommendations?limit=10": [
          () => Promise.reject(new TypeError("Failed to fetch")),
        ],
      });
      open("/recommendations");

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(NETWORK_MESSAGE);
      expect(alert).toHaveTextContent(
        "Choose Retry to load your recommendations again.",
      );

      const retry = screen.getByRole("button", { name: "Retry" });
      expect(retry).toHaveAccessibleDescription(
        /Recommendations are unavailable/,
      );
      fireEvent.click(retry);

      expect(
        await screen.findByRole("link", { name: "View details for Movie A" }),
      ).toBeInTheDocument();
    });
  });
});
