// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../App";
import SearchPage from "../pages/SearchPage.tsx";
import { resolveMovieDetailReturn } from "../navigation/movieDetailReturn.ts";

function jsonResponse(body: unknown, status = 200) {
  const payload = body as { data?: { movies?: unknown[] }; meta?: unknown };
  if (Array.isArray(payload.data?.movies) && !payload.meta) {
    const count = payload.data.movies.length;
    body = { ...payload, meta: { count, limit: 10, page: 1, total: count,
      totalPages: count ? 1 : 0, unfilteredTotal: count, catalogueRevision: "" } };
  }
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

const movies = Array.from({ length: 10 }, (_, index) => ({
  id: `movie-${index + 1}`,
  title: `Movie ${index + 1}`,
  releaseYear: index === 0 ? null : 2000 + index,
  genres: [{ id: 28, name: "Action" }],
  popularityScore: 100 - index,
}));

function deferredResponse() {
  let resolve!: (value: Response) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<Response>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function submitQuery(value: string) {
  fireEvent.change(screen.getByRole("searchbox", { name: "Title or description" }), { target: { value } });
  fireEvent.submit(screen.getByRole("search", { name: "Movie search" }));
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("S08 public search UI", () => {
  it("paginates every match and resets to page one only after submitting a new query", async () => {
    const source = [...movies, { ...movies[0], id: "eleven", title: "Movie 11" },
      { ...movies[0], id: "twelve", title: "Movie 12" }];
    const searches: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(input => {
      const url = new URL(String(input), "http://localhost");
      if (url.pathname === "/api/auth/me") return jsonResponse({}, 401);
      searches.push(url.search);
      const page = Number(url.searchParams.get("page") ?? 1);
      const rows = source.slice((page - 1) * 10, page * 10);
      return jsonResponse({ data: { movies: rows }, meta: { count: rows.length,
        limit: 10, page, total: 12, totalPages: 2, unfilteredTotal: 12, catalogueRevision: "rev-a" } });
    });
    window.history.replaceState({}, "", "/search?q=moon&source=t16#results");
    render(<App />);
    await screen.findByText("Showing 1-10 of 12 movies");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Showing 11-12 of 12 movies");
    expect(screen.getByText("Movie 11")).toBeInTheDocument();
    expect(screen.queryByText("Movie 1")).not.toBeInTheDocument();
    expect(searches).toHaveLength(2);
    expect(searches[1]).toContain("page=2&catalogueRevision=rev-a");
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "new moon" } });
    expect(searches).toHaveLength(2);
    fireEvent.submit(screen.getByRole("search", { name: "Movie search" }));
    await screen.findByText("Showing 1-10 of 12 movies");
    expect(new URLSearchParams(window.location.search).get("page")).toBeNull();
    expect(new URLSearchParams(window.location.search).get("source")).toBe("t16");
    expect(window.location.hash).toBe("#results");
    expect(searches[2]).toBe("?q=new+moon");
  });

  it("recovers a changed catalogue on a deep result page by fetching page one", async () => {
    const searches: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(input => {
      const url = new URL(String(input), "http://localhost");
      if (url.pathname === "/api/auth/me") return jsonResponse({}, 401);
      searches.push(url.search);
      if (searches.length === 1) return jsonResponse({ error: {
        code: "CATALOGUE_CHANGED", message: "Movie catalogue changed; reload page 1" } }, 409);
      return jsonResponse({ data: { movies: [movies[0]] } });
    });
    window.history.replaceState({}, "", "/search?q=moon&page=2#results");
    render(<App />);
    expect(await screen.findByText("Movie 1")).toBeInTheDocument();
    expect(searches).toEqual(["?q=moon&page=2", "?q=moon"]);
    expect(new URLSearchParams(window.location.search).get("page")).toBe("1");
    expect(window.location.hash).toBe("#results");
  });

  it("keeps typing local until an explicit submit and commits only the submitted query", async () => {
    window.history.replaceState({}, "", "/search?source=t16#results");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(input =>
      String(input) === "/api/auth/me" ? jsonResponse({}, 401) : jsonResponse({ data: { movies: [movies[0]] } }));
    render(<App />);
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "moon rescue" } });
    await act(async () => { await Promise.resolve(); });
    expect(fetchMock.mock.calls.filter(([url]) => String(url).startsWith("/api/movies/search?"))).toHaveLength(0);
    expect(window.location.search).toBe("?source=t16");
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    fireEvent.submit(screen.getByRole("search", { name: "Movie search" }));
    expect(await screen.findByText("Movie 1")).toBeInTheDocument();
    expect(window.location.search).toBe("?source=t16&q=moon+rescue");
    expect(window.location.hash).toBe("#results");
    fireEvent.change(input, { target: { value: "new unsent draft" } });
    await act(async () => { await Promise.resolve(); });
    expect(fetchMock.mock.calls.filter(([url]) => String(url).startsWith("/api/movies/search?"))).toHaveLength(1);
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it.each(["", " ", "a", " a ", "%", "_", " 🎬 "])("validates trimmed short query %j without a search request", async query => {
    window.history.replaceState({}, "", `/search?q=${encodeURIComponent(query)}`);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => jsonResponse({}, 401));
    render(<App />);
    fireEvent.submit(screen.getByRole("search", { name: "Movie search" }));
    expect(within(screen.getByRole("main")).getByRole("status")).toHaveTextContent(/^Enter at least 2 characters$/);
    await waitFor(() => expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument());
    expect(fetchMock.mock.calls.every(([url]) => String(url) === "/api/auth/me")).toBe(true);
    expect(window.location.pathname).toBe("/search");
  });

  it.each(["success", "error"])("submits the current query without navigation and ignores an older %s", async outcome => {
    window.history.replaceState({}, "", "/search?q=%20%20moon%20%26%20rescue%20%20&source=s08#results");
    const originalUrl = window.location.href;
    const pending = deferredResponse();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(input =>
      String(input) === "/api/auth/me" ? jsonResponse({}, 401) : pending.promise);
    render(<App />);
    const oldSignal = fetchMock.mock.calls.find(([url]) => String(url).startsWith("/api/movies/search?"))?.[1]?.signal;
    fetchMock.mockImplementation(input => String(input) === "/api/auth/me" ? jsonResponse({}, 401) :
      jsonResponse({ data: { movies: [movies[1]] } }));

    const form = screen.getByRole("search", { name: "Movie search" });
    expect(screen.getByRole("button", { name: "Search" })).toHaveAttribute("type", "submit");
    expect(fireEvent.submit(form)).toBe(false);
    expect(await screen.findByText("Movie 2")).toBeInTheDocument();
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => {
      if (outcome === "success") pending.resolve(await jsonResponse({ data: { movies: [movies[0]] } }));
      else pending.reject(new Error("Old failed request"));
    });
    expect(screen.getByText("Movie 2")).toBeInTheDocument();
    expect(screen.queryByText("Movie 1")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("searchbox")).toHaveValue("  moon & rescue  ");
    expect(window.location.href).toBe(originalUrl);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).startsWith("/api/movies/search?"))
      .map(([url]) => url)).toEqual([
        "/api/movies/search?q=moon+%26+rescue", "/api/movies/search?q=moon+%26+rescue",
      ]);
  });

  it("shows loading, trims/encodes the query, renders one API page and preserves server order without sorting", async () => {
    window.history.replaceState({}, "", "/search?q=%20%20moon%20%26%20rescue%20%20");
    const pending = deferredResponse();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(input =>
      String(input) === "/api/auth/me" ? jsonResponse({}, 401) : pending.promise);
    render(<App />);
    expect(within(screen.getByRole("main")).getByRole("status")).toHaveTextContent("Loading movies...");
    const ordered = [movies[9], movies[0], ...movies.slice(1, 9)];
    await act(async () => pending.resolve(await jsonResponse({ data: { movies: ordered } })));
    const grid = screen.getByRole("region", { name: "Search results" });
    expect(within(grid).getAllByRole("article")).toHaveLength(10);
    expect(within(grid).getAllByRole("heading").map(node => node.textContent)).toEqual(ordered.slice(0, 10).map(row => row.title));
    expect(screen.queryByText("Extra")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/movies/search?q=moon+%26+rescue", { signal: expect.any(AbortSignal) });
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/api/me/"))).toBe(false);
  });

  it("renders an empty success exactly and clears it when the query becomes short", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => jsonResponse({ data: { movies: [] } }));
    render(<MemoryRouter initialEntries={["/search?q=unknown"]}><SearchPage /></MemoryRouter>);
    expect(await screen.findByText("No movies found", { exact: true })).toHaveAttribute("role", "status");
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    submitQuery(" x ");
    expect(screen.getByRole("status")).toHaveTextContent(/^Enter at least 2 characters$/);
    expect(screen.queryByText("No movies found")).not.toBeInTheDocument();
  });

  it("recovers from an index error by retrying the current trimmed query", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockImplementationOnce(() => jsonResponse({ data: { movies: [movies[0]] } }))
      .mockImplementationOnce(() => jsonResponse({ error: { code: "INDEX_UNAVAILABLE", message: "Search index is temporarily unavailable" } }, 503))
      .mockImplementationOnce(() => jsonResponse({ data: { movies: [movies[1]] } }));
    render(<MemoryRouter initialEntries={["/search?q=old"]}><SearchPage /></MemoryRouter>);
    await screen.findByText("Movie 1");
    submitQuery("  current query  ");
    expect(await screen.findByRole("alert")).toHaveTextContent("Search index is temporarily unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.getByRole("status")).toHaveTextContent("Loading movies...");
    expect(await screen.findByText("Movie 2")).toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/movies/search?q=old", "/api/movies/search?q=current+query", "/api/movies/search?q=current+query",
    ]);
    expect(screen.getByRole("searchbox")).toHaveValue("current query");
  });

  it.each(["success", "error"])("ignores a delayed old %s even if fetch ignores abort", async outcome => {
    const old = deferredResponse();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementationOnce(() => old.promise)
      .mockImplementationOnce(() => jsonResponse({ data: { movies: [movies[1]] } }));
    render(<MemoryRouter initialEntries={["/search?q=old"]}><SearchPage /></MemoryRouter>);
    const oldSignal = fetchMock.mock.calls[0][1]?.signal;
    submitQuery("new");
    expect(await screen.findByText("Movie 2")).toBeInTheDocument();
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => {
      if (outcome === "success") old.resolve(await jsonResponse({ data: { movies: [movies[0]] } }));
      else old.reject(new Error("Old failed request"));
    });
    expect(screen.getByText("Movie 2")).toBeInTheDocument();
    expect(screen.queryByText("Movie 1")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each(["success", "error"])("aborts on unmount and ignores late %s completion", async outcome => {
    const pending = deferredResponse();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementationOnce(() => pending.promise);
    const view = render(<MemoryRouter initialEntries={["/search?q=moon"]}><SearchPage /></MemoryRouter>);
    const signal = fetchMock.mock.calls[0][1]?.signal;
    view.unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      if (outcome === "success") pending.resolve(await jsonResponse({ data: { movies } }));
      else pending.reject(new Error("Late failure"));
    });
    expect(view.container).toBeEmptyDOMElement();
  });

  it("keeps short-query validation when an older valid query completes", async () => {
    const pending = deferredResponse();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementationOnce(() => pending.promise);
    render(<MemoryRouter initialEntries={["/search?q=moon"]}><SearchPage /></MemoryRouter>);
    submitQuery(" a ");
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(false);
    await act(async () => pending.resolve(await jsonResponse({ data: { movies } })));
    expect(screen.getByRole("status")).toHaveTextContent(/^Enter at least 2 characters$/);
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("opens public details and restores the search query/hash safely", async () => {
    window.history.replaceState({}, "", "/search?q=Movie+3&source=s08#results");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(input => {
      const url = String(input);
      if (url === "/api/auth/me") return jsonResponse({}, 401);
      if (url.startsWith("/api/movies/search?")) return jsonResponse({ data: { movies: [movies[2]] } });
      if (url === "/api/movies/movie-3") return jsonResponse({ data: { movie: { ...movies[2], overview: "Synthetic detail", voteCount: 0, voteAverage: null } } });
      throw new Error(`Unexpected request ${url}`);
    });
    render(<App />);
    fireEvent.click(await screen.findByRole("link", { name: "View details for Movie 3" }));
    expect(window.location.pathname).toBe("/movies/movie-3");
    const back = await screen.findByRole("link", { name: "Back to search" });
    expect(back).toHaveAttribute("href", "/search?q=Movie+3&source=s08#results");
    fireEvent.click(back);
    expect(await screen.findByRole("searchbox")).toHaveValue("Movie 3");
    expect(await screen.findByText("Movie 3")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/api/me/"))).toBe(false);
    for (const returnTo of ["//evil.test/search?q=x", "/search\\evil.test", "https://evil.test/search", "/search/other"]) {
      expect(resolveMovieDetailReturn({ returnTo }).to).toBe("/");
    }
  });
});

describe("T15 public catalogue UI", () => {
  it("loads ten public movie cards from the catalogue API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) =>
      String(input) === "/api/auth/me" ? jsonResponse({ error: { code: "AUTHENTICATION_REQUIRED" } }, 401) : jsonResponse({
        data: { movies },
        meta: { count: 10, limit: 10, page: 1, total: 10, totalPages: 1,
          unfilteredTotal: 10, catalogueRevision: "revision-test" },
      }),
    );

    render(<App />);

    expect(screen.getByText("Loading movies...")).toBeInTheDocument();
    expect(await screen.findByText("Movie 10")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(10);
    expect(fetchMock).toHaveBeenCalledWith("/api/movies?limit=10", expect.anything());
    expect(screen.getByText("Information unavailable")).toBeInTheDocument();
  });

  it("opens the selected movie detail route using its internal id", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url === "/api/auth/me") return jsonResponse({ error: { code: "AUTHENTICATION_REQUIRED" } }, 401);
      if (url === "/api/movies?limit=10") return jsonResponse({
          data: { movies },
          meta: { count: 10, limit: 10, catalogueRevision: "revision-test" },
        });
      if (url === "/api/movies/movie-3") return jsonResponse({
          data: {
            movie: {
              ...movies[2],
              overview: "A local seeded movie.",
              voteAverage: 7.5,
              voteCount: 100,
            },
          },
          meta: { catalogueRevision: "revision-test" },
        });
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    render(<App />);

    fireEvent.click(
      await screen.findByRole("link", { name: "View details for Movie 3" }),
    );

    expect(window.location.pathname).toBe("/movies/movie-3");
    expect(
      await screen.findByRole("heading", { name: "Movie 3" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/movies/movie-3");
  });

  it("shows unavailable text for missing detail year and overview", async () => {
    window.history.pushState({}, "", "/movies/incomplete");

    vi.spyOn(globalThis, "fetch").mockImplementationOnce(() =>
      jsonResponse({
        data: {
          movie: {
            id: "incomplete",
            title: "Incomplete Movie",
            releaseYear: null,
            genres: [],
            overview: null,
            popularityScore: null,
            voteAverage: null,
            voteCount: null,
          },
        },
        meta: { catalogueRevision: "revision-test" },
      }),
    );

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Incomplete Movie" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Information unavailable").length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("shows the documented not-found state for an unknown movie id", async () => {
    window.history.pushState({}, "", "/movies/does-not-exist");

    vi.spyOn(globalThis, "fetch").mockImplementationOnce(() =>
      jsonResponse(
        {
          error: {
            code: "MOVIE_NOT_FOUND",
            message: "Movie not found",
            requestId: "req-test",
          },
        },
        404,
      ),
    );

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Movie not found" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Return to catalogue" }),
    ).toHaveAttribute("href", "/");
  });

  it("retries the public catalogue request after an unavailable response", async () => {
    let attempt = 0;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      if (String(input) === "/api/auth/me") return jsonResponse({ error: { code: "AUTHENTICATION_REQUIRED" } }, 401);
      attempt += 1;
      return attempt === 1 ? jsonResponse(
          {
            error: {
              code: "CATALOGUE_UNAVAILABLE",
              message: "Movie catalogue is unavailable",
              requestId: "req-test",
            },
          },
          503,
        ) : jsonResponse({
          data: { movies },
          meta: { count: 10, limit: 10, catalogueRevision: "revision-test" },
        });
    });

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Movie 10")).toBeInTheDocument();
    expect(attempt).toBe(2);
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/me", expect.anything());
  });

  it("keeps public details accessible after session checking without private rating requests", async () => {
    window.history.pushState({}, "", "/movies/public-movie");

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((input) => {
        if (String(input) === "/api/auth/me")
          return jsonResponse(
            { error: { code: "AUTHENTICATION_REQUIRED" } },
            401,
          );
        if (String(input) === "/api/movies/public-movie/similar")
          return jsonResponse({ data: { movies: [] } });
        return Promise.reject(
          new Error(`Unexpected private request: ${String(input)}`),
        );
      })
      .mockImplementationOnce(() =>
        jsonResponse({
          data: {
            movie: {
              id: "public-movie",
              title: "Public Movie",
              releaseYear: 2025,
              genres: [{ id: 18, name: "Drama" }],
              overview: "Public detail.",
              popularityScore: 10,
              voteAverage: 8,
              voteCount: 20,
            },
          },
          meta: { catalogueRevision: "revision-test" },
        }),
      );

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Public Movie" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("link", { name: "Sign in to rate this movie" }),
    ).toHaveAttribute("href", "/login");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenCalledWith("/api/movies/public-movie");
    expect(fetchMock).toHaveBeenCalledWith("/api/movies/public-movie/similar", expect.anything());
  });
});
