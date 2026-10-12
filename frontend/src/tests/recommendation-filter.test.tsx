// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../App.tsx";
import { AuthProvider } from "../auth/AuthContext.tsx";
import RequireAuth from "../auth/RequireAuth.tsx";
import type { Genre } from "../api/movies.ts";
import type { RecommendationMovie, RecommendationResult } from "../api/recommendations.ts";
import { AuthContext, useAuth, type AuthContextValue } from "../auth/authState.ts";
import RecommendationFilter from "../components/RecommendationFilter.tsx";

const action = { id: 28, name: "Action" };
const comedy = { id: 35, name: "Comedy" };
const horror = { id: 27, name: "Horror" };
const genres = [action, comedy, horror];

function movie(id: string, title: string, movieGenres: Genre[]): RecommendationMovie {
  return { id, title, releaseYear: 2024, genres: movieGenres, popularityScore: 80,
    reason: { matchedGenres: movieGenres } };
}

function fixture(personalised = false): RecommendationResult {
  return { movies: [
    movie("action-z", "Action Z", [action]),
    movie("comedy-c", "Comedy C", [comedy]),
    movie("action-a", "Action A", [action]),
    movie("comedy-a", "Comedy A", [comedy]),
    movie("comedy-b", "Comedy B", [comedy]),
  ], mode: personalised ? "personalised" : "popular", personalised, noMatch: false };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function installGenres() {
  return vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    if (String(input) === "/api/genres") return Promise.resolve(json({ data: { genres } }));
    return Promise.reject(new Error(`Unexpected request: ${String(input)}`));
  });
}

function mount(snapshot = fixture(), handleUnauthorized = vi.fn()) {
  const auth: AuthContextValue = { status: "authenticated", user: { id: "user-a", email: "a@example.com" },
    refresh: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), handleUnauthorized };
  function view(nextSnapshot: RecommendationResult) {
    return <MemoryRouter><AuthContext.Provider value={auth}>
      <RecommendationFilter snapshot={nextSnapshot} ariaLabel="Recommendations" />
    </AuthContext.Provider></MemoryRouter>;
  }
  const rendered = render(view(snapshot));
  return { ...rendered, update: (next: RecommendationResult) => rendered.rerender(view(next)) };
}

function titles() {
  return screen.queryAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
}

