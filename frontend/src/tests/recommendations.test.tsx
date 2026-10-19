// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";

import App from "../App";
import {
  AuthContext,
  type AuthContextValue,
} from "../auth/authState.ts";
import RecommendationsPage, {
  RecommendationState,
} from "../pages/RecommendationsPage";

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

function deferredResponse() {
  let resolve!: (response: Response | PromiseLike<Response>) => void;

  const promise = new Promise<Response>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

const accounts = {
  A: { id: "user-a", email: "a@example.com" },
  B: { id: "user-b", email: "b@example.com" },
};

function RecommendationAccountHarness({
  account,
  onUnauthorized,
}: {
  account: "A" | "B";
  onUnauthorized: () => void;
}) {
  const auth: AuthContextValue = {
    status: "authenticated",
    user: accounts[account],
    refresh: async () => {},
    signIn: async () => {},
    signOut: async () => {},
    handleUnauthorized: onUnauthorized,
    recommendationVersion: 0,
    recommendationScope: "test-scope",
    invalidateRecommendations: vi.fn(),
  };

  return (
    <AuthContext.Provider value={auth}>
      <RecommendationsPage />
    </AuthContext.Provider>
  );
}

function renderRecommendations(recommendations: (url: string) => Promise<Response>) {
  window.history.pushState({}, "", "/recommendations");
  const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url = String(input);

    if (url === "/api/auth/me") {
      return jsonResponse({ data: { user: { id: "user-1", email: "viewer@example.com" } } });
    }
    if (url === "/api/genres") {
      return jsonResponse({ data: { genres: [action, drama] } });
    }
    if (url.startsWith("/api/me/recommendations")) {
      return recommendations(url);
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

    expect(
      await screen.findByRole("heading", { name: "Popular" }, { timeout: 5_000 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Not personalised")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Recommendations based on popular movies",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", {
        name: "Enter preferences →",
      }),
    ).toHaveAttribute("href", "/preferences");
    expect(
      screen.queryByRole("heading", {
        name: "No movies matched your favourite genres.",
      }),
    ).not.toBeInTheDocument();
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

  it("renders zero cards and no-data guidance when the result is empty", async () => {
    renderRecommendations(() => jsonResponse(popularBody([])));

    expect(
      await screen.findByRole("heading", {
        name: "No recommendations available yet.",
      }),
    ).toBeInTheDocument();

    expect(document.querySelectorAll(".movie-card")).toHaveLength(0);

    expect(
      screen.getByRole("link", {
        name: "Enter preferences →",
      }),
    ).toHaveAttribute("href", "/preferences");

    expect(
      screen.queryByRole("button", { name: "Retry" }),
    ).not.toBeInTheDocument();
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
    const fetchMock = renderRecommendations(() =>
      jsonResponse(
        { error: { code: "SERVICE_UNAVAILABLE", message: "Service is temporarily unavailable" } },
        503,
      ),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Service is temporarily unavailable");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "No recommendations available yet." })).not.toBeInTheDocument();
    expect(document.querySelectorAll(".movie-card")).toHaveLength(0);
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).startsWith("/api/me/preferences"),
      ),
    ).toBe(false);
  });

  it("renders the loading state component", () => {
    render(<RecommendationState status="loading" />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading recommendations...");
  });
});

