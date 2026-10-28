// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import App from "../App.tsx";
import { AuthProvider } from "../auth/AuthContext.tsx";
import RequireAuth from "../auth/RequireAuth.tsx";
import { useAuth } from "../auth/authState.ts";
import PublicMovieList from "../components/PublicMovieList.tsx";
import MovieDetailPage from "../pages/MovieDetailPage.tsx";
import RecommendationsPage from "../pages/RecommendationsPage.tsx";

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status,
    headers: { "Content-Type": "application/json" } }));
}

const action = { id: 28, name: "Action" };
const movie = (title: string, id: string) => ({
  id, title, releaseYear: 2025, genres: [action], popularityScore: 90,
  reason: { matchedGenres: [action] },
});

function recommendations(movies: ReturnType<typeof movie>[], page: number,
  total: number, revision = "rev-a") {
  return { data: { movies, mode: "personalised", personalised: true, noMatch: false },
    meta: { count: movies.length, limit: 10, page, total,
      totalPages: Math.ceil(total / 10), unfilteredTotal: total,
      catalogueRevision: revision } };
}

function Controls() {
  const auth = useAuth();
  const navigate = useNavigate();
  return <>
    <button type="button" onClick={() => void auth.signIn("b@example.com", "movie123")}>Switch account</button>
    <button type="button" onClick={() => navigate("/preferences")}>Open preferences</button>
    <button type="button" onClick={() => navigate("/recommendations?source=t34#results")}>Add source context</button>
    <button type="button" onClick={() => {
      auth.invalidateRecommendations(); navigate("/recommendations");
    }}>Save new preferences</button>
    <button type="button" onClick={() => navigate(-1)}>Browser Back</button>
  </>;
}

function renderRecommendationsWithControls() {
  return render(<BrowserRouter><AuthProvider><Controls /><Routes>
    <Route path="/recommendations" element={<RequireAuth><RecommendationsPage /></RequireAuth>} />
    <Route path="/preferences" element={<p>Preferences screen</p>} />
    <Route path="/movies/:movieId" element={<MovieDetailPage />} />
  </Routes></AuthProvider></BrowserRouter>);
}

function AddSourceContext() {
  const location = useLocation();
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate({ pathname: location.pathname,
    search: "?page=2&source=shared", hash: "#results" })}>Share current page</button>;
}

function delayedResponse() {
  let resolve!: (response: Response) => void;
  const pending = new Promise<Response>(done => { resolve = done; });
  return { pending, resolve };
}

afterEach(() => {
  cleanup(); vi.restoreAllMocks(); window.history.replaceState({}, "", "/");
  window.sessionStorage.clear();
});

