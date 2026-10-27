// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import App from "../App.tsx";
import { genrePresentation } from "../genrePresentation.ts";

const user = { id: "polish-user", email: "polish@example.test" };
const genres = [{ id: 28, name: "Action" }, { id: 35, name: "Comedy" }];
const firstMovie = { id: "m-1", title: "First from API", releaseYear: 2025,
  genres, popularityScore: 95, posterUrl: null };
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
function deferred() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>(done => { resolve = done; });
  return { promise, resolve };
}
function installApi(options: { loggedIn?: boolean;
  override?: (path: string, method: string) => Response | Promise<Response> | undefined } = {}) {
  let loggedIn = options.loggedIn ?? false;
  const requests: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input), "https://movie-app.invalid");
    const method = init?.method ?? "GET";
    requests.push(`${method} ${url.pathname}`);
    const overridden = options.override?.(url.pathname, method);
    if (overridden) return overridden;
    if (url.pathname === "/api/auth/me") return loggedIn ? json({ data: { user } }) :
      json({ error: { code: "AUTHENTICATION_REQUIRED" } }, 401);
    if (url.pathname === "/api/auth/login") { loggedIn = true; return json({ data: { user } }); }
    if (url.pathname === "/api/auth/register") return json({ data: { user } }, 201);
    if (url.pathname === "/api/auth/logout") { loggedIn = false; return new Response(null, { status: 204 }); }
    if (url.pathname === "/api/genres") return json({ data: { genres } });
    if (url.pathname === "/api/me/preferences") return json({ data: { genres: [genres[0]] } });
    if (url.pathname === "/api/me/ratings/m-1") return json({ data: { movieId: "m-1", rating: null } });
    if (url.pathname === "/api/movies/m-1/similar") return json({ data: { movies: [] } });
    if (url.pathname === "/api/movies/m-1") return json({ data: { movie: { ...firstMovie,
      overview: "Synthetic movie overview.", voteAverage: 7, voteCount: 50 } }, meta: { catalogueRevision: "polish-r1" } });
    if (["/api/movies", "/api/movies/popular", "/api/me/recommendations"].includes(url.pathname)) {
      const page = Number(url.searchParams.get("page") ?? 1);
      const movies = page === 1 ? [firstMovie] : [{ ...firstMovie, id: "m-2", title: "Page two", popularityScore: 80 }];
      return json({ data: { movies, mode: "popular", personalised: false, noMatch: false },
        meta: { count: 1, limit: 10, page, total: 11, totalPages: 2,
          unfilteredTotal: 11, catalogueRevision: "polish-r1" } });
    }
    throw new Error(`Unexpected ${method} ${url.pathname}`);
  });
  return requests;
}
function open(path: string) { window.history.pushState({}, "", path); render(<App />); }
function submitLogin() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: user.email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "synthetic-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}
function notice() { return within(screen.getByTestId("action-feedback")); }
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); sessionStorage.clear();
  window.history.replaceState({}, "", "/"); });

it.each(["My recommendations", "Preferences"])("explains the guest %s redirect without any private requests", async entry => {
  const requests = installApi(); open("/");
  await screen.findByRole("link", { name: "Sign in" });
  fireEvent.click(screen.getByRole("link", { name: entry }));
  await screen.findByRole("heading", { name: "Sign in" });
  expect(notice().getByRole("status")).toHaveTextContent("Sign in to continue");
  expect(requests.some(request => request.includes("/api/me/"))).toBe(false);
});

