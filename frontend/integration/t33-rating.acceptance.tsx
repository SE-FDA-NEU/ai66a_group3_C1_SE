import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import App from "../src/App.tsx";
import type { PageMeta } from "../src/api/movies.ts";
import type { RecommendationResult } from "../src/api/recommendations.ts";
import { startRatingBridge } from "./pythonBridge.ts";

let bridge: Awaited<ReturnType<typeof startRatingBridge>>;
beforeAll(async () => {
  bridge = await startRatingBridge();
});
afterAll(async () => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
  if (bridge) await bridge.close();
});
type DatabaseState = {
  preferences: [string, number][];
  ratings: [string, string, number][];
  integrity: string;
};
const state = async () => (await bridge.call("state")) as DatabaseState;
const choose = (value: number) => fireEvent.click(
  screen.getByRole("radio", { name: `${value} ${value === 1 ? "star" : "stars"}` }),
);

async function readRanking() {
  const response = await bridge.call("request", {
    url: "/api/me/recommendations?limit=10",
    method: "GET",
  }) as { status: number; body: { data: RecommendationResult; meta: PageMeta } };
  expect(response.status).toBe(200);
  return response;
}

it("real UI saves, rolls back, retries, reloads and isolates committed rating signals without changing preferences or raw popularity", async () => {
  const baseline = await state();
  expect(baseline.preferences).toHaveLength(3);
  expect(baseline.ratings).toEqual([]);
  const calls: { url: string; method: string }[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, options) => {
    const url = String(input);
    const method = options?.method ?? "GET";
    calls.push({ url, method });
    const result = (await bridge.call("request", {
      url,
      method,
      ...(typeof options?.body === "string"
        ? { body: JSON.parse(options.body) }
        : {}),
    })) as { status: number; body: unknown };
    return new Response(
      result.status === 204 ? null : JSON.stringify(result.body),
      {
        status: result.status,
        headers: { "Content-Type": "application/json" },
      },
    );
  });
  const detailPath = `/movies/${bridge.metadata.movieId}`;
  window.history.pushState({}, "", detailPath);
  let app = render(<App />);
  await screen.findByRole("link", { name: "Sign in to rate this movie" });
  expect(calls.some(({ url }) => url.startsWith("/api/me/ratings/"))).toBe(
    false,
  );
  fireEvent.click(
    screen.getByRole("link", { name: "Sign in to rate this movie" }),
  );
  async function signIn(email: string) {
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: email },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "movie123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByRole("heading", { name: "Find your next movie" });
    expect(window.location.pathname).toBe("/");
    fireEvent.click(screen.getByRole("link", { name: "My recommendations" }));
    await screen.findByRole("heading", { name: "Recommendations" });
  }
  await signIn("t33-a@example.com");
  fireEvent.click(
    await screen.findByRole("link", {
      name: `View details for ${bridge.metadata.title}`,
    }),
  );
  await screen.findByText("Not rated yet");
  const beforeRanking = await readRanking();
  expect(beforeRanking.body.data).toMatchObject({
    mode: "personalised", personalised: true, noMatch: false,
  });
  async function save(value: number, button = "Save rating") {
    choose(value);
    fireEvent.click(screen.getByRole("button", { name: button }));
    await screen.findByText(`Your saved rating: ${value}/5`);
  }
  await save(3);
  expect((await state()).ratings).toEqual([
    ["t33-a@example.com", bridge.metadata.movieId, 3],
  ]);
  expect(await readRanking()).toEqual(beforeRanking);
  await bridge.call("fail_next_save");
  choose(5);
  fireEvent.click(screen.getByRole("button", { name: "Save rating" }));
  await screen.findByRole("alert");
  expect(screen.getByRole("radio", { name: "5 stars" })).toBeChecked();
  expect(screen.getByText("Your saved rating: 3/5")).toBeInTheDocument();
  expect((await state()).ratings).toEqual([
    ["t33-a@example.com", bridge.metadata.movieId, 3],
  ]);
  expect(await readRanking()).toEqual(beforeRanking);
  fireEvent.click(screen.getByRole("button", { name: "Retry save" }));
  await screen.findByText("Your saved rating: 5/5");
  expect((await state()).ratings).toEqual([
    ["t33-a@example.com", bridge.metadata.movieId, 5],
  ]);
  const afterRanking = await readRanking();
  const ratedMovie = beforeRanking.body.data.movies.find(
    (movie) => movie.id === bridge.metadata.movieId,
  );
  expect(ratedMovie).toBeDefined();
  const ratedGenres = new Set(ratedMovie!.genres.map((genre) => genre.id));
  // This fixture's popularity gaps exceed the single +1 signal, so the IDs,
  // order, raw catalogue fields, reasons and page metadata all stay the same.
  // Only candidates sharing the rated film's canonical genres gain one boost.
  const expectedMovies = beforeRanking.body.data.movies.map((movie) => {
    const related = movie.genres.some((genre) => ratedGenres.has(genre.id));
    return {
      ...movie,
      ratingAdjustment: related ? 1 : 0,
      adjustedScore: movie.popularityScore === null
        ? null : movie.popularityScore + (related ? 1 : 0),
      basis: related ? "rating_signals" : "baseline",
    };
  });
  expect(expectedMovies.some((movie) => movie.ratingAdjustment === 1)).toBe(true);
  expect(expectedMovies.some((movie) => movie.ratingAdjustment === 0)).toBe(true);
  expect(afterRanking).toEqual({
    ...beforeRanking,
    body: {
      ...beforeRanking.body,
      data: { ...beforeRanking.body.data, movies: expectedMovies },
    },
  });
  fireEvent.click(
    screen.getByRole("link", { name: "Back to recommendations" }),
  );
  await screen.findByRole("button", { name: "Sign out" });
  // A new App instance simulates a reload with the same real server session.
  app.unmount();
  window.history.pushState({}, "", detailPath);
  app = render(<App />);
  await screen.findByText("Your saved rating: 5/5");
  expect(await readRanking()).toEqual(afterRanking);
  fireEvent.click(screen.getByRole("link", { name: "Return to catalogue" }));
  await screen.findByRole("heading", { name: "Find your next movie" });
  fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));
  await screen.findByRole("link", { name: "Sign in" });
  fireEvent.click(screen.getByRole("link", { name: "Sign in" }));
  await signIn("t33-b@example.com");
  const beforeRankingB = await readRanking();
  app.unmount();
  window.history.pushState({}, "", detailPath);
  app = render(<App />);
  await screen.findByText("Not rated yet");
  expect(screen.queryByText("Your saved rating: 5/5")).not.toBeInTheDocument();
  await save(2);
  // B selected Drama; the rated Action/SF film is ineligible and shares no
  // canonical genre with B's candidates, so B's ranking remains baseline.
  expect(await readRanking()).toEqual(beforeRankingB);
  const final = await state();
  expect(final.ratings).toEqual([
    ["t33-a@example.com", bridge.metadata.movieId, 5],
    ["t33-b@example.com", bridge.metadata.movieId, 2],
  ]);
  expect(final.preferences).toEqual(baseline.preferences);
  expect(final.integrity).toBe("ok");
  expect(
    calls.some(
      ({ url, method }) => method === "PUT" && url === "/api/me/preferences",
    ),
  ).toBe(false);
  fireEvent.click(screen.getByRole("link", { name: "Return to catalogue" }));
  await screen.findByRole("heading", { name: "Find your next movie" });
  // Simulate a fresh protected-route load, then use the real sign-out control.
  window.history.pushState({}, "", "/recommendations");
  app.unmount();
  app = render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));
  await waitFor(() => expect(window.location.pathname).toBe("/"));
  const afterLogout = calls.length;
  app.unmount();
  window.history.pushState({}, "", detailPath);
  render(<App />);
  await screen.findByRole("link", { name: "Sign in to rate this movie" });
  expect(
    screen.queryByRole("group", { name: "Your rating (0.5 to 5)" }),
  ).not.toBeInTheDocument();
  expect(calls.slice(afterLogout).some(({ url }) => url.startsWith("/api/me/ratings/"))).toBe(false);
  fireEvent.click(screen.getByRole("link", { name: "Sign in to rate this movie" }));
  await signIn("t33-a@example.com");
  fireEvent.click(await screen.findByRole("link", { name: `View details for ${bridge.metadata.title}` }));
  await screen.findByText("Your saved rating: 5/5");
  expect(await readRanking()).toEqual(afterRanking);
  expect((await state()).ratings).toEqual(final.ratings);
  expect((await state()).preferences).toEqual(baseline.preferences);
});
