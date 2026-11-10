// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import App from "../App.tsx";

const movies = Array.from({ length: 25 }, (_, index) => ({
  id: `movie-${index + 1}`, title: `Movie ${String(index + 1).padStart(2, "0")}`,
  releaseYear: 2025, genres: [], popularityScore: null,
}));

function body(page = 1, descending = false, revision = "rev-a") {
  const ordered = descending ? [...movies].reverse() : movies;
  const slice = ordered.slice((page - 1) * 10, page * 10);
  return { data: { movies: slice }, meta: {
    count: slice.length, limit: 10, page, total: 25, totalPages: 3,
    unfilteredTotal: 25, catalogueRevision: revision,
  } };
}
function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}
function mockCatalogue() {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async input => {
    const url = new URL(String(input), "http://localhost");
    if (url.pathname === "/api/auth/me") return response({ error: {} }, 401);
    if (url.pathname === "/api/movies" || url.pathname === "/api/movies/popular")
      return response(body(Number(url.searchParams.get("page") ?? 1),
        url.searchParams.get("sort") === "title_desc"));
    if (url.pathname === "/api/movies/movie-15") return response({ data: { movie: {
      ...movies[14], overview: "Descending page two details", voteAverage: null, voteCount: null,
    } } });
    throw new Error(`Unexpected request ${url}`);
  });
}
function renderedTitles() {
  return within(screen.getByRole("region", { name: "Movie catalogue" }))
    .getAllByRole("heading", { level: 2 }).map(node => node.textContent);
}
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); window.history.replaceState({}, "", "/");
});

