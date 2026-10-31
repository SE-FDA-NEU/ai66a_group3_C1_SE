// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Link, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "../auth/AuthContext.tsx";
import MovieBackdropHero from "../components/MovieBackdropHero.tsx";
import { allowedBackdropUrl } from "../components/backdropUrl.ts";
import MovieDetailPage from "../pages/MovieDetailPage.tsx";

const IMAGE_A = "https://image.tmdb.org/t/p/w780/movie-a.jpg";
const IMAGE_B = "https://image.tmdb.org/t/p/w780/movie-b.webp";
const TRAILER = {
  site: "YouTube", key: "AbCdEf123_-", name: "Official trailer",
  type: "Trailer", official: true, language: "en",
  publishedAt: "2026-10-20T10:00:00Z",
  url: "https://www.youtube.com/watch?v=AbCdEf123_-",
};

function response(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

function detail(id: string, backdropUrl?: string | null) {
  return {
    id,
    title: `Title ${id}`,
    releaseYear: 2026,
    genres: [{ id: 18, name: "Drama" }],
    overview: `Overview ${id}`,
    popularityScore: 91.5,
    voteAverage: null,
    voteCount: null,
    ...(backdropUrl === undefined ? {} : { backdropUrl }),
  };
}

function deferredResponse() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function DetailRoutes() {
  return (
    <MemoryRouter initialEntries={["/movies/movie-a"]}>
      <AuthProvider>
        <Link to="/movies/movie-b">Open movie B</Link>
        <Routes>
          <Route path="/movies/:movieId" element={<MovieDetailPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("movie backdrop hero", () => {
  it("loads only the reviewed HTTPS image URL while keeping the title as text", () => {
    const { container } = render(
      <MovieBackdropHero title="A bright movie" backdropUrl={IMAGE_A} />,
    );
    const image = container.querySelector("img");
    expect(image).toHaveAttribute("src", IMAGE_A);
    expect(image).not.toHaveClass("movie-detail__hero-image--loaded");
    expect(screen.getByRole("heading", { name: "A bright movie" })).toBeVisible();

    // jsdom never requests the CDN; image completion is controlled by this event.
    fireEvent.load(image!);
    expect(image).toHaveClass("movie-detail__hero-image--loaded");
  });

  it.each([null, undefined])("keeps text and the gradient for %s media", (backdropUrl) => {
    const { container } = render(
      <MovieBackdropHero title="No media" backdropUrl={backdropUrl} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("heading", { name: "No media" })).toBeVisible();
    expect(container.querySelector(".movie-detail__hero")).toBeInTheDocument();
  });

  it("removes a failed image without removing the title or showing a broken icon", () => {
    const { container } = render(
      <MovieBackdropHero title="Broken media" backdropUrl={IMAGE_A} />,
    );
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("heading", { name: "Broken media" })).toBeVisible();
  });

  it.each([
    "http://image.tmdb.org/t/p/w780/movie-a.jpg",
    "https://api.themoviedb.org/3/configuration",
    "https://evil.example/t/p/w780/movie-a.jpg",
    "https://image.tmdb.org/t/p/original/movie-a.jpg",
    "https://image.tmdb.org/t/p/w780/../movie-a.jpg",
    "https://image.tmdb.org/t/p/w780/movie-a.svg",
    "https://image.tmdb.org/t/p/w780/movie-a.jpg?token=secret",
  ])("rejects an unreviewed image location %s", (url) => {
    expect(allowedBackdropUrl(url)).toBeNull();
    const { container } = render(
      <MovieBackdropHero title="Safe fallback" backdropUrl={url} />,
    );
    expect(container.querySelector("img")).toBeNull();
  });

  it("resets loaded image state when the backdrop URL changes", () => {
    const { container, rerender } = render(
      <MovieBackdropHero key={`movie-a:${IMAGE_A}`} title="Movie A" backdropUrl={IMAGE_A} />,
    );
    fireEvent.load(container.querySelector("img")!);
    expect(container.querySelector("img")).toHaveClass("movie-detail__hero-image--loaded");

    rerender(
      <MovieBackdropHero key={`movie-a:${IMAGE_B}`} title="Movie A" backdropUrl={IMAGE_B} />,
    );
    expect(container.querySelector("img")).toHaveAttribute("src", IMAGE_B);
    expect(container.querySelector("img")).not.toHaveClass("movie-detail__hero-image--loaded");
  });
});

describe("movie detail backdrop transitions", () => {
  it("places the official trailer button below the poster", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url === "/api/movies/movie-a")
        return response({ data: { movie: { ...detail("movie-a"), trailer: TRAILER } } });
      if (url === "/api/movies/movie-b")
        return response({ data: { movie: { ...detail("movie-b"), trailer: null } } });
      if (url === "/api/auth/me") return response({}, 401);
      if (url.endsWith("/similar")) return response({ data: { movies: [] } });
      throw new Error(`Unexpected request: ${url}`);
    });
    render(<DetailRoutes />);
    const button = await screen.findByRole("button", { name: /Watch trailer/ });
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    expect(button.closest(".movie-detail__poster")).not.toBeNull();
    expect(document.querySelector("iframe")).toBeNull();
    expect(screen.getAllByRole("button", { name: /Watch trailer/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole("link", { name: "Open movie B" }));
    await screen.findByRole("heading", { name: "Title movie-b" });
    expect(screen.queryByRole("button", { name: /Watch trailer/ })).not.toBeInTheDocument();
    expect(screen.getByText("Trailer unavailable")).toBeVisible();
  });

  it.each([
    ["null", null, null],
    ["missing", undefined, null],
    ["invalid URL", { ...TRAILER, url: "javascript:alert(1)" }, null],
    ["mismatched key", { ...TRAILER, url: "https://www.youtube.com/watch?v=ABCDEFGHIJK" }, null],
    ["teaser", { ...TRAILER, type: "Teaser" }, null],
    ["unofficial", { ...TRAILER, official: false }, null],
    ["backdrop and trailer", TRAILER, IMAGE_A],
    ["backdrop only", null, IMAGE_A],
    ["trailer only", TRAILER, null],
    ["neither", null, null],
  ])("renders safe media for %s", async (_case, trailer, backdropUrl) => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url === "/api/movies/movie-a") return response({ data: {
        movie: { ...detail("movie-a", backdropUrl), ...(trailer === undefined ? {} : { trailer }) },
      } });
      if (url === "/api/auth/me") return response({}, 401);
      if (url.endsWith("/similar")) return response({ data: { movies: [] } });
      throw new Error(`Unexpected request: ${url}`);
    });
    const { container } = render(<DetailRoutes />);
    await screen.findByRole("heading", { name: "Title movie-a" });
    const valid = trailer === TRAILER;
    expect(screen.queryAllByRole("button", { name: /Watch trailer/ })).toHaveLength(valid ? 1 : 0);
    expect(screen.queryByText("Trailer unavailable") !== null).toBe(!valid);
    expect(container.querySelector(".movie-detail__hero-image") !== null).toBe(backdropUrl !== null);
  });

  it("cannot apply delayed old image events to the next movie", async () => {
    const nextMovie = deferredResponse();
    const calls: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      calls.push(url);
      if (url === "/api/movies/movie-a")
        return response({ data: { movie: detail("movie-a", IMAGE_A) } });
      if (url === "/api/movies/movie-b") return nextMovie.promise;
      if (url === "/api/auth/me") return response({}, 401);
      if (url.endsWith("/similar")) return response({ data: { movies: [] } });
      throw new Error(`Unexpected request: ${url}`);
    });

    const { container } = render(<DetailRoutes />);
    await screen.findByRole("heading", { name: "Title movie-a" });
    const oldImage = container.querySelector("img")!;
    fireEvent.load(oldImage);
    expect(oldImage).toHaveClass("movie-detail__hero-image--loaded");

    fireEvent.click(screen.getByRole("link", { name: "Open movie B" }));
    expect(screen.getByText("Loading movie...")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();

    await act(async () => {
      nextMovie.resolve(new Response(JSON.stringify({ data: { movie: detail("movie-b", IMAGE_B) } })));
    });
    await screen.findByRole("heading", { name: "Title movie-b" });
    const nextImage = container.querySelector("img")!;
    expect(nextImage).toHaveAttribute("src", IMAGE_B);
    expect(nextImage).not.toHaveClass("movie-detail__hero-image--loaded");

    fireEvent.error(oldImage);
    fireEvent.load(oldImage);
    expect(nextImage).toBeInTheDocument();
    expect(nextImage).not.toHaveClass("movie-detail__hero-image--loaded");
    fireEvent.load(nextImage);
    expect(nextImage).toHaveClass("movie-detail__hero-image--loaded");
    expect(calls).toEqual([
      "/api/movies/movie-a",
      "/api/auth/me",
      "/api/movies/movie-a/similar",
      "/api/movies/movie-b",
      "/api/movies/movie-b/similar",
    ]);
  });

  it("removes the previous trailer while the next detail is pending", async () => {
    const nextMovie = deferredResponse();
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url === "/api/movies/movie-a")
        return response({ data: { movie: { ...detail("movie-a"), trailer: TRAILER } } });
      if (url === "/api/movies/movie-b") return nextMovie.promise;
      if (url === "/api/auth/me") return response({}, 401);
      if (url.endsWith("/similar")) return response({ data: { movies: [] } });
      throw new Error(`Unexpected request: ${url}`);
    });
    render(<DetailRoutes />);
    await screen.findByRole("button", { name: /Watch trailer/ });
    fireEvent.click(screen.getByRole("link", { name: "Open movie B" }));
    expect(screen.getByText("Loading movie...")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Watch trailer/ })).not.toBeInTheDocument();
    await act(async () => {
      nextMovie.resolve(new Response(JSON.stringify({ data: {
        movie: { ...detail("movie-b"), trailer: null },
      } })));
    });
    await screen.findByRole("heading", { name: "Title movie-b" });
    expect(screen.getByText("Trailer unavailable")).toBeVisible();
  });

  it("ignores a delayed detail response from movie A after navigation to B", async () => {
    const oldMovie = deferredResponse();
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url === "/api/movies/movie-a") return oldMovie.promise;
      if (url === "/api/movies/movie-b")
        return response({ data: { movie: { ...detail("movie-b", null), trailer: null } } });
      if (url === "/api/auth/me") return response({}, 401);
      throw new Error(`Unexpected request: ${url}`);
    });

    const { container } = render(<DetailRoutes />);
    fireEvent.click(screen.getByRole("link", { name: "Open movie B" }));
    await screen.findByRole("heading", { name: "Title movie-b" });
    expect(container.querySelector("img")).toBeNull();

    await act(async () => {
      oldMovie.resolve(new Response(JSON.stringify({ data: { movie: {
        ...detail("movie-a", IMAGE_A), trailer: TRAILER,
      } } })));
    });
    expect(screen.getByRole("heading", { name: "Title movie-b" })).toBeVisible();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByRole("button", { name: /Watch trailer/ })).not.toBeInTheDocument();
  });
});
