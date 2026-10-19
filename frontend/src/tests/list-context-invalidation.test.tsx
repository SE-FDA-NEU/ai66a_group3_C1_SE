// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import App from "../App.tsx";
import { AuthProvider } from "../auth/AuthContext.tsx";
import RequireAuth from "../auth/RequireAuth.tsx";
import { useAuth } from "../auth/authState.ts";
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
  </Routes></AuthProvider></BrowserRouter>);
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

it("returns from recommendation details with its revision and keeps the filter on page 1", async () => {
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
  expect(await screen.findByText("Showing 1-1 of 1 matches (1 recommendations before filtering)"))
    .toBeInTheDocument();
  expect(window.location.search).toBe("?page=1&genreId=28");
  expect(requests.slice(beforeReturn).some(url => url.includes("page=2") &&
    url.includes("genreId=28") && url.includes("catalogueRevision=rev-a"))).toBe(true);
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