it("changes the complete Home order, resets page 1 and preserves context through details and reload", async () => {
  const fetch = mockCatalogue();
  window.history.replaceState({}, "", "/?page=2&source=shared#catalogue-shelf");
  const view = render(<App />);
  expect(await screen.findByText("Showing 11-20 of 25 movies")).toBeInTheDocument();
  expect(screen.getByLabelText("Sort by title")).toHaveValue("title_asc");
  fireEvent.change(screen.getByLabelText("Sort by title"), { target: { value: "title_desc" } });
  expect(await screen.findByText("Showing 1-10 of 25 movies")).toBeInTheDocument();
  expect(renderedTitles()).toEqual(movies.slice(15).reverse().map(movie => movie.title));
  expect(new URLSearchParams(window.location.search).get("page")).toBe("1");
  expect(window.location.search).toContain("source=shared");
  expect(window.location.hash).toBe("#catalogue-shelf");
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(await screen.findByText("Showing 11-20 of 25 movies")).toBeInTheDocument();
  const detail = screen.getByRole("link", { name: "View details for Movie 15" });
  expect(detail).toHaveClass("button-link", "button-secondary");
  expect(detail).toHaveAttribute("href", "/movies/movie-15");
  fireEvent.click(detail);
  expect(await screen.findByText("Descending page two details")).toBeInTheDocument();
  const back = screen.getByRole("link", { name: "Return to catalogue" });
  expect(back).toHaveClass("button-link", "button-secondary");
  fireEvent.click(back);
  expect(await screen.findByText("Showing 11-20 of 25 movies")).toBeInTheDocument();
  expect(screen.getByLabelText("Sort by title")).toHaveValue("title_desc");
  expect(renderedTitles()).toEqual(movies.slice(5, 15).reverse().map(movie => movie.title));
  expect(window.location.hash).toBe("#catalogue-shelf");
  view.unmount(); render(<App />);
  expect(await screen.findByText("Showing 11-20 of 25 movies")).toBeInTheDocument();
  expect(screen.getByLabelText("Sort by title")).toHaveValue("title_desc");
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(await screen.findByText("Showing 21-25 of 25 movies")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Sort by title"), { target: { value: "title_asc" } });
  expect(await screen.findByText("Showing 1-10 of 25 movies")).toBeInTheDocument();
  expect(renderedTitles()).toEqual(movies.slice(0, 10).map(movie => movie.title));
  expect(window.location.search).not.toContain("sort=");
  expect(fetch.mock.calls.every(([, init]) => !init?.method || init.method === "GET")).toBe(true);
});

it("keeps the default API compatible and leaves Popular without a title sort", async () => {
  const fetch = mockCatalogue();
  const view = render(<App />);
  expect(await screen.findByText("Showing 1-10 of 25 movies")).toBeInTheDocument();
  expect(fetch.mock.calls.some(([input]) => input === "/api/movies?limit=10")).toBe(true);
  view.unmount();
  window.history.replaceState({}, "", "/popular?sort=title_desc");
  render(<App />);
  expect(await screen.findByText("Showing 1-10 of 25 movies")).toBeInTheDocument();
  expect(screen.queryByLabelText("Sort by title")).not.toBeInTheDocument();
  expect(fetch.mock.calls.some(([input]) => input === "/api/movies/popular?limit=10")).toBe(true);
});

it("normalizes invalid sort/page without losing unrelated query, hash or return state", async () => {
  const fetch = mockCatalogue();
  window.history.replaceState({ usr: { context: "kept" } }, "", "/?sort=bad&page=0&source=shared#catalogue-shelf");
  render(<App />);
  expect(await screen.findByText("Showing 1-10 of 25 movies")).toBeInTheDocument();
  await waitFor(() => expect(window.location.search).toBe("?page=1&source=shared"));
  expect(window.location.hash).toBe("#catalogue-shelf");
  expect(screen.getByLabelText("Sort by title")).toHaveValue("title_asc");
  expect(fetch.mock.calls.every(([input]) => !String(input).includes("sort=bad"))).toBe(true);
});

it.each(["success", "error", "revision"] as const)(
  "ignores a late %s response from the old sort",
  async outcome => {
    let finish!: (value: Response) => void;
    const pending = new Promise<Response>(resolve => { finish = resolve; });
    vi.spyOn(globalThis, "fetch").mockImplementation(async input => {
      const url = String(input);
      if (url === "/api/auth/me") return response({ error: {} }, 401);
      if (url.includes("sort=title_desc")) return response(body(1, true));
      return pending;
    });
    render(<App />);
    fireEvent.change(screen.getByLabelText("Sort by title"), { target: { value: "title_desc" } });
    expect(await screen.findByText("Showing 1-10 of 25 movies")).toBeInTheDocument();
    await act(async () => finish(outcome === "success" ? response(body()) :
      response({ error: { code: outcome === "revision" ? "CATALOGUE_CHANGED" : "UNAVAILABLE",
        message: "Old sort failed" } }, outcome === "revision" ? 409 : 503)));
    expect(renderedTitles()[0]).toBe("Movie 25");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(window.location.search).toContain("sort=title_desc");
  },
);

it("retries and recovers from a catalogue revision change using the selected descending sort", async () => {
  let attempt = 0;
  const calls: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async input => {
    const url = String(input); calls.push(url);
    if (url === "/api/auth/me") return response({ error: {} }, 401);
    attempt++;
    if (attempt === 1) return response({ error: { message: "Try again" } }, 503);
    if (attempt === 2) return response({ error: { code: "CATALOGUE_CHANGED", message: "Changed" } }, 409);
    return response(body(1, true, "rev-b"));
  });
  window.history.replaceState({}, "", "/?sort=title_desc&page=2#catalogue-shelf");
  render(<App />);
  expect(await screen.findByText("Try again")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("Showing 1-10 of 25 movies")).toBeInTheDocument();
  expect(screen.getByLabelText("Sort by title")).toHaveValue("title_desc");
  expect(renderedTitles()[0]).toBe("Movie 25");
  expect(window.location.hash).toBe("#catalogue-shelf");
  expect(calls.filter(url => url.startsWith("/api/movies?")).every(url => url.includes("sort=title_desc"))).toBe(true);
});
