// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "../auth/authState.ts";
import RecommendationFilter from "../components/RecommendationFilter.tsx";
import type { PageMeta } from "../api/movies.ts";
import type { RecommendationResult } from "../api/recommendations.ts";

const action = { id: 28, name: "Action" };
const horror = { id: 27, name: "Horror" };
const movies = [{ id: "one", title: "Action One", releaseYear: 2024,
  popularityScore: 90, genres: [action], reason: { matchedGenres: [action] } }];
const result: RecommendationResult = { movies, mode: "personalised", personalised: true,
  noMatch: false };
const meta: PageMeta = { count: 1, limit: 10, page: 1, total: 35,
  totalPages: 4, unfilteredTotal: 35, catalogueRevision: "revision" };
const auth: AuthContextValue = { status: "authenticated", user: { id: "one", email: "one@example.com" },
  refresh: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), handleUnauthorized: vi.fn(),
  recommendationVersion: 0, recommendationScope: "test-scope",
  invalidateRecommendations: vi.fn() };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status,
    headers: { "Content-Type": "application/json" } });
}

function mount(props: { snapshot?: RecommendationResult; pageMeta?: PageMeta;
  genreId?: number; onGenreChange?: (id?: number) => void } = {}) {
  const onGenreChange = props.onGenreChange ?? vi.fn();
  return { onGenreChange, ...render(<MemoryRouter><AuthContext.Provider value={auth}>
    <RecommendationFilter snapshot={props.snapshot ?? result} meta={props.pageMeta ?? meta}
      genreId={props.genreId} onGenreChange={onGenreChange} ariaLabel="Recommendations" />
  </AuthContext.Provider></MemoryRouter>) };
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("renders server page and complete-set totals without slicing it in the browser", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ data: { genres: [action, horror] } }));
  const { onGenreChange } = mount();
  await waitFor(() => expect(screen.getByRole("combobox")).toBeEnabled());
  expect(screen.getByText("Showing 1-1 of 35 movies")).toBeInTheDocument();
  expect(screen.getByText("Action One")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "28" } });
  expect(onGenreChange).toHaveBeenCalledWith(28);
  expect(screen.getByText("Action One")).toBeInTheDocument();
});

it("shows adjusted and raw score separately on personal cards", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ data: { genres: [action] } }));
  mount({ snapshot: { ...result, movies: [{ ...movies[0], popularityScore: 80,
    ratingAdjustment: 1, adjustedScore: 81, basis: "rating_signals" }] } });
  expect(await screen.findByText("Personal adjusted score")).toBeInTheDocument();
  expect(screen.getByText("TMDb popularity")).toBeInTheDocument();
  expect(screen.getByText("81")).toBeInTheDocument();
  expect(screen.getByText("80")).toBeInTheDocument();
  expect(screen.getByText("Related rating signals: +1")).toBeInTheDocument();
  expect(screen.queryByText(/Your rating/)).not.toBeInTheDocument();
});

it("labels rating-only failure without claiming there are no ratings", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ data: { genres: [action] } }));
  mount({ snapshot: { ...result, movies: [{ ...movies[0], popularityScore: 80,
    ratingAdjustment: 0, adjustedScore: 80, basis: "rating_unavailable" }] } });
  expect(await screen.findByText(/Personal rating signals are temporarily unavailable/))
    .toBeInTheDocument();
  expect(screen.queryByText(/No ratings/)).not.toBeInTheDocument();
});

it("renders a true filtered-empty response and a clear action", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ data: { genres: [action, horror] } }));
  const onGenreChange = vi.fn();
  mount({ snapshot: { ...result, movies: [] }, pageMeta: { ...meta, count: 0,
    total: 0, totalPages: 0 }, genreId: 27, onGenreChange });
  expect(await screen.findByText("No movies match this filter.")).toBeInTheDocument();
  expect(screen.getByText("Showing 0 matches (35 recommendations before filtering)")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Clear filter" }));
  expect(onGenreChange).toHaveBeenCalledWith(undefined);
});

it("keeps server cards visible if canonical genre options fail, and retries options only", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(json({ error: { message: "Unavailable" } }, 503))
    .mockResolvedValueOnce(json({ data: { genres: [action] } }));
  mount();
  expect(await screen.findByRole("alert")).toHaveTextContent("Unavailable");
  expect(screen.getByText("Action One")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry filter options" }));
  await waitFor(() => expect(screen.getByRole("combobox")).toBeEnabled());
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/api/genres", "/api/genres"]);
});
