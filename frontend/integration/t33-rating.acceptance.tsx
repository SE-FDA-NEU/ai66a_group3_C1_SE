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
const picker = () =>
  screen.getByRole("combobox", { name: "Your rating (1 to 5)" });

it("real UI saves, rolls back, retries, reloads and isolates account ratings without changing preferences or ranking", async () => {
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
    await screen.findByRole("heading", { name: "Recommendations" });
  }
  await signIn("t33-a@example.com");
  fireEvent.click(
    await screen.findByRole("link", {
      name: `View details for ${bridge.metadata.title}`,
    }),
  );
  await screen.findByText("Not rated yet");
  const beforeRanking = await bridge.call("request", {
    url: "/api/me/recommendations?limit=10",
    method: "GET",
  });
  async function save(value: number, button = "Save rating") {
    fireEvent.change(picker(), { target: { value: String(value) } });
    fireEvent.click(screen.getByRole("button", { name: button }));
    await screen.findByText(`Your saved rating: ${value}/5`);
  }
  await save(3);
  expect((await state()).ratings).toEqual([
    ["t33-a@example.com", bridge.metadata.movieId, 3],
  ]);
  await bridge.call("fail_next_save");
  fireEvent.change(picker(), { target: { value: "5" } });
  fireEvent.click(screen.getByRole("button", { name: "Save rating" }));
  await screen.findByRole("alert");
  expect(picker()).toHaveValue("5");
  expect(screen.getByText("Your saved rating: 3/5")).toBeInTheDocument();
  expect((await state()).ratings).toEqual([
    ["t33-a@example.com", bridge.metadata.movieId, 3],
  ]);
  fireEvent.click(screen.getByRole("button", { name: "Retry save" }));
  await screen.findByText("Your saved rating: 5/5");
  expect((await state()).ratings).toEqual([
    ["t33-a@example.com", bridge.metadata.movieId, 5],
  ]);
  const afterRanking = await bridge.call("request", {
    url: "/api/me/recommendations?limit=10",
    method: "GET",
  });
  expect(afterRanking).toEqual(beforeRanking);
  fireEvent.click(
    screen.getByRole("link", { name: "Back to recommendations" }),
  );
  await screen.findByRole("button", { name: "Sign out" });
  // A new App instance simulates a reload with the same real server session.
  app.unmount();
  window.history.pushState({}, "", detailPath);
  app = render(<App />);
  await screen.findByText("Your saved rating: 5/5");
  fireEvent.click(screen.getByRole("link", { name: "Return to catalogue" }));
  await screen.findByRole("heading", { name: "Find your next movie" });
  fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));
  await screen.findByRole("link", { name: "Sign in" });
  fireEvent.click(screen.getByRole("link", { name: "Sign in" }));
  await signIn("t33-b@example.com");
  app.unmount();
  window.history.pushState({}, "", detailPath);
  app = render(<App />);
  await screen.findByText("Not rated yet");
  expect(screen.queryByText("Your saved rating: 5/5")).not.toBeInTheDocument();
  await save(2);
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
    screen.queryByRole("combobox", { name: "Your rating (1 to 5)" }),
  ).not.toBeInTheDocument();
  expect(calls.slice(afterLogout).some(({ url }) => url.startsWith("/api/me/ratings/"))).toBe(false);
  fireEvent.click(screen.getByRole("link", { name: "Sign in to rate this movie" }));
  await signIn("t33-a@example.com");
  fireEvent.click(await screen.findByRole("link", { name: `View details for ${bridge.metadata.title}` }));
  await screen.findByText("Your saved rating: 5/5");
  expect((await state()).ratings).toEqual(final.ratings);
  expect((await state()).preferences).toEqual(baseline.preferences);
});
