
// @vitest-environment jsdom
import { act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import {
  AuthContext,
  type AuthContextValue,
} from "../auth/authState.ts";
import RecommendationsPage from "../pages/RecommendationsPage.tsx";

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

const action = { id: 28, name: "Action" };

const personalisedMovie = {
  id: "movie-action",
  title: "Action Movie",
  releaseYear: 2024,
  genres: [action],
  popularityScore: 90,
  reason: {
    matchedGenres: [action],
  },
};

const popularMovie = {
  ...personalisedMovie,
  id: "movie-popular",
  title: "Popular Movie",
  reason: {
    matchedGenres: [],
  },
};

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "Content-Type": "application/json",
      },
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("S3-T13 cold-start to personalised transition", () => {
  it("fetches fresh personalised recommendations after a committed preference save", async () => {
    let savedGenreIds: number[] = [];
    let recommendationCalls = 0;
    let resolveSave!: (response: Response) => void;

    const pendingSave = new Promise<Response>((resolve) => {
      resolveSave = resolve;
    });

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((input, init) => {
        const path = String(input);
        const method = init?.method ?? "GET";

        if (path === "/api/auth/me") {
          return jsonResponse({
            data: {
              user: {
                id: "user-1",
                email: "viewer@example.com",
              },
            },
          });
        }

        if (path === "/api/genres") {
          return jsonResponse({
            data: { genres: [action] },
          });
        }

        if (
          path === "/api/me/preferences" &&
          method === "GET"
        ) {
          return jsonResponse({
            data: {
              genres: savedGenreIds.map(() => action),
            },
          });
        }

        if (
          path === "/api/me/preferences" &&
          method === "PUT"
        ) {
          const body = JSON.parse(
            String(init?.body),
          ) as { genreIds: number[] };

          expect(body.genreIds).toEqual([28]);

          return pendingSave.then((response) => {
            if (response.ok) {
              savedGenreIds = body.genreIds;
            }
            return response;
          });
        }

        if (path === "/api/me/recommendations?limit=10") {
          recommendationCalls += 1;

          if (savedGenreIds.length === 0) {
            return jsonResponse({
              data: {
                movies: [popularMovie],
                mode: "popular",
                personalised: false,
                noMatch: false,
              },
            });
          }

          return jsonResponse({
            data: {
              movies: [personalisedMovie],
              mode: "personalised",
              personalised: true,
              noMatch: false,
            },
          });
        }

        throw new Error(
          `Unexpected request: ${method} ${path}`,
        );
      });

    window.history.pushState({}, "", "/recommendations");
    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: "Recommendations based on popular movies",
      }, { timeout: 5000 }),
    ).toBeInTheDocument();

    expect(screen.getByText("Popular Movie")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("link", {
        name: "Enter preferences →",
      }),
    );

    expect(
      await screen.findByRole("checkbox", {
        name: "Action",
      }),
    ).not.toBeChecked();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Action",
      }),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Save preferences",
      }),
    );

    // The save is still pending. No navigation yet.
    expect(window.location.pathname).toBe("/preferences");

    resolveSave(
      new Response(
        JSON.stringify({
          data: {
            genres: [action],
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    await waitFor(() => {
      expect(window.location.pathname).toBe("/recommendations");
    });

    expect(
      await screen.findByRole("heading", {
        name: "Recommended for you",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("Action Movie")).toBeInTheDocument();

    expect(
      screen.getByText("Matches your genres: Action"),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("heading", {
        name: "Recommendations based on popular movies",
      }),
    ).not.toBeInTheDocument();

    expect(recommendationCalls).toBe(2);

    const calls = fetchMock.mock.calls.filter(
      ([input]) =>
        String(input) ===
        "/api/me/recommendations?limit=10",
    );

    expect(calls).toHaveLength(2);
  });

    it("shows popular alternatives when saved preferences have no matching movies", async () => {
    let savedGenreIds: number[] = [];
    let recommendationCalls = 0;

    const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockImplementation((input, init) => {
        const path = String(input);
        const method = init?.method ?? "GET";

        if (path === "/api/auth/me") {
            return jsonResponse({
            data: {
                user: {
                id: "user-1",
                email: "viewer@example.com",
                },
            },
            });
        }

        if (path === "/api/genres") {
            return jsonResponse({
            data: { genres: [action] },
            });
        }

        if (
            path === "/api/me/preferences" &&
            method === "GET"
        ) {
            return jsonResponse({
            data: {
                genres: savedGenreIds.map(() => action),
            },
            });
        }

        if (
            path === "/api/me/preferences" &&
            method === "PUT"
        ) {
            const body = JSON.parse(
            String(init?.body),
            ) as { genreIds: number[] };

            savedGenreIds = body.genreIds;

            return jsonResponse({
            data: { genres: [action] },
            });
        }

        if (path === "/api/me/recommendations?limit=10") {
            recommendationCalls += 1;

            if (savedGenreIds.length === 0) {
            return jsonResponse({
                data: {
                movies: [popularMovie],
                mode: "popular",
                personalised: false,
                noMatch: false,
                },
            });
            }

            return jsonResponse({
            data: {
                movies: [popularMovie],
                mode: "popular",
                personalised: false,
                noMatch: true,
            },
            });
        }

        throw new Error(
            `Unexpected request: ${method} ${path}`,
        );
        });

    window.history.pushState({}, "", "/recommendations");
    render(<App />);

    expect(
        await screen.findByRole("heading", {
        name: "Recommendations based on popular movies",
        }),
    ).toBeInTheDocument();

    fireEvent.click(
        screen.getByRole("link", {
        name: "Enter preferences →",
        }),
    );

    fireEvent.click(
        await screen.findByRole("checkbox", {
        name: "Action",
        }),
    );

    fireEvent.click(
        screen.getByRole("button", {
        name: "Save preferences",
        }),
    );

    await waitFor(() => {
        expect(window.location.pathname).toBe("/recommendations");
    });

    expect(
        await screen.findByRole("heading", {
        name: "Popular alternatives",
        }),
    ).toBeInTheDocument();

    expect(
        screen.getByRole("heading", {
        name: "No movies matched your favourite genres.",
        }),
    ).toBeInTheDocument();

    expect(screen.getByText("Popular Movie")).toBeInTheDocument();

    expect(
        screen.getByRole("link", {
        name: "Edit preferences",
        }),
    ).toHaveAttribute("href", "/preferences");

    expect(
        screen.queryByRole("heading", {
        name: "Recommended for you",
        }),
    ).not.toBeInTheDocument();

    expect(
        screen.queryByRole("heading", {
        name: "Recommendations based on popular movies",
        }),
    ).not.toBeInTheDocument();

    expect(recommendationCalls).toBe(2);

    expect(
        fetchMock.mock.calls.filter(
        ([input]) =>
            String(input) === "/api/me/recommendations?limit=10",
        ),
    ).toHaveLength(2);
    });


    it("ignores a stale cold-start response after recommendation invalidation", async () => {
    let resolveOldRequest!: (response: Response) => void;

    const oldRequest = new Promise<Response>((resolve) => {
        resolveOldRequest = resolve;
    });

    let recommendationCalls = 0;

    const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockImplementation((input) => {
        const path = String(input);

        if (path === "/api/genres") {
            return jsonResponse({
            data: { genres: [action] },
            });
        }

        if (path === "/api/me/recommendations?limit=10") {
            recommendationCalls += 1;

            if (recommendationCalls === 1) {
            return oldRequest;
            }

            return jsonResponse({
            data: {
                movies: [personalisedMovie],
                mode: "personalised",
                personalised: true,
                noMatch: false,
            },
            });
        }

        throw new Error(`Unexpected request: ${path}`);
        });

    const baseAuth: AuthContextValue = {
        status: "authenticated",
        user: {
        id: "user-1",
        email: "viewer@example.com",
        },
        refresh: async () => {},
        signIn: async () => {},
        signOut: async () => {},
        handleUnauthorized: vi.fn(),
        recommendationVersion: 0,
        recommendationScope: "old-scope",
        invalidateRecommendations: vi.fn(),
    };

    const view = render(
        <MemoryRouter initialEntries={["/recommendations"]}>
        <AuthContext.Provider value={baseAuth}>
            <RecommendationsPage />
        </AuthContext.Provider>
        </MemoryRouter>,
    );

    expect(
        await screen.findByRole("status", {
        name: "",
        }),
    ).toHaveTextContent("Loading recommendations...");

    // Simulate committed preference save invalidating the old snapshot.
    view.rerender(
        <MemoryRouter initialEntries={["/recommendations"]}>
        <AuthContext.Provider
            value={{
            ...baseAuth,
            recommendationVersion: 1,
            recommendationScope: "new-scope",
            }}
        >
            <RecommendationsPage />
        </AuthContext.Provider>
        </MemoryRouter>,
    );

    expect(
        await screen.findByRole("heading", {
        name: "Recommended for you",
        }),
    ).toBeInTheDocument();

    expect(screen.getByText("Action Movie")).toBeInTheDocument();

    // Resolve the old cold-start request after the new result is shown.
    await act(async () => {
        resolveOldRequest(
        new Response(
            JSON.stringify({
            data: {
                movies: [popularMovie],
                mode: "popular",
                personalised: false,
                noMatch: false,
            },
            }),
            {
            status: 200,
            headers: {
                "Content-Type": "application/json",
            },
            },
        ),
        );
    });

    expect(
        screen.getByRole("heading", {
        name: "Recommended for you",
        }),
    ).toBeInTheDocument();

    expect(screen.getByText("Action Movie")).toBeInTheDocument();

    expect(screen.queryByText("Popular Movie")).not.toBeInTheDocument();

    expect(
        screen.queryByRole("heading", {
        name: "Recommendations based on popular movies",
        }),
    ).not.toBeInTheDocument();

    expect(recommendationCalls).toBe(2);

    expect(
        fetchMock.mock.calls.filter(
        ([input]) =>
            String(input) === "/api/me/recommendations?limit=10",
        ),
    ).toHaveLength(2);
    });

});