it("resets A's page and genre before B's recommendation request", async () => {
  let account = "A";
  const requests: { account: string; url: string }[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation((input, options) => {
    const url = String(input);
    if (url === "/api/auth/me") return json({ data: { user: { id: "a", email: "a@example.com" } } });
    if (url === "/api/auth/login" && options?.method === "POST") {
      account = "B";
      return json({ data: { user: { id: "b", email: "b@example.com" } } });
    }
    if (url === "/api/genres") return json({ data: { genres: [action] } });
    if (url.startsWith("/api/me/recommendations?")) {
      requests.push({ account, url });
      const params = new URL(url, "http://localhost").searchParams;
      return account === "A" ?
        json(recommendations([movie("A Movie 11", "a11")], Number(params.get("page")), 12)) :
        json(recommendations([movie("B Movie", "b1")], Number(params.get("page") ?? 1), 1));
    }
    throw new Error(`Unexpected request ${url}`);
  });
  window.history.pushState({}, "", "/recommendations?page=2&genreId=28");
  renderRecommendationsWithControls();
  expect(await screen.findByText("A Movie 11")).toBeInTheDocument();
  await waitFor(() => expect(window.history.state.usr?.listViewContext?.accountId).toBe("a"));
  fireEvent.click(screen.getByRole("button", { name: "Switch account" }));
  expect(await screen.findByText("B Movie")).toBeInTheDocument();
  expect(window.location.search).toBe("?page=1");
  expect(requests.filter(request => request.account === "B")).toEqual([
    { account: "B", url: expect.stringMatching(/^\/api\/me\/recommendations\?limit=10/) },
  ]);
  expect(requests.filter(request => request.account === "B")
    .every(request => !request.url.includes("genreId=") && !request.url.includes("page=2"))).toBe(true);
});

it.each([200, 401, 409, 503])("rejects A's delayed filtered page (%s) after switching to B", async status => {
  const delayed = delayedResponse();
  let account = "a";
  let oldSignal: AbortSignal | null | undefined;
  const requests: { account: string; url: string }[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation((input, options) => {
    const url = String(input);
    if (url === "/api/auth/me") return json({ data: { user: { id: "a", email: "a@example.com" } } });
    if (url === "/api/auth/login") {
      account = "b";
      return json({ data: { user: { id: "b", email: "b@example.com" } } });
    }
    if (url === "/api/genres") return json({ data: { genres: [action] } });
    if (url.startsWith("/api/me/recommendations?")) {
      requests.push({ account, url });
      if (account === "a" && url.includes("page=2")) {
        oldSignal = options?.signal;
        return delayed.pending; // Intentionally ignores cancellation in the transport.
      }
      return account === "a"
        ? json(recommendations([movie("A private ranking", "a1")], 1, 12))
        : json(recommendations([movie("B current ranking", "b1")], 1, 1, "rev-b"));
    }
    throw new Error(`Unexpected request ${url}`);
  });
  window.history.pushState({}, "", "/recommendations?page=1&genreId=28");
  renderRecommendationsWithControls();
  await screen.findByText("A private ranking");
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => expect(oldSignal).toBeDefined());
  fireEvent.click(screen.getByRole("button", { name: "Switch account" }));
  await screen.findByText("B current ranking");
  const accepted = window.history.state.usr.listViewContext;
  expect(accepted).toMatchObject({ accountId: "b", catalogueRevision: "rev-b" });
  expect(oldSignal?.aborted).toBe(true);
  await act(async () => delayed.resolve(new Response(JSON.stringify(status === 200
    ? recommendations([movie("A obsolete ranking", "a2")], 2, 12, "rev-obsolete")
    : { error: { code: status === 401 ? "AUTHENTICATION_REQUIRED" : status === 409
      ? "CATALOGUE_CHANGED" : "SERVICE_UNAVAILABLE", message: "Old account failure" } }), { status })));
  expect(window.location.search).toBe("?page=1");
  expect(window.history.state.usr.listViewContext).toEqual(accepted);
  expect(screen.getByText("B current ranking")).toBeInTheDocument();
  expect(screen.queryByText(/A (private|obsolete) ranking/)).not.toBeInTheDocument();
  expect(screen.getByRole("combobox")).toHaveValue("");
  expect(requests.filter(request => request.account === "b")).toHaveLength(1);
  expect(requests.filter(request => request.account === "b").every(({ url }) =>
    !url.includes("genreId=") && !url.includes("rev-a") && !url.includes("page=2"))).toBe(true);
});

it("ignores a filtered page after unmount and fetches the current snapshot on Back", async () => {
  const delayed = delayedResponse();
  let pendingPage = true;
  let oldSignal: AbortSignal | null | undefined;
  const requests: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation((input, options) => {
    const url = String(input);
    if (url === "/api/auth/me") return json({ data: { user: { id: "a", email: "a@example.com" } } });
    if (url === "/api/genres") return json({ data: { genres: [action] } });
    if (url.startsWith("/api/me/recommendations?")) {
      requests.push(url);
      if (url.includes("page=2") && pendingPage) {
        oldSignal = options?.signal; pendingPage = false;
        return delayed.pending;
      }
      const page = url.includes("page=2") ? 2 : 1;
      return json(recommendations([movie(page === 1 ? "Initial movie" : "Latest movie", "a1")], page, 12));
    }
    throw new Error(`Unexpected request ${url}`);
  });
  window.history.pushState({}, "", "/recommendations?page=1&genreId=28");
  renderRecommendationsWithControls();
  await screen.findByText("Initial movie");
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => expect(oldSignal).toBeDefined());
  fireEvent.click(screen.getByRole("button", { name: "Open preferences" }));
  await screen.findByText("Preferences screen");
  expect(oldSignal?.aborted).toBe(true);
  await act(async () => delayed.resolve(new Response(JSON.stringify(
    recommendations([movie("Obsolete movie", "old")], 2, 12, "rev-obsolete")), { status: 200 })));
  expect(window.location.pathname).toBe("/preferences");
  expect(screen.queryByText("Obsolete movie")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Browser Back" }));
  await screen.findByText("Latest movie");
  expect(window.location.search).toBe("?page=2&genreId=28");
  expect(requests.at(-1)).toContain("catalogueRevision=rev-a");
  expect(window.history.state.usr.listViewContext).toMatchObject({ accountId: "a", catalogueRevision: "rev-a" });
  expect(screen.queryByText("Obsolete movie")).not.toBeInTheDocument();
});

it("discards A's detail return page, genre and revision after signing in as B", async () => {
  let account = "a";
  const requests: { account: string; url: string }[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url = String(input);
    if (url === "/api/auth/me") return json({ data: { user: { id: "a", email: "a@example.com" } } });
    if (url === "/api/auth/login") {
      account = "b";
      return json({ data: { user: { id: "b", email: "b@example.com" } } });
    }
    if (url === "/api/genres") return json({ data: { genres: [action] } });
    if (url.startsWith("/api/me/recommendations?")) {
      requests.push({ account, url });
      return account === "a"
        ? json(recommendations([movie("A private movie", "a1")], 2, 12))
        : json(recommendations([movie("B private movie", "b1")], 1, 1, "rev-b"));
    }
    if (url === "/api/movies/a1") return json({ data: { movie: {
      ...movie("A private movie", "a1"), overview: "Public detail", voteAverage: null, voteCount: null,
    } } });
    if (url === "/api/me/ratings/a1") return json({ data: { movieId: "a1", rating: null } });
    if (url === "/api/me/watchlist/a1") return json({ data: { movieId: "a1", inWatchlist: false } });
    if (url.startsWith("/api/movies/a1/similar")) return json({ data: { movies: [] } });
    throw new Error(`Unexpected request ${url}`);
  });
  window.history.pushState({}, "", "/recommendations?page=2&genreId=28");
  renderRecommendationsWithControls();
  await screen.findByText("A private movie");
  const contextA = window.history.state.usr.listViewContext;
  fireEvent.click(screen.getByRole("link", { name: "View details for A private movie" }));
  await screen.findByText("Public detail");
  expect(window.history.state.usr.listViewContext).toEqual(contextA);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Switch account" })));
  fireEvent.click(screen.getByRole("link", { name: "Back to recommendations" }));
  await screen.findByText("B private movie");
  expect(window.location.search).toBe("?page=1");
  expect(window.history.state.usr.listViewContext).toMatchObject({ accountId: "b", catalogueRevision: "rev-b" });
  expect(window.history.state.usr.listViewContext.recommendationScope).not.toBe(contextA.recommendationScope);
  expect(requests.filter(request => request.account === "b")).toEqual([
    { account: "b", url: "/api/me/recommendations?limit=10" },
  ]);
  expect(screen.queryByText("A private movie")).not.toBeInTheDocument();
});