describe("T11 no-match, retry, and request-race states", () => {
  it("shows no-match guidance, edit/retry actions, and popular alternatives", async () => {
    renderRecommendations(() =>
      jsonResponse(
        popularBody(
          [
            movie("movie-a", "Movie A", 90, []),
            movie("movie-b", "Movie B", 80, []),
          ],
          true,
        ),
      ),
    );

    expect(
      await screen.findByRole("heading", {
        name: "No movies matched your favourite genres.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Popular alternatives" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Not personalised")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit preferences" })).toHaveAttribute(
      "href",
      "/preferences",
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByText("Movie A")).toBeInTheDocument();
    expect(screen.getByText("Movie B")).toBeInTheDocument();
    expect(screen.queryByText(/Matches your genres/)).not.toBeInTheDocument();
  });

  it("filters complete popular alternatives through the API and clears the view", async () => {
    const actionMovie = { ...movie("movie-a", "Action alternative", 90, []), genres: [action] };
    const dramaMovie = { ...movie("movie-b", "Drama alternative", 80, []), genres: [drama] };
    const fetchMock = renderRecommendations((url) => {
      const filtered = url.includes("genreId=28");
      return jsonResponse({ ...popularBody(filtered ? [actionMovie] : [actionMovie, dramaMovie], true),
        meta: { count: filtered ? 1 : 2, limit: 10, page: 1,
          total: filtered ? 1 : 2, totalPages: 1, unfilteredTotal: 2,
          catalogueRevision: "revision" } });
    });

    const filter = await screen.findByRole("combobox", { name: "Filter by genre" });
    await waitFor(() => expect(filter).toBeEnabled());
    fireEvent.change(filter, { target: { value: String(action.id) } });

    expect(await screen.findByText("Action alternative")).toBeInTheDocument();
    expect(screen.queryByText("Drama alternative")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1-1 of 1 matches (2 recommendations before filtering)")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "No movies matched your favourite genres." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit preferences" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear filter" }));
    expect(await screen.findByText("Drama alternative")).toBeInTheDocument();
    expect(screen.getByText("Showing 1-2 of 2 movies")).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).startsWith("/api/me/recommendations"))).toHaveLength(3);
  });

  it("retries the same filtered query and keeps its view genre", async () => {
    let attempt = 0;
    renderRecommendations((url) => {
      attempt += 1;
      const filtered = url.includes("genreId=28");
      const oldAction = { ...movie("old-action", "Old Action", 90, []), genres: [action] };
      const oldDrama = { ...movie("old-drama", "Old Drama", 80, []), genres: [drama] };
      const newAction = { ...movie("new-action", "New Action", 95, []), genres: [action] };
      return jsonResponse({ ...popularBody(filtered ? [attempt > 2 ? newAction : oldAction] : [oldAction, oldDrama], true),
        meta: { count: filtered ? 1 : 2, limit: 10, page: 1, total: filtered ? 1 : 2,
          totalPages: 1, unfilteredTotal: 2, catalogueRevision: "revision" } });
    });

    const filter = await screen.findByRole("combobox", { name: "Filter by genre" });
    await waitFor(() => expect(filter).toBeEnabled());
    fireEvent.change(filter, { target: { value: String(action.id) } });
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Filter by genre" })).toHaveValue("28"));
    expect(await screen.findByText("Old Action")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Showing 1-1 of 1 matches (2 recommendations before filtering)")).toBeInTheDocument());
    expect(screen.queryByText("Old Drama")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("New Action")).toBeInTheDocument();
    expect(screen.queryByText("Old Action")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Filter by genre" })).toHaveValue("28"));
    expect(screen.getByText("Showing 1-1 of 1 matches (2 recommendations before filtering)")).toBeInTheDocument();
  });

  it("keeps no-match guidance and actions when no popular alternative exists", async () => {
    renderRecommendations(() => jsonResponse(popularBody([], true)));

    expect(
      await screen.findByRole("heading", {
        name: "No movies matched your favourite genres.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit preferences" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "No recommendations available yet." }),
    ).not.toBeInTheDocument();
    expect(document.querySelectorAll(".movie-card")).toHaveLength(0);
  });

  it("retries the same recommendation query and replaces an error with recovered data", async () => {
    let attempt = 0;
    const fetchMock = renderRecommendations(() => {
      attempt += 1;
      return attempt === 1
        ? jsonResponse(
            {
              error: {
                code: "SERVICE_UNAVAILABLE",
                message: "Service is temporarily unavailable",
              },
            },
            503,
          )
        : jsonResponse(personalisedBody([movie("movie-a", "Movie A", 90)]));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Service is temporarily unavailable",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Movie A")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Recommended for you" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    const recommendationCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).startsWith("/api/me/recommendations"),
    );
    expect(recommendationCalls).toHaveLength(2);
    expect(recommendationCalls.map(([input]) => String(input))).toEqual([
      "/api/me/recommendations?limit=10",
      "/api/me/recommendations?limit=10",
    ]);
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).startsWith("/api/me/preferences"),
      ),
    ).toBe(false);
  });

  it("shows retry for a network failure instead of treating it as empty data", async () => {
    renderRecommendations(() => Promise.reject(new TypeError("Network unavailable")));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We can't reach the server. Check your connection, then try again.",
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "No recommendations available yet." }),
    ).not.toBeInTheDocument();
  });

  it.each([200, 401])(
    "ignores an old account response with status %i after switching to B",
    async (status) => {
      const oldAccountRequest = deferredResponse();
      let currentAccount: "A" | "B" = "A";
      const onUnauthorized = vi.fn();

      vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
        const url = String(input);

        if (url === "/api/genres") {
          return jsonResponse({ data: { genres: [action, drama] } });
        }
        if (url.startsWith("/api/me/recommendations")) {
          return currentAccount === "A"
            ? oldAccountRequest.promise
            : jsonResponse(
                personalisedBody([
                  movie("movie-b", "Account B movie", 80, [drama]),
                ]),
              );
        }
        return Promise.reject(new Error(`Unexpected request: ${url}`));
      });

      const view = render(
        <MemoryRouter initialEntries={["/recommendations"]}>
          <RecommendationAccountHarness
            account="A"
            onUnauthorized={onUnauthorized}
          />
        </MemoryRouter>,
      );

      expect(await screen.findByRole("status")).toHaveTextContent(
        "Loading recommendations...",
      );

      currentAccount = "B";
      view.rerender(
        <MemoryRouter initialEntries={["/recommendations"]}>
          <RecommendationAccountHarness
            account="B"
            onUnauthorized={onUnauthorized}
          />
        </MemoryRouter>,
      );

      expect(await screen.findByText("Account B movie")).toBeInTheDocument();

      await act(async () => {
        oldAccountRequest.resolve(
          status === 200
            ? jsonResponse(
                personalisedBody([
                  movie("movie-a", "Account A movie", 90),
                ]),
              )
            : new Response(
                JSON.stringify({
                  error: {
                    code: "AUTHENTICATION_REQUIRED",
                    message: "Authentication required",
                  },
                }),
                {
                  status: 401,
                  headers: { "Content-Type": "application/json" },
                },
              ),
        );
      });

      expect(screen.getByText("Account B movie")).toBeInTheDocument();
      expect(screen.queryByText("Account A movie")).not.toBeInTheDocument();
      expect(onUnauthorized).not.toHaveBeenCalled();
    },
  );

  it("ignores a pending response after navigating away", async () => {
    const pendingRequest = deferredResponse();
    const auth: AuthContextValue = {
      status: "authenticated",
      user: accounts.A,
      refresh: async () => {},
      signIn: async () => {},
      signOut: async () => {},
      handleUnauthorized: vi.fn(),
      recommendationVersion: 0,
      recommendationScope: "test-scope",
      invalidateRecommendations: vi.fn(),
    };

    vi.spyOn(globalThis, "fetch").mockReturnValue(pendingRequest.promise);

    render(
      <MemoryRouter initialEntries={["/recommendations"]}>
        <AuthContext.Provider value={auth}>
          <Link to="/away">Leave recommendations</Link>
          <Routes>
            <Route path="/recommendations" element={<RecommendationsPage />} />
            <Route path="/away" element={<h1>Another page</h1>} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Loading recommendations...",
    );
    fireEvent.click(screen.getByRole("link", { name: "Leave recommendations" }));
    expect(
      await screen.findByRole("heading", { name: "Another page" }),
    ).toBeInTheDocument();

    await act(async () => {
      pendingRequest.resolve(
        jsonResponse(personalisedBody([movie("movie-a", "Old movie", 90)])),
      );
    });

    expect(screen.getByRole("heading", { name: "Another page" })).toBeInTheDocument();
    expect(screen.queryByText("Old movie")).not.toBeInTheDocument();
  });

  it("ignores a pending recommendation response after logout", async () => {
    const pendingRequest = deferredResponse();

    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const path = String(input);

      if (path === "/api/auth/me") {
        return jsonResponse({ data: { user: accounts.A } });
      }
      if (path.startsWith("/api/me/recommendations")) {
        return pendingRequest.promise;
      }
      if (path === "/api/auth/logout") {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });

    window.history.pushState({}, "", "/recommendations");
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(window.location.pathname).toBe("/"));

    await act(async () => {
      pendingRequest.resolve(
        jsonResponse(personalisedBody([movie("movie-a", "Old movie", 90)])),
      );
    });

    expect(window.location.pathname).toBe("/");
    expect(screen.queryByText("Old movie")).not.toBeInTheDocument();
  });
});
