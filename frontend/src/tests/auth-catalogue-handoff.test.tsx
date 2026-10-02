// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../App";

type Account = { id: string; email: string; password: string };

const movies = Array.from({ length: 10 }, (_, index) => ({
  id: `movie-${index + 1}`,
  title: `Movie ${index + 1}`,
  releaseYear: 2000 + index,
  genres: [{ id: 28, name: "Action" }],
  popularityScore: 100 - index,
}));

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * A stateful stand-in for the API: sessions are real server-side state, so a
 * signed-out browser cannot reach an authenticated endpoint by keeping old UI
 * state around.
 */
function installFakeServer() {
  const accounts: Account[] = [];
  let activeSessionOwner: Account | null = null;
  const requests: string[] = [];

  vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    requests.push(`${method} ${url}`);
    const body = init?.body ? JSON.parse(String(init.body)) : {};

    if (method === "POST" && url === "/api/auth/register") {
      const account = { id: `user-${accounts.length + 1}`, email: body.email, password: body.password };
      accounts.push(account);
      return Promise.resolve(json({ data: { user: { id: account.id, email: account.email } } }, 201));
    }
    if (method === "POST" && url === "/api/auth/login") {
      const account = accounts.find((a) => a.email === body.email && a.password === body.password);
      if (!account) {
        return Promise.resolve(json({ error: { message: "Email or password is incorrect" } }, 401));
      }
      activeSessionOwner = account;
      return Promise.resolve(json({ data: { user: { id: account.id, email: account.email } } }));
    }
    if (method === "GET" && url === "/api/auth/me") {
      return Promise.resolve(
        activeSessionOwner
          ? json({ data: { user: { id: activeSessionOwner.id, email: activeSessionOwner.email } } })
          : json({ error: { code: "AUTHENTICATION_REQUIRED", message: "Authentication required" } }, 401),
      );
    }
    if (method === "POST" && url === "/api/auth/logout") {
      activeSessionOwner = null;
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    if (method === "GET" && url === "/api/movies?limit=10") {
      return Promise.resolve(
        json({ data: { movies }, meta: { count: 10, limit: 10, catalogueRevision: "revision-test" } }),
      );
    }
    if (method === "GET" && url.startsWith("/api/movies/")) {
      const movie = movies.find((m) => `/api/movies/${m.id}` === url);
      return Promise.resolve(
        movie
          ? json({
              data: { movie: { ...movie, overview: "A real overview.", voteAverage: 7.5, voteCount: 100 } },
              meta: { catalogueRevision: "revision-test" },
            })
          : json({ error: { code: "MOVIE_NOT_FOUND", message: "Movie not found" } }, 404),
      );
    }
    return Promise.reject(new Error(`Unexpected request: ${method} ${url}`));
  });

  return { requests };
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("T20 integrated auth-to-catalogue handoff", () => {
  it("registers, signs in, lands on recommendations, opens a detail, signs out and loses access", async () => {
    const { requests } = installFakeServer();
    window.history.pushState({}, "", "/register");
    const first = render(<App />);

    // Register, then sign in with the new account.
    type("Email", "handoff@example.com");
    type("Password", "movie123");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    type("Email", "handoff@example.com");
    type("Password", "movie123");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    // The signed-in account reaches the real recommendation landing page.
    expect(await screen.findByRole("heading", { name: "Recommendations" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/recommendations");
    expect(screen.getByText("handoff@example.com")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Popular" })).toBeInTheDocument();

    // Sign out returns to the public catalogue; a movie detail opens without a session.
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByText("Movie 1")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
    fireEvent.click(screen.getByRole("link", { name: "View details for Movie 1" }));
    expect(await screen.findByText("A real overview.")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/movies/movie-1");

    // Opening the protected route again (reload / Back) cannot reuse the old account:
    // the server session is gone, so the guard sends the visitor to /login.
    first.unmount();
    window.history.pushState({}, "", "/recommendations");
    render(<App />);
    await waitFor(() => expect(window.location.pathname).toBe("/login"));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByText("handoff@example.com")).not.toBeInTheDocument();

    expect(requests).toContain("POST /api/auth/logout");
    // Signing in already identifies the account, so /me runs only on the fresh load.
    expect(requests.filter((request) => request === "GET /api/auth/me")).toHaveLength(1);
  });

  it("keeps the catalogue and movie detail public without any session check", async () => {
    const { requests } = installFakeServer();
    window.history.pushState({}, "", "/movies/movie-3");

    render(<App />);

    expect(await screen.findByText("A real overview.")).toBeInTheDocument();
    expect(requests.some((request) => request.includes("/api/auth/"))).toBe(false);
  });
});