it("browser Back cannot restore an old filter after preferences change", async () => {
  const requests: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(input => {
    const url = String(input);
    if (url === "/api/auth/me") return json({ data: { user: { id: "a", email: "a@example.com" } } });
    if (url === "/api/genres") return json({ data: { genres: [action] } });
    if (url.startsWith("/api/me/recommendations?")) {
      requests.push(url);
      const page = Number(new URL(url, "http://localhost").searchParams.get("page") ?? 1);
      return json(recommendations([movie(page === 2 ? "Old Movie" : "New Movie", "a1")],
        page, page === 2 ? 12 : 1));
    }
    throw new Error(`Unexpected request ${url}`);
  });
  window.history.pushState({}, "", "/recommendations?page=2&genreId=28");
  renderRecommendationsWithControls();
  expect(await screen.findByText("Old Movie")).toBeInTheDocument();
  await waitFor(() => expect(window.history.state.usr?.listViewContext?.catalogueRevision)
    .toBe("rev-a"));
  fireEvent.click(screen.getByRole("button", { name: "Open preferences" }));
  await waitFor(() => expect(window.location.pathname).toBe("/preferences"));
  fireEvent.click(screen.getByRole("button", { name: "Save new preferences" }));
  await waitFor(() => expect(window.location.search).toBe(""));
  expect(await screen.findByText("New Movie")).toBeInTheDocument();
  const afterSave = requests.length;
  fireEvent.click(screen.getByRole("button", { name: "Browser Back" }));
  await waitFor(() => expect(window.location.pathname).toBe("/preferences"));
  fireEvent.click(screen.getByRole("button", { name: "Browser Back" }));
  await waitFor(() => expect(window.location.pathname).toBe("/recommendations"));
  await waitFor(() => expect(window.location.search).toBe("?page=1"));
  expect(requests.slice(afterSave).every(url => !url.includes("genreId=28") &&
    !url.includes("page=2"))).toBe(true);
});

