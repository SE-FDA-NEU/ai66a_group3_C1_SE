// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import App from "../App.tsx";

const user = { id: "home-user", email: "home@example.test" };
const genres = [{ id: 28, name: "Action" }, { id: 35, name: "Comedy" }];
const movies = [{ id: "home-movie", title: "Alpha", releaseYear: 2025,
  genres: [genres[0]], popularityScore: 90, reason: { matchedGenres: [] } }];

function installApi(authenticated = false, initialGenres = [genres[0]]) {
  let loggedIn = authenticated;
  let saved = initialGenres;
  const requests: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input), "https://movie-app.invalid");
    const method = init?.method ?? "GET";
    requests.push(`${method} ${url.pathname}`);
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
      status, headers: { "Content-Type": "application/json" },
    });
    if (url.pathname === "/api/auth/login") {
      loggedIn = true;
      return json({ data: { user } });
    }
    if (url.pathname === "/api/auth/register") return json({ data: { user } }, 201);
    if (url.pathname === "/api/auth/me") return loggedIn ? json({ data: { user } }) :
      json({ error: { code: "AUTHENTICATION_REQUIRED", message: "Authentication required" } }, 401);
    if (url.pathname === "/api/genres") return json({ data: { genres } });
    if (url.pathname.startsWith("/api/me/") && !loggedIn) throw new Error("Unexpected private guest request");
    if (url.pathname === "/api/me/preferences") {
      if (method === "PUT") {
        const ids = JSON.parse(String(init?.body)).genreIds as number[];
        saved = genres.filter(genre => ids.includes(genre.id));
      }
      return json({ data: { genres: saved } });
    }
    if (["/api/movies", "/api/movies/popular", "/api/me/recommendations"].includes(url.pathname)) {
      return json({ data: { movies, mode: "popular", personalised: false, noMatch: false },
        meta: { count: 1, limit: 10, page: Number(url.searchParams.get("page") ?? 1),
          total: 21, totalPages: 3, unfilteredTotal: 21, catalogueRevision: "home-revision" } });
    }
    throw new Error(`Unexpected ${method} ${url.pathname}`);
  });
  return requests;
}

function open(route = "/", state = {}) {
  window.history.pushState({ usr: state }, "", route);
  render(<App />);
}

async function signIn() {
  await screen.findByRole("heading", { name: "Sign in" });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: user.email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Synthetic-home-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

afterEach(() => {
  cleanup(); vi.restoreAllMocks(); localStorage.clear();
  window.history.replaceState({}, "", "/");
});

it("offers a compact hero and one persistent recommendations navbar entry without sample claims", async () => {
  const requests = installApi();
  open();
  await screen.findByText("Alpha");
  expect(screen.queryByText(/Choose Start to pick up to 5/)).not.toBeInTheDocument();
  expect(screen.getByText("Less scrolling. More great films.")).toBeVisible();
  expect(screen.getByRole("link", { name: "Start" })).toHaveAttribute("href", "/preferences");
  expect(screen.getByRole("link", { name: "Explore Catalogue" })).toHaveAttribute("href", "#catalogue-shelf");
  expect(screen.getByRole("region", { name: "Catalogue results" })).toHaveAttribute("id", "catalogue-shelf");
  const nav = screen.getByRole("navigation", { name: "Main navigation" });
  expect(within(nav).getByRole("link", { name: "My recommendations" })).toHaveAttribute("href", "/recommendations");
  expect(screen.getAllByRole("link", { name: "My recommendations" })).toHaveLength(1);
  expect(screen.queryByText(/Neural Taste|Live TMDb|15,000|98\.4%/)).not.toBeInTheDocument();
  expect(requests.some(request => request.includes("/api/me/"))).toBe(false);
});

it("signs in from Home and stays there without loading or saving personalisation", async () => {
  const requests = installApi();
  open();
  fireEvent.click(await screen.findByRole("link", { name: "Sign in" }));
  await signIn();
  await screen.findByText(user.email);
  expect(window.location.pathname).toBe("/");
  expect(screen.getByRole("heading", { name: "Find your next movie" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Sign out" })).toBeVisible();
  expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
  expect(requests.some(request => request.includes("/api/me/"))).toBe(false);
  expect(screen.getAllByRole("link", { name: "My recommendations" })).toHaveLength(1);
});

it("opens the signed-in picker only after Start, restores saved genres and saves on demand", async () => {
  const requests = installApi(true);
  open();
  await screen.findByText(user.email);
  expect(requests.some(request => request.includes("/api/me/"))).toBe(false);
  fireEvent.click(screen.getByRole("link", { name: "Start" }));
  const action = await screen.findByRole("checkbox", { name: "Action" });
  expect(window.location.pathname).toBe("/preferences");
  expect(action).toBeChecked();
  expect(screen.getByText("1 of 5 selected")).toBeVisible();
  fireEvent.click(screen.getByRole("checkbox", { name: "Comedy" }));
  expect(requests).not.toContain("PUT /api/me/preferences");
  fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));
  await screen.findByRole("heading", { name: "Recommendations" });
  expect(requests.filter(request => request === "PUT /api/me/preferences")).toHaveLength(1);
});

it("returns a guest Start attempt to Preferences after authentication, never reading private data before login", async () => {
  const requests = installApi();
  open();
  await screen.findByRole("link", { name: "Sign in" });
  fireEvent.click(screen.getByRole("link", { name: "Start" }));
  await screen.findByRole("heading", { name: "Sign in" });
  expect(requests.some(request => request.includes("/api/me/"))).toBe(false);
  await signIn();
  expect(await screen.findByRole("checkbox", { name: "Action" })).toBeChecked();
  expect(window.location.pathname).toBe("/preferences");
  expect(requests).not.toContain("PUT /api/me/preferences");
  expect(requests).not.toContain("GET /api/me/recommendations");
});

it("opens cold-start recommendations only when a guest explicitly selects that navbar entry", async () => {
  const requests = installApi(false, []);
  open();
  fireEvent.click(screen.getByRole("link", { name: "My recommendations" }));
  await signIn();
  await screen.findByText("Not personalised", { exact: true });
  expect(window.location.pathname).toBe("/recommendations");
  expect(screen.getByRole("link", { name: "My recommendations" })).toHaveAttribute("aria-current", "page");
  expect(requests).not.toContain("PUT /api/me/preferences");
});

it("preserves an explicit protected page/filter/hash but not old account result state", async () => {
  installApi();
  open("/recommendations?page=2&genreId=28#results", { listViewContext: { accountId: "old-account" } });
  await signIn();
  await waitFor(() => expect(window.location.pathname).toBe("/recommendations"));
  expect(window.location.search).toBe("?page=2&genreId=28");
  expect(window.location.hash).toBe("#results");
  expect(JSON.stringify(window.history.state)).not.toContain("old-account");
});

it("keeps an explicit Start destination through registration and its login redirect", async () => {
  installApi();
  open();
  fireEvent.click(screen.getByRole("link", { name: "Start" }));
  await screen.findByRole("heading", { name: "Sign in" });
  fireEvent.click(screen.getByRole("link", { name: "Create an account" }));
  await screen.findByRole("heading", { name: "Create your account" });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: user.email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Synthetic-home-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
  await signIn();
  expect(await screen.findByRole("checkbox", { name: "Action" })).toBeChecked();
  expect(window.location.pathname).toBe("/preferences");
});
