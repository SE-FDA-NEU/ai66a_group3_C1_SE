// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import App from "../App.tsx";

const action = { id: 28, name: "Action" };
const movie = (id: string, title: string, matchedGenres: typeof action[]) => ({
  id, title, releaseYear: 2025, genres: [action], popularityScore: 90,
  reason: { matchedGenres },
});
const page = (personalised: boolean) => ({
  data: {
    movies: [personalised ? movie("old", "Old personal result", [action]) :
      movie("new", "Fresh popular result", [])],
    mode: personalised ? "personalised" : "popular",
    personalised, noMatch: false,
  },
  meta: { count: 1, limit: 10, page: 1, total: 1, totalPages: 1,
    unfilteredTotal: 1, catalogueRevision: "rev-a" },
});
const json = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body)));

afterEach(() => {
  cleanup(); vi.restoreAllMocks(); window.history.replaceState({}, "", "/");
  window.sessionStorage.clear();
});

it("a recommendation read started before reset cannot restore old cards or reasons", async () => {
  let finishOld!: (response: Response) => void;
  const oldRead = new Promise<Response>(resolve => { finishOld = resolve; });
  let reset = false, recommendationReads = 0;
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const url = String(input);
    if (url === "/api/auth/me")
      return json({ data: { user: { id: "account-a", email: "a@example.test" } } });
    if (url === "/api/me/profile" && (init?.method ?? "GET") === "GET")
      return json({ data: { genres: reset ? [] : [action], ratingCount: reset ? 0 : 1,
        watchlistCount: 2 } });
    if (url === "/api/me/profile/reset" && init?.method === "POST") {
      reset = true;
      return json({ data: { reset: true } });
    }
    if (url.startsWith("/api/me/recommendations?")) {
      recommendationReads += 1;
      return recommendationReads === 1 ? oldRead : json(page(false));
    }
    if (url === "/api/genres") return json({ data: { genres: [action] } });
    throw new Error(`Unexpected request: ${url}`);
  });
  window.history.pushState({}, "", "/recommendations");
  render(<App />);
  await waitFor(() => expect(recommendationReads).toBe(1));
  fireEvent.click(screen.getByRole("link", { name: "Profile" }));
  await waitFor(() => expect(screen.getByTestId("profile-ratings-count")).toHaveTextContent("1"));
  fireEvent.click(screen.getByRole("button", { name: "Reset personalisation" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Reset personalisation" }));
  await waitFor(() => expect(screen.getByTestId("profile-ratings-count")).toHaveTextContent("0"));
  expect(screen.getByTestId("profile-watchlist-count")).toHaveTextContent("2");
  fireEvent.click(within(screen.getByRole("main")).getByRole("link", { name: "My recommendations" }));
  await screen.findByRole("heading", { name: "Fresh popular result" });
  await act(async () => finishOld(new Response(JSON.stringify(page(true)))));
  expect(screen.queryByText("Old personal result")).not.toBeInTheDocument();
  expect(screen.getByText("Not personalised")).toBeInTheDocument();
  expect(fetch.mock.calls.filter(([input]) => String(input).startsWith("/api/me/recommendations?"))).toHaveLength(2);
});