it("keeps a detail navigation when only the recommendation source and hash change", async () => {
  const requests: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(input => {
    const url = String(input);
    if (url === "/api/auth/me") return json({ data: { user: { id: "a", email: "a@example.com" } } });
    if (url === "/api/genres") return json({ data: { genres: [action] } });
    if (url.startsWith("/api/me/recommendations?")) {
      requests.push(url);
      return json(recommendations([movie("Source Movie", "source-1")], 1, 1));
    }
    if (url === "/api/movies/source-1") return json({ data: { movie: {
      ...movie("Source Movie", "source-1"), overview: "Source detail",
      voteAverage: null, voteCount: null, backdropUrl: null } } });
    if (url === "/api/me/ratings/source-1")
      return json({ data: { movieId: "source-1", rating: null } });
    throw new Error(`Unexpected request ${url}`);
  });
  window.history.pushState({}, "", "/recommendations");
  renderRecommendationsWithControls();
  expect(await screen.findByText("Source Movie")).toBeInTheDocument();
  await waitFor(() => expect(window.history.state.usr?.listViewContext?.catalogueRevision)
    .toBe("rev-a"));
  const beforeSource = requests.length;
  fireEvent.click(screen.getByRole("button", { name: "Add source context" }));
  await waitFor(() => expect(window.location.search).toBe("?source=t34"));
  fireEvent.click(screen.getByRole("link", { name: "View details for Source Movie" }));
  expect(await screen.findByText("Source detail")).toBeInTheDocument();
  await waitFor(() => expect(window.location.pathname).toBe("/movies/source-1"));
  expect(requests).toHaveLength(beforeSource);
});

it.each([
  ["/", "catalogue"], ["/popular", "popular"],
] as const)("preserves the new URL when a pending %s response stamps revision", async (route, kind) => {
  const delayed = delayedResponse();
  const requests: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(input => {
    const url = String(input);
    if (url === "/api/auth/me") return json({ error: { code: "AUTHENTICATION_REQUIRED" } }, 401);
    if (url.startsWith(kind === "popular" ? "/api/movies/popular?" : "/api/movies?")) {
      requests.push(url);
      return delayed.pending;
    }
    throw new Error(`Unexpected request ${url}`);
  });
  window.history.pushState({}, "", `${route}?page=2`);
  render(<BrowserRouter><AuthProvider><AddSourceContext /><Routes>
    <Route path={route} element={<PublicMovieList kind={kind} />} />
  </Routes></AuthProvider></BrowserRouter>);
  await waitFor(() => expect(requests).toHaveLength(1));
  fireEvent.click(screen.getByRole("button", { name: "Share current page" }));
  await waitFor(() => expect(window.location.href).toContain("?page=2&source=shared#results"));
  await act(async () => delayed.resolve(new Response(JSON.stringify({
    data: { movies: [movie("Delayed public movie", "delayed-public")] },
    meta: { count: 1, limit: 10, page: 2, total: 12, totalPages: 2,
      unfilteredTotal: 12, catalogueRevision: "rev-delayed" },
  }), { status: 200, headers: { "Content-Type": "application/json" } })));
  const grid = await screen.findByRole("region", { name: kind === "popular" ? "Popular movies" : "Movie catalogue" });
  expect(within(grid).getByRole("heading", { name: "Delayed public movie" })).toBeInTheDocument();
  expect(window.location.pathname).toBe(route);
  expect(window.location.search).toBe("?page=2&source=shared");
  expect(window.location.hash).toBe("#results");
  expect(window.history.state.usr?.listViewContext?.catalogueRevision).toBe("rev-delayed");
  expect(requests).toHaveLength(1);
});