async function selectGenre(id: number) {
  const select = screen.getByRole("combobox", { name: "Filter by genre" });
  await waitFor(() => expect(select).toBeEnabled());
  fireEvent.change(select, { target: { value: String(id) } });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("S3-T15 current recommendation snapshot filter", () => {
  it("renders all five movies in server order with an accessible control", async () => {
    const fetchMock = installGenres();
    mount();
    await waitFor(() => expect(screen.getByLabelText("Filter by genre")).toBeEnabled());
    expect(titles()).toEqual(["Action Z", "Comedy C", "Action A", "Comedy A", "Comedy B"]);
    expect(screen.getByLabelText("Filter by genre")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Clear filter" })).toBeDisabled();
    expect(screen.getByText("Showing 5 of 5 movies")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/genres", expect.objectContaining({ credentials: "include", signal: expect.any(AbortSignal) }));
  });

  it("displays exactly two Action movies without reordering them", async () => {
    installGenres(); mount(); await selectGenre(28);
    expect(titles()).toEqual(["Action Z", "Action A"]);
    expect(screen.getByText("Showing 2 of 5 movies")).toBeInTheDocument();
  });

  it("displays exactly three Comedy movies", async () => {
    installGenres(); mount(); await selectGenre(35);
    expect(titles()).toEqual(["Comedy C", "Comedy A", "Comedy B"]);
  });

  it("shows a distinct empty-filter state and restores all five with Show all movies", async () => {
    installGenres(); mount(); await selectGenre(27);
    expect(titles()).toEqual([]);
    expect(screen.getByText("No movies match this filter.")).toBeInTheDocument();
    expect(screen.getByText("Showing 0 of 5 movies")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show all movies" }));
    expect(titles()).toEqual(["Action Z", "Comedy C", "Action A", "Comedy A", "Comedy B"]);
    expect(screen.queryByText("No movies match this filter.")).not.toBeInTheDocument();
  });

  it("Clear filter and All genres both restore the original frozen snapshot", async () => {
    installGenres(); const snapshot = fixture();
    const before = JSON.stringify(snapshot);
    Object.freeze(snapshot.movies); snapshot.movies.forEach((item) => Object.freeze(item));
    Object.freeze(snapshot); mount(snapshot); await selectGenre(28);
    fireEvent.click(screen.getByRole("button", { name: "Clear filter" }));
    expect(titles()).toHaveLength(5);
    await selectGenre(35);
    fireEvent.change(screen.getByLabelText("Filter by genre"), { target: { value: "" } });
    expect(titles()).toEqual(["Action Z", "Comedy C", "Action A", "Comedy A", "Comedy B"]);
    expect(JSON.stringify(snapshot)).toBe(before);
  });

  it("a newly accepted response resets the filter even if it reuses the same movies array", async () => {
    installGenres(); const old = fixture(); const view = mount(old); await selectGenre(28);
    view.update({ ...old });
    expect(screen.getByLabelText("Filter by genre")).toHaveValue("");
    expect(titles()).toHaveLength(5);
    await waitFor(() => expect(screen.getByLabelText("Filter by genre")).toBeEnabled());
  });

  it("uses only the new snapshot and never restores movies from the old one", async () => {
    installGenres(); const view = mount(); await selectGenre(28);
    view.update({ ...fixture(), movies: [movie("new-comedy", "New Comedy", [comedy])] });
    expect(titles()).toEqual(["New Comedy"]);
    expect(screen.getByText("Showing 1 of 1 movies")).toBeInTheDocument();
    await selectGenre(28);
    expect(titles()).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Clear filter" }));
    expect(titles()).toEqual(["New Comedy"]);
  });

  it("keeps a filter on rerender when the accepted response object is unchanged", async () => {
    installGenres(); const snapshot = fixture(); const view = mount(snapshot); await selectGenre(28);
    view.update(snapshot);
    expect(screen.getByLabelText("Filter by genre")).toHaveValue("28");
    expect(titles()).toEqual(["Action Z", "Action A"]);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("matches IDs instead of names and renders multi-genre movies only once", async () => {
    installGenres(); const snapshot = fixture();
    snapshot.movies[0] = movie("multi", "Multi genre", [{ id: 28, name: "Renamed action" }, comedy]);
    mount(snapshot); await selectGenre(28);
    expect(titles()).toEqual(["Multi genre", "Action A"]);
    expect(screen.getAllByText("Multi genre")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "View details for Multi genre" })).toHaveAttribute("href", "/movies/multi");
  });

  it("preserves personalised reasons and never adds them to popular cards", async () => {
    installGenres(); const view = mount(fixture(true)); await selectGenre(28);
    expect(screen.getAllByText("Matches your genres: Action")).toHaveLength(2);
    view.update(fixture(false));
    expect(screen.queryByText(/Matches your genres/)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Filter by genre")).toBeEnabled());
  });

  it("filtering and resetting make no requests or browser-storage writes", async () => {
    const fetchMock = installGenres(); const storageSpy = vi.spyOn(Storage.prototype, "setItem");
    mount(); await selectGenre(28); await selectGenre(27);
    fireEvent.click(screen.getByRole("button", { name: "Clear filter" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(storageSpy).not.toHaveBeenCalled();
  });

  it("keeps cards visible while options load and aborts the request on unmount", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise<Response>(() => undefined));
    const view = mount();
    expect(screen.getByText("Loading genre filters...")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by genre")).toBeDisabled();
    expect(titles()).toHaveLength(5);
    const signal = fetchMock.mock.calls[0][1]?.signal;
    view.unmount(); expect(signal?.aborted).toBe(true);
  });

  it("an options failure retains cards and retry only reloads genres", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ error: { message: "Service is temporarily unavailable" } }, 503))
      .mockResolvedValueOnce(json({ data: { genres } }));
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent("Genre filters are unavailable. Service is temporarily unavailable");
    expect(titles()).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: "Retry filter options" }));
    await selectGenre(28);
    expect(titles()).toHaveLength(2);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/api/genres", "/api/genres"]);
  });

  it("a network failure is a filter error, not an empty movie list", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    mount(); expect(await screen.findByRole("alert")).toHaveTextContent("Failed to fetch");
    expect(titles()).toHaveLength(5);
    expect(screen.queryByText("No movies match this filter.")).not.toBeInTheDocument();
  });

  it("empty genre options disable filtering without hiding movies", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ data: { genres: [] } }));
    mount(); expect(await screen.findByText("No genres are available for filtering.")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by genre")).toBeDisabled();
    expect(titles()).toHaveLength(5);
  });

  it("genre 401 uses the central auth handler", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ error: { code: "AUTHENTICATION_REQUIRED", message: "Authentication required" } }, 401));
    const unauthorized = vi.fn(); mount(fixture(), unauthorized);
    await waitFor(() => expect(unauthorized).toHaveBeenCalledTimes(1));
  });

  it.each(["success", "401"])("ignores a delayed old-snapshot genre %s response", async (kind) => {
    let finishOld!: (response: Response) => void;
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockReturnValueOnce(new Promise<Response>((resolve) => { finishOld = resolve; }))
      .mockResolvedValueOnce(json({ data: { genres: [comedy] } }));
    const unauthorized = vi.fn(); const view = mount(fixture(), unauthorized);
    const oldSignal = fetchMock.mock.calls[0][1]?.signal;
    view.update({ ...fixture(), movies: [movie("new", "New Comedy", [comedy])] });
    await waitFor(() => expect(screen.getByLabelText("Filter by genre")).toBeEnabled());
    await act(async () => { finishOld(kind === "401"
      ? json({ error: { message: "Authentication required" } }, 401)
      : json({ data: { genres: [action] } })); });
    expect(oldSignal?.aborted).toBe(true);
    expect(screen.queryByRole("option", { name: "Action" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Comedy" })).toBeInTheDocument();
    expect(unauthorized).not.toHaveBeenCalled();
    expect(titles()).toEqual(["New Comedy"]);
  });

  it("real page integration preserves popular labels and makes no preference writes or recommendation refetch", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url === "/api/auth/me") return Promise.resolve(json({ data: { user: { id: "user-a", email: "a@example.com" } } }));
      if (url === "/api/me/recommendations?limit=10") return Promise.resolve(json({ data: fixture() }));
      if (url === "/api/genres") return Promise.resolve(json({ data: { genres } }));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    window.history.pushState({}, "", "/recommendations"); render(<App />);
    await screen.findByRole("heading", { name: "Popular" }); await selectGenre(28);
    expect(screen.getByText("Not personalised")).toBeInTheDocument();
    expect(document.querySelectorAll(".movie-card")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Clear filter" }));
    expect(document.querySelectorAll(".movie-card")).toHaveLength(5);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/api/auth/me", "/api/me/recommendations?limit=10", "/api/genres"]);
    expect(fetchMock.mock.calls.every(([, options]) => !options?.method || options.method === "GET")).toBe(true);
  });

  it("account-keyed guard discards the old filter even when a consumer reuses a snapshot", async () => {
    const snapshot = fixture();
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url === "/api/genres") return Promise.resolve(json({ data: { genres } }));
      if (url === "/api/auth/me") return Promise.resolve(json({ data: { user: { id: "user-a", email: "a@example.com" } } }));
      if (url === "/api/auth/login") return Promise.resolve(json({ data: { user: { id: "user-b", email: "b@example.com" } } }));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    function Probe() {
      const auth = useAuth();
      return <>
        <button onClick={() => void auth.signIn("b@example.com", "test-password")}>Switch account</button>
        <RecommendationFilter snapshot={snapshot} ariaLabel="Recommendations" />
      </>;
    }
    render(<MemoryRouter><AuthProvider><RequireAuth><Probe /></RequireAuth></AuthProvider></MemoryRouter>);
    await screen.findByLabelText("Filter by genre"); await selectGenre(28);
    expect(titles()).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Switch account" }));
    await waitFor(() => expect(screen.getByLabelText("Filter by genre")).toHaveValue(""));
    expect(titles()).toHaveLength(5);
    await waitFor(() => expect(screen.getByLabelText("Filter by genre")).toBeEnabled());
  });
});
