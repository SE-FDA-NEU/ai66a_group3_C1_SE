// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const user = { id: "user-1", email: "viewer@example.com" };
const genres = [
  { id: 28, name: "Action" },
  { id: 35, name: "Comedy" },
  { id: 18, name: "Drama" },
  { id: 27, name: "Horror" },
  { id: 10749, name: "Romance" },
  { id: 878, name: "Science Fiction" },
];

function installApiMock(options?: {
  availableGenres?: typeof genres;
  savedGenres?: typeof genres;
}) {
  const availableGenres = options?.availableGenres ?? genres;
  const savedGenres = options?.savedGenres ?? [];

  return vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const path = String(input);

    if (path === "/api/auth/me") {
      return jsonResponse({ data: { user } });
    }
    if (path === "/api/genres") {
      return jsonResponse({ data: { genres: availableGenres } });
    }
    if (path === "/api/me/preferences") {
      return jsonResponse({ data: { genres: savedGenres } });
    }
    if (path === "/api/movies?limit=10") {
      return jsonResponse({ data: { movies: [] } });
    }

    throw new Error(`Unexpected request: ${path}`);
  });
}

function renderPreferences() {
  window.history.pushState({}, "", "/preferences");
  render(<App />);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("S3-T04 home Start and genre picker", () => {
  it("opens the catalogue-backed preferences picker from Start for a signed-in viewer", async () => {
    const fetchMock = installApiMock();
    render(<App />);

    fireEvent.click(await screen.findByRole("link", { name: "Start" }));

    expect(await screen.findByRole("checkbox", { name: "Action" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/preferences");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/genres",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("shows the current account's saved genres as selected", async () => {
    installApiMock({ savedGenres: [genres[0], genres[2]] });
    renderPreferences();

    expect(await screen.findByRole("checkbox", { name: "Action" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Drama" })).toBeChecked();
    expect(screen.getByText("2 of 5 selected")).toBeInTheDocument();
  });

  it("refuses a sixth choice and preserves the previous five", async () => {
    installApiMock();
    renderPreferences();

    await screen.findByRole("checkbox", { name: "Action" });
    for (const genre of genres.slice(0, 5)) {
      fireEvent.click(screen.getByRole("checkbox", { name: genre.name }));
    }
    fireEvent.click(screen.getByRole("checkbox", { name: "Science Fiction" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "You can select up to 5 genres",
    );
    for (const genre of genres.slice(0, 5)) {
      expect(screen.getByRole("checkbox", { name: genre.name })).toBeChecked();
    }
    expect(screen.getByRole("checkbox", { name: "Science Fiction" })).not.toBeChecked();
    expect(screen.getByText("5 of 5 selected")).toBeInTheDocument();
  });

  it("keeps the page usable while genres load", async () => {
    let resolveGenres!: (response: Response) => void;
    const pendingGenres = new Promise<Response>((resolve) => {
      resolveGenres = resolve;
    });

    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const path = String(input);

      if (path === "/api/auth/me") {
        return jsonResponse({ data: { user } });
      }
      if (path === "/api/genres") {
        return pendingGenres;
      }
      if (path === "/api/me/preferences") {
        return jsonResponse({ data: { genres: [] } });
      }

      throw new Error(`Unexpected request: ${path}`);
    });
    renderPreferences();

    expect(await screen.findByRole("heading", { name: "Movie Preferences" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading genres...");

    resolveGenres(
      new Response(JSON.stringify({ data: { genres: [] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(await screen.findByRole("heading", { name: "No genres available" })).toBeInTheDocument();
  });

  it("shows an empty catalogue state with a route back home", async () => {
    installApiMock({ availableGenres: [] });
    renderPreferences();

    expect(await screen.findByRole("heading", { name: "No genres available" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to catalogue" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("retries after a genre catalogue error", async () => {
    let genreAttempts = 0;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const path = String(input);

      if (path === "/api/auth/me") {
        return jsonResponse({ data: { user } });
      }
      if (path === "/api/genres") {
        genreAttempts += 1;
        return genreAttempts === 1
          ? jsonResponse(
              {
                error: {
                  code: "CATALOGUE_UNAVAILABLE",
                  message: "Movie catalogue is unavailable",
                },
              },
              503,
            )
          : jsonResponse({ data: { genres } });
      }
      if (path === "/api/me/preferences") {
        return jsonResponse({ data: { genres: [] } });
      }

      throw new Error(`Unexpected request: ${path}`);
    });
    renderPreferences();

    expect(await screen.findByRole("alert")).toHaveTextContent("Movie catalogue is unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("checkbox", { name: "Action" })).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([input]) => input === "/api/genres")).toHaveLength(2);
  });

  it("returns to login when a protected preference read becomes unauthorized", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const path = String(input);

      if (path === "/api/auth/me") {
        return jsonResponse({ data: { user } });
      }
      if (path === "/api/genres") {
        return jsonResponse(
          {
            error: {
              code: "AUTHENTICATION_REQUIRED",
              message: "Authentication required",
            },
          },
          401,
        );
      }
      if (path === "/api/me/preferences") {
        return jsonResponse({ data: { genres: [] } });
      }

      throw new Error(`Unexpected request: ${path}`);
    });
    renderPreferences();

    await waitFor(() => expect(window.location.pathname).toBe("/login"));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });
});
