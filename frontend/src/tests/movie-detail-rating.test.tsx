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
import { afterEach, expect, it, vi } from "vitest";
import App from "../App.tsx";

const user = { id: "a", email: "a@example.com" };
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}
function movie(id = "movie-a") {
  return {
    id,
    title: `Title ${id}`,
    genres: [],
    overview: "Public overview",
    releaseYear: 2025,
    popularityScore: 90,
    voteAverage: null,
    voteCount: null,
  };
}
function deferred() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

it("restores a saved rating on a direct detail load without changing preferences", async () => {
  window.history.pushState({}, "", "/movies/movie-a");
  const calls: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const path = String(input);
    calls.push(path);
    if (path === "/api/movies/movie-a")
      return json({ data: { movie: movie() } });
    if (path === "/api/auth/me") return json({ data: { user } });
    if (path === "/api/me/ratings/movie-a")
      return json({ data: { movieId: "movie-a", rating: 5 } });
    throw new Error(`Unexpected request: ${path}`);
  });
  render(<App />);
  await screen.findByText("Your saved rating: 5/5");
  expect(screen.getByText("Public overview")).toBeInTheDocument();
  expect(calls).toEqual([
    "/api/movies/movie-a",
    "/api/auth/me",
    "/api/me/ratings/movie-a",
  ]);
});

it("public content stays visible while session checking waits without private reads", async () => {
  window.history.pushState({}, "", "/movies/movie-a");
  const session = deferred();
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(json({ data: { movie: movie() } }))
    .mockReturnValueOnce(session.promise);
  render(<App />);
  await screen.findByText("Public overview");
  expect(screen.getByText("Checking sign-in status...")).toBeInTheDocument();
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  await act(async () => {
    session.resolve(json({}, 401));
  });
  await screen.findByRole("link", { name: "Sign in to rate this movie" });
  expect(window.location.pathname).toBe("/movies/movie-a");
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("a failed session check has retry without hiding details or faking unrated", async () => {
  window.history.pushState({}, "", "/movies/movie-a");
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(json({ data: { movie: movie() } }))
    .mockResolvedValueOnce(json({ error: { message: "Unavailable" } }, 503))
    .mockResolvedValueOnce(json({ data: { user } }))
    .mockResolvedValueOnce(json({ data: { movieId: "movie-a", rating: 3 } }));
  render(<App />);
  await screen.findByRole("button", { name: "Retry session check" });
  expect(screen.getByText("Public overview")).toBeInTheDocument();
  expect(screen.queryByText("Not rated yet")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry session check" }));
  await screen.findByText("Your saved rating: 3/5");
});

it("unmounts the previous private widget while a new movie is loading", async () => {
  window.history.pushState({}, "", "/movies/movie-a");
  const nextMovie = deferred();
  const oldSave = deferred();
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, options) => {
    const path = String(input);
    if (path === "/api/movies/movie-a")
      return json({ data: { movie: movie() } });
    if (path === "/api/auth/me") return json({ data: { user } });
    if (path === "/api/me/ratings/movie-a")
      return options?.method === "PUT"
        ? oldSave.promise
        : json({ data: { movieId: "movie-a", rating: 3 } });
    if (path === "/api/movies/movie-b") return nextMovie.promise;
    if (path === "/api/me/ratings/movie-b")
      return json({ data: { movieId: "movie-b", rating: null } });
    throw new Error(`Unexpected request: ${path}`);
  });
  render(<App />);
  await screen.findByText("Your saved rating: 3/5");
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "5" } });
  fireEvent.click(screen.getByRole("button", { name: "Save rating" }));
  await act(async () => {
    window.history.pushState({}, "", "/movies/movie-b");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  expect(screen.getByText("Loading movie...")).toBeInTheDocument();
  expect(screen.queryByText("Your saved rating: 3/5")).not.toBeInTheDocument();
  await act(async () => {
    nextMovie.resolve(json({ data: { movie: movie("movie-b") } }));
  });
  await screen.findByText("Not rated yet");
  await act(async () => {
    oldSave.resolve(json({ error: { code: "AUTHENTICATION_REQUIRED" } }, 401));
  });
  expect(window.location.pathname).toBe("/movies/movie-b");
  expect(screen.getByText("Not rated yet")).toBeInTheDocument();
});

it("a retry for an old movie cannot replace the new route or its widget", async () => {
  window.history.pushState({}, "", "/movies/movie-a");
  const oldRetry = deferred();
  let attempts = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const path = String(input);
    if (path === "/api/movies/movie-a")
      return ++attempts === 1 ? json({}, 503) : oldRetry.promise;
    if (path === "/api/movies/movie-b")
      return json({ data: { movie: movie("movie-b") } });
    if (path === "/api/auth/me") return json({}, 401);
    throw new Error(`Unexpected request: ${path}`);
  });
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
  await act(async () => {
    window.history.pushState({}, "", "/movies/movie-b");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await screen.findByRole("heading", { name: "Title movie-b" });
  await act(async () => {
    oldRetry.resolve(json({ data: { movie: movie() } }));
  });
  expect(
    screen.queryByRole("heading", { name: "Title movie-a" }),
  ).not.toBeInTheDocument();
});