it("preserves the new URL when a pending recommendation response stamps revision", async () => {
  const delayed = delayedResponse();
  const requests: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(input => {
    const url = String(input);
    if (url === "/api/auth/me") return json({ data: { user: { id: "a", email: "a@example.com" } } });
    if (url === "/api/genres") return json({ data: { genres: [action] } });
    if (url.startsWith("/api/me/recommendations?")) {
      requests.push(url);
      return delayed.pending;
    }
    throw new Error(`Unexpected request ${url}`);
  });
  window.history.pushState({}, "", "/recommendations?page=2");
  render(<BrowserRouter><AuthProvider><AddSourceContext /><Routes>
    <Route path="/recommendations" element={<RequireAuth><RecommendationsPage /></RequireAuth>} />
  </Routes></AuthProvider></BrowserRouter>);
  await waitFor(() => expect(requests).toHaveLength(1));
  fireEvent.click(screen.getByRole("button", { name: "Share current page" }));
  await waitFor(() => expect(window.location.href).toContain("?page=2&source=shared#results"));
  await act(async () => delayed.resolve(new Response(JSON.stringify(
    recommendations([movie("Delayed recommendation", "delayed-rec")], 2, 12, "rev-delayed")),
  { status: 200, headers: { "Content-Type": "application/json" } })));
  expect(await screen.findByText("Delayed recommendation")).toBeInTheDocument();
  expect(window.location.search).toBe("?page=2&source=shared");
  expect(window.location.hash).toBe("#results");
  expect(window.history.state.usr?.listViewContext?.catalogueRevision).toBe("rev-delayed");
  expect(requests).toHaveLength(1);
});

it("returns from details with the old revision and resets a changed catalogue", async () => {
  let activeRevision = "rev-a";
  const requests: string[] = [];
  const movies = Array.from({ length: 25 }, (_, index) =>
    movie(`Movie ${String(index + 1).padStart(2, "0")}`, `movie-${index + 1}`));
  vi.spyOn(globalThis, "fetch").mockImplementation(input => {
    const url = String(input);
    if (url === "/api/auth/me") return json({ error: { code: "AUTHENTICATION_REQUIRED" } }, 401);
    if (url.startsWith("/api/movies/popular?")) {
      requests.push(url);
      const params = new URL(url, "http://localhost").searchParams;
      if (params.get("catalogueRevision") === "rev-a" && activeRevision === "rev-b")
        return json({ error: { code: "CATALOGUE_CHANGED", message: "Catalogue changed" } }, 409);
      const page = Number(params.get("page") ?? 1);
      const source = activeRevision === "rev-a" ? movies : movies.slice(0, 20);
      const selected = source.slice((page - 1) * 10, page * 10);
      return json({ data: { movies: selected }, meta: { count: selected.length,
        limit: 10, page, total: source.length, totalPages: Math.ceil(source.length / 10),
        unfilteredTotal: source.length, catalogueRevision: activeRevision } });
    }
    if (url === "/api/movies/movie-11") return json({ data: { movie: {
      ...movies[10], overview: "Detail", voteAverage: null,
      voteCount: null, backdropUrl: null } } });
    throw new Error(`Unexpected request ${url}`);
  });
  window.history.pushState({}, "", "/popular?page=2"); render(<App />);
  expect(await screen.findByText("Showing 11-20 of 25 movies")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: "View details for Movie 11" }));
  expect(await screen.findByText("Detail")).toBeInTheDocument();
  activeRevision = "rev-b";
  const beforeReturn = requests.length;
  fireEvent.click(screen.getByRole("link", { name: "Back to popular movies" }));
  expect(await screen.findByText("Showing 1-10 of 20 movies")).toBeInTheDocument();
  expect(window.location.search).toBe("?page=1");
  expect(requests.slice(beforeReturn).some(url => url.includes("page=2") &&
    url.includes("catalogueRevision=rev-a"))).toBe(true);
});