it("shows direct Sign in intent, pending and confirmed feedback while keeping the normal Home destination", async () => {
  const login = deferred();
  const requests = installApi({ override: path => path === "/api/auth/login" ? login.promise : undefined });
  open("/"); fireEvent.click(await screen.findByRole("link", { name: "Sign in" }));
  expect(notice().getByRole("status")).toHaveTextContent("Welcome back");
  submitLogin(); expect(notice().getByRole("status")).toHaveTextContent("Signing you in");
  expect(notice().queryByText("You're signed in")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Signing in..." })).toBeDisabled();
  await act(async () => login.resolve(json({ data: { user } })));
  await screen.findByRole("heading", { name: "Find your next movie" });
  expect(window.location.pathname).toBe("/");
  expect(notice().getByRole("status")).toHaveTextContent("You're signed in");
  expect(requests.some(request => request.includes("/api/me/"))).toBe(false);
});

it.each([401, 503])("keeps sign-in failure %s inline and never announces success", async status => {
  installApi({ override: path => path === "/api/auth/login" ? json({ error: { code: "INVALID_CREDENTIALS" } }, status) : undefined });
  open("/login"); submitLogin();
  await screen.findByRole("alert");
  expect(notice().getByRole("status")).toHaveTextContent("Sign-in not confirmed");
  expect(screen.queryByText("You're signed in")).not.toBeInTheDocument();
  expect(window.location.pathname).toBe("/login");
});

it.each(["login", "register"])("rejects a malformed successful %s response rather than reporting success", async kind => {
  installApi({ override: path => path === `/api/auth/${kind}` ? json({ data: { user: {} } }, kind === "register" ? 201 : 200) : undefined });
  open(`/${kind}`);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: user.email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "synthetic-password" } });
  fireEvent.click(screen.getByRole("button", { name: kind === "register" ? "Create account" : "Sign in" }));
  await screen.findByRole("alert");
  expect(screen.getByTestId("action-feedback")).toHaveClass("action-feedback--error");
  expect(screen.queryByText(kind === "register" ? "Account created" : "You're signed in")).not.toBeInTheDocument();
  expect(window.location.pathname).toBe(`/${kind}`);
});

it("confirms registration only after a valid acknowledgement and preserves the login form", async () => {
  const registration = deferred();
  installApi({ override: path => path === "/api/auth/register" ? registration.promise : undefined });
  open("/register");
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: user.email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "synthetic-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
  expect(notice().getByRole("status")).toHaveTextContent("Creating your account");
  expect(screen.queryByText("Account created")).not.toBeInTheDocument();
  await act(async () => registration.resolve(json({ data: { user } }, 201)));
  await screen.findByRole("heading", { name: "Sign in" });
  expect(notice().getByRole("status")).toHaveTextContent("Account created");
  expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
});

it("keeps the account signed in after an unsuccessful logout and confirms a later retry", async () => {
  const logout = deferred(); let calls = 0;
  installApi({ loggedIn: true, override: path => path === "/api/auth/logout" ?
    (++calls === 1 ? json({ error: { code: "SERVICE_UNAVAILABLE" } }, 503) : logout.promise) : undefined });
  open("/"); fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));
  await waitFor(() => expect(notice().getByRole("status")).toHaveTextContent("Sign-out not confirmed"));
  expect(screen.getByText(user.email)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  expect(notice().getByRole("status")).toHaveTextContent("Signing you out");
  expect(screen.queryByText("You're signed out")).not.toBeInTheDocument();
  await act(async () => logout.resolve(new Response(null, { status: 204 })));
  await screen.findByRole("link", { name: "Sign in" });
  expect(notice().getByRole("status")).toHaveTextContent("You're signed out");
});

it("shows concise genre descriptions without changing API options or auto-saving", async () => {
  const requests = installApi({ loggedIn: true }); open("/preferences");
  const action = await screen.findByRole("checkbox", { name: "Action" });
  expect(action).toBeChecked();
  expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  expect(action).toHaveAccessibleDescription("High stakes, daring stunts and a rush of adrenaline.");
  expect(screen.getByText(/Tell Us What You/).textContent).toBe("Tell Us What You Love to Watch");
  fireEvent.click(screen.getByRole("checkbox", { name: "Comedy" }));
  expect(screen.getByText("2 of 5 selected")).toBeVisible();
  expect(requests).not.toContain("PUT /api/me/preferences");
  expect(genrePresentation(99999, "New genre").description).toBe("Discover more stories in new genre.");
});

it("keeps selections and inline recovery when preferences fail to save", async () => {
  const save = deferred();
  installApi({ loggedIn: true, override: (path, method) => path === "/api/me/preferences" && method === "PUT" ? save.promise : undefined });
  open("/preferences"); await screen.findByRole("checkbox", { name: "Action" });
  fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));
  expect(notice().getByRole("status")).toHaveTextContent("Saving your preferences");
  expect(screen.queryByText("Your taste is saved")).not.toBeInTheDocument();
  await act(async () => save.resolve(json({ error: { code: "SERVICE_UNAVAILABLE" } }, 503)));
  await screen.findByRole("alert");
  expect(notice().getByRole("status")).toHaveTextContent("Save not confirmed");
  expect(screen.getByRole("checkbox", { name: "Action" })).toBeChecked();
  expect(window.location.pathname).toBe("/preferences");
});

