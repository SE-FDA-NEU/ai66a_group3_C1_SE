// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import PopularSpotlight from "../components/PopularSpotlight.tsx";
import type { MovieSummary } from "../api/movies.ts";

const movies = ["Zeta", "Alpha", "Beta", "Outside top three"].map((title, i) => ({
  id: `movie-${i}`, title, releaseYear: 2026, genres: [{ id: 1, name: "Action" }],
  popularityScore: 100 - i, posterUrl: null,
  backdropUrl: `https://image.tmdb.org/t/p/w780/backdrop${i}.jpg`,
}));
function Demo({ rows = movies, start = 1 }: { rows?: MovieSummary[]; start?: number }) {
  const [id, select] = useState<string>();
  return <MemoryRouter><PopularSpotlight movies={rows} startRank={start} activeMovieId={id}
    onSelect={select} returnTo="/popular?page=2#catalogue-shelf"
    returnContext={{ route: "/popular", catalogueRevision: "synthetic" }} /></MemoryRouter>;
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("uses three supplied ranks in order, supports arrows/dots/keyboard and never fetches", () => {
  const fetch = vi.spyOn(globalThis, "fetch");
  render(<Demo start={11} />);
  const spotlight = screen.getByRole("region", { name: "Popular movie spotlight" });
  expect(within(spotlight).getByRole("heading")).toHaveTextContent("Zeta");
  expect(spotlight).toHaveTextContent("#11 in this catalogue");
  const next = screen.getByRole("button", { name: "Next featured movie" });
  fireEvent.click(next);
  expect(within(spotlight).getByRole("heading")).toHaveTextContent("Alpha");
  expect(spotlight).toHaveTextContent("#12 in this catalogue");
  fireEvent.click(next); fireEvent.click(next);
  expect(within(spotlight).getByRole("heading")).toHaveTextContent("Zeta");
  fireEvent.click(screen.getByRole("button", { name: "Previous featured movie" }));
  expect(within(spotlight).getByRole("heading")).toHaveTextContent("Beta");
  expect(screen.getByRole("status")).toHaveTextContent("3 / 3");
  fireEvent.keyDown(next, { key: "ArrowLeft" });
  expect(within(spotlight).getByRole("heading")).toHaveTextContent("Alpha");
  fireEvent.click(screen.getByRole("button", { name: "Show featured movie 1: Zeta" }));
  expect(screen.getByRole("button", { name: "Show featured movie 1: Zeta" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("link", { name: "Explore featured movie Zeta" })).toHaveAttribute("href", "/movies/movie-0");
  expect(screen.queryByText("Outside top three")).not.toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

it.each([0, 1, 2])("handles a page with %s movies without phantom slides", count => {
  render(<Demo rows={movies.slice(0, count)} />);
  if (!count) {
    expect(screen.queryByRole("region")).not.toBeInTheDocument(); return;
  }
  expect(screen.getByRole("status")).toHaveTextContent(`1 / ${count}`);
  if (count === 1) expect(screen.queryByRole("button")).not.toBeInTheDocument();
  else {
    fireEvent.click(screen.getByRole("button", { name: "Next featured movie" }));
    expect(screen.getByRole("status")).toHaveTextContent("2 / 2");
  }
});

it("removes a failed backdrop and resets image failure for the next movie", () => {
  const { container } = render(<Demo />);
  const image = container.querySelector<HTMLImageElement>(".popular-spotlight__backdrop")!;
  expect(image.src).toBe(movies[0].backdropUrl);
  fireEvent.error(image);
  expect(container.querySelector(".popular-spotlight__backdrop")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Next featured movie" }));
  expect(container.querySelector(".popular-spotlight__backdrop")).toHaveAttribute("src", movies[1].backdropUrl);
});

it.each([null, "https://evil.invalid/x.jpg", "https://image.tmdb.org/t/p/w780/a.jpg?token=bad"])(
  "uses the gradient for missing/unsafe backdrop %s", backdropUrl => {
    const { container } = render(<Demo rows={[{ ...movies[0], backdropUrl }]} />);
    expect(container.querySelector(".popular-spotlight__backdrop")).toBeNull();
    expect(screen.getByRole("heading", { name: "Zeta" })).toBeVisible();
  });