it("TC-S4-T16-RET-002 clears a stale genre after the detail return detects a new revision", async () => {
  let activeRevision = "rev-a";
  const requests: string[] = [];
  const sample = movie("Filtered Movie", "filtered-11");
  vi.spyOn(globalThis, "fetch").mockImplementation(input => {
    const url = String(input);
    if (url === "/api/auth/me") return json({ data: { user: { id: "a", email: "a@example.com" } } });
    if (url === "/api/genres") return json({ data: { genres: [action] } });
    if (url.startsWith("/api/me/recommendations?")) {
      requests.push(url);
      const params = new URL(url, "http://localhost").searchParams;
      if (params.get("catalogueRevision") === "rev-a" && activeRevision === "rev-b")
        return json({ error: { code: "CATALOGUE_CHANGED", message: "Catalogue changed" } }, 409);
      return json(recommendations([sample], Number(params.get("page") ?? 1),
        activeRevision === "rev-a" ? 12 : 1, activeRevision));
    }
    if (url === "/api/movies/filtered-11") return json({ data: { movie: {
      ...sample, overview: "Filtered detail", voteAverage: null,
      voteCount: null, backdropUrl: null } } });
    throw new Error(`Unexpected request ${url}`);
  });
  window.history.pushState({}, "", "/recommendations?page=2&genreId=28");
  render(<App />);
  expect(await screen.findByText("Showing 11-11 of 12 matches (12 recommendations before filtering)"))
    .toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: "View details for Filtered Movie" }));
  expect(await screen.findByText("Filtered detail")).toBeInTheDocument();
  activeRevision = "rev-b";
  const beforeReturn = requests.length;
  fireEvent.click(screen.getByRole("link", { name: "Back to recommendations" }));
  expect(await screen.findByText("Showing 1-1 of 1 movies"))
    .toBeInTheDocument();
  expect(window.location.search).toBe("?page=1");
  expect(requests.slice(beforeReturn).some(url => url.includes("page=2") &&
    url.includes("genreId=28") && url.includes("catalogueRevision=rev-a"))).toBe(true);
  expect(requests.at(-1)).not.toContain("genreId=");
});

it("offers Clear filter when the server rejects an unknown genre", async () => {
  const requests: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(input => {
    const url = String(input);
    if (url === "/api/auth/me") return json({ data: { user: { id: "a", email: "a@example.com" } } });
    if (url === "/api/genres") return json({ data: { genres: [action] } });
    if (url.startsWith("/api/me/recommendations?")) {
      requests.push(url);
      if (url.includes("genreId=999")) return json({ error: {
        code: "GENRE_NOT_FOUND", message: "Genre not found" } }, 400);
      return json(recommendations([movie("Recovered movie", "a1")], 1, 1));
    }
    throw new Error(`Unexpected request ${url}`);
  });
  window.history.pushState({}, "", "/recommendations?page=2&genreId=999");
  render(<App />);
  expect(await screen.findByText(/Genre not found/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Clear filter" }));
  expect(await screen.findByText("Recovered movie")).toBeInTheDocument();
  expect(window.location.search).toBe("?page=1");
  expect(requests.at(-1)).not.toContain("genreId=");
});