it("confirms a rating only after the matching saved response", async () => {
  const save = deferred();
  installApi({ loggedIn: true, override: (path, method) => path === "/api/me/ratings/m-1" && method === "PUT" ? save.promise : undefined });
  open("/movies/m-1");
  fireEvent.click(await screen.findByRole("radio", { name: "4 stars" }));
  fireEvent.click(screen.getByRole("button", { name: "Save rating" }));
  expect(notice().getByRole("status")).toHaveTextContent("Saving your rating");
  expect(screen.getByText("Not rated yet")).toBeVisible();
  expect(notice().queryByText("Rating saved")).not.toBeInTheDocument();
  await act(async () => save.resolve(json({ data: { movieId: "m-1", rating: 4 } })));
  await screen.findByText("Your saved rating: 4/5");
  expect(notice().getByRole("status")).toHaveTextContent("Rating saved");
});

it.each([{}, { genres: [] }, { genres: [genres[1]] }])("does not announce saved preferences for an invalid or mismatched acknowledgement %j", async data => {
  installApi({ loggedIn: true, override: (path, method) => path === "/api/me/preferences" && method === "PUT" ? json({ data }) : undefined });
  open("/preferences"); await screen.findByRole("checkbox", { name: "Action" });
  fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));
  await screen.findByRole("alert");
  expect(notice().getByRole("status")).toHaveTextContent("Save not confirmed");
  expect(screen.queryByText("Your taste is saved")).not.toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: "Action" })).toBeChecked();
  expect(window.location.pathname).toBe("/preferences");
});

it.each([503, 200])("does not announce Rating saved for failure or a mismatched saved value (%s)", async status => {
  installApi({ loggedIn: true, override: (path, method) => path === "/api/me/ratings/m-1" && method === "PUT" ?
    json(status === 200 ? { data: { movieId: "m-1", rating: 2 } } : { error: { code: "SERVICE_UNAVAILABLE" } }, status) : undefined });
  open("/movies/m-1"); fireEvent.click(await screen.findByRole("radio", { name: "4 stars" }));
  fireEvent.click(screen.getByRole("button", { name: "Save rating" }));
  await screen.findByRole("alert");
  expect(notice().getByRole("status")).toHaveTextContent("Rating save not confirmed");
  expect(screen.getByText("Not rated yet")).toBeVisible();
  expect(screen.getByRole("radio", { name: "4 stars" })).toBeChecked();
  expect(notice().queryByText("Rating saved")).not.toBeInTheDocument();
});

it("does not let a late rating completion overwrite sign-out feedback", async () => {
  const save = deferred();
  installApi({ loggedIn: true, override: (path, method) => path === "/api/me/ratings/m-1" && method === "PUT" ? save.promise : undefined });
  open("/movies/m-1"); fireEvent.click(await screen.findByRole("radio", { name: "5 stars" }));
  fireEvent.click(screen.getByRole("button", { name: "Save rating" }));
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  await screen.findByRole("link", { name: "Sign in" });
  await act(async () => save.resolve(json({ data: { movieId: "m-1", rating: 5 } })));
  expect(notice().getByRole("status")).toHaveTextContent("You're signed out");
  expect(screen.queryByText("5/5 saved to your account.")).not.toBeInTheDocument();
});

it("features the first server-ranked film only on Popular page one without changing list totals", async () => {
  const requests = installApi(); open("/popular");
  const spotlight = await screen.findByRole("region", { name: "Most popular movie spotlight" });
  expect(within(spotlight).getByRole("heading", { name: firstMovie.title })).toBeVisible();
  expect(spotlight).toHaveTextContent("95");
  expect(within(screen.getByRole("region", { name: "Popular movies" })).getAllByRole("article")).toHaveLength(1);
  expect(screen.getByText("Showing 1-1 of 11 movies")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByRole("heading", { name: "Page two" });
  expect(screen.queryByRole("region", { name: "Most popular movie spotlight" })).not.toBeInTheDocument();
  expect(requests.filter(request => request === "GET /api/movies/popular")).toHaveLength(2);
  expect(requests.some(request => request.includes("/api/movies/m-"))).toBe(false);
});

it("returns from the featured movie to the same Popular context", async () => {
  installApi(); open("/popular");
  fireEvent.click(await screen.findByRole("link", { name: `Explore featured movie ${firstMovie.title}` }));
  await screen.findByRole("heading", { name: firstMovie.title, level: 1 });
  fireEvent.click(screen.getByRole("link", { name: /Back to/ }));
  await screen.findByRole("region", { name: "Most popular movie spotlight" });
  expect(window.location.pathname).toBe("/popular");
  expect(JSON.stringify(window.history.state)).toContain("polish-r1");
});
