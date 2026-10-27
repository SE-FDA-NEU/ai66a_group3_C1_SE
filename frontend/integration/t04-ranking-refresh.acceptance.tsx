import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import App from "../src/App.tsx";
import { startRatingBridge } from "./pythonBridge.ts";

let bridge: Awaited<ReturnType<typeof startRatingBridge>>;
beforeAll(async () => {
  bridge = await startRatingBridge("backend/tests/support/t04_ranking_bridge.py");
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
  popularity: [string, number][];
  integrity: string;
};
type Ranked = {
  title: string;
  popularityScore: number;
  ratingAdjustment: number;
  adjustedScore: number;
  basis: string;
};

const state = async () => (await bridge.call("state")) as DatabaseState;

async function ranking(account: "a" | "b") {
  const response = (await bridge.call("request", {
    account,
    url: "/api/me/recommendations?limit=10",
    method: "GET",
  })) as { status: number; body: { data: { movies: Ranked[] } } };
  expect(response.status).toBe(200);
  return response.body.data.movies;
}

const order = () =>
  screen
    .getAllByRole("heading", { level: 2 })
    .map((heading) => heading.textContent)
    .filter((text) => text === "Zulu Action" || text === "Alpha Comedy");

function scores(title: string) {
  const article = screen.getByRole("heading", { name: title }).closest("article")!;
  return {
    popularity: within(article).getByText("TMDb popularity").nextElementSibling,
    ranking: within(article).getByText("Ranking score for you").nextElementSibling,
  };
}

async function rate(value: number) {
  await screen.findByRole("heading", { name: "Recommended for you" });
  fireEvent.click(screen.getByRole("link", { name: "View details for Zulu Action" }));
  await screen.findByRole("group", { name: "Your rating (1 to 5)" });
  fireEvent.click(
    screen.getByRole("radio", { name: `${value} ${value === 1 ? "star" : "stars"}` }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Save rating" }));
  await screen.findByText(`Your saved rating: ${value}/5`);
}

it("real UI, API and SQLite: a related rating moves 80/80 to 81/80 and back to 79/80 without changing raw popularity or other accounts", async () => {
  const movieId = bridge.metadata.movieId;
  expect(await state()).toMatchObject({
    ratings: [],
    popularity: [["Alpha Comedy", 80], ["Zulu Action", 80]],
    integrity: "ok",
  });
  expect((await ranking("a")).map(({ title }) => title)).toEqual(["Alpha Comedy", "Zulu Action"]);

  const calls: { url: string; method: string }[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, options) => {
    const url = String(input);
    const method = options?.method ?? "GET";
    calls.push({ url, method });
    const result = (await bridge.call("request", {
      account: "a",
      url,
      method,
      ...(typeof options?.body === "string" ? { body: JSON.parse(options.body) } : {}),
    })) as { status: number; body: unknown };
    return new Response(result.status === 204 ? null : JSON.stringify(result.body), {
      status: result.status,
      headers: { "Content-Type": "application/json" },
    });
  });

  window.history.pushState({}, "", "/recommendations?source=t04#results");
  render(<App />);
  await screen.findByRole("heading", { name: "Recommended for you" });
  expect(order()).toEqual(["Alpha Comedy", "Zulu Action"]);
  for (const title of ["Alpha Comedy", "Zulu Action"]) {
    expect(scores(title).popularity).toHaveTextContent("80");
    expect(scores(title).ranking).toHaveTextContent("80");
  }

  await rate(5);
  expect((await state()).ratings).toEqual([["t04-a@example.com", movieId, 5]]);
  const beforeReturn = calls.length;
  fireEvent.click(screen.getByRole("link", { name: "Back to recommendations" }));
  await waitFor(() => expect(order()).toEqual(["Zulu Action", "Alpha Comedy"]));
  expect(window.location.search).toBe("?source=t04");
  expect(window.location.hash).toBe("#results");
  expect(scores("Zulu Action").popularity).toHaveTextContent("80");
  expect(scores("Zulu Action").ranking).toHaveTextContent("81");
  expect(scores("Alpha Comedy").ranking).toHaveTextContent("80");
  expect(
    calls.slice(beforeReturn).filter(({ url }) => url.startsWith("/api/me/recommendations")),
  ).toHaveLength(1);
  const raised = await ranking("a");
  expect(raised.map(({ title, adjustedScore }) => [title, adjustedScore])).toEqual([
    ["Zulu Action", 81],
    ["Alpha Comedy", 80],
  ]);
  expect(raised[0]).toMatchObject({ popularityScore: 80, ratingAdjustment: 1, basis: "rating_signals" });

  // Account B has the same saved genres but no ratings: it never borrows A's score.
  const other = await ranking("b");
  expect(other.map(({ title, adjustedScore, basis }) => [title, adjustedScore, basis])).toEqual([
    ["Alpha Comedy", 80, "baseline"],
    ["Zulu Action", 80, "baseline"],
  ]);

  await rate(1);
  expect((await state()).ratings).toEqual([["t04-a@example.com", movieId, 1]]);
  fireEvent.click(screen.getByRole("link", { name: "Back to recommendations" }));
  await waitFor(() => expect(order()).toEqual(["Alpha Comedy", "Zulu Action"]));
  expect(scores("Zulu Action").popularity).toHaveTextContent("80");
  expect(scores("Zulu Action").ranking).toHaveTextContent("79");
  expect(scores("Alpha Comedy").ranking).toHaveTextContent("80");

  const final = await state();
  expect(final.popularity).toEqual([["Alpha Comedy", 80], ["Zulu Action", 80]]);
  expect(final.preferences).toEqual([
    ["t04-a@example.com", 28], ["t04-a@example.com", 35],
    ["t04-b@example.com", 28], ["t04-b@example.com", 35],
  ]);
  expect(final.integrity).toBe("ok");
});
