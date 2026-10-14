// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import App from "../App.tsx";

const genres = [{ id: 28, name: "Action" }, { id: 35, name: "Comedy" }, { id: 27, name: "Horror" }];
const names = ["Action Z", "Comedy C", "Action A", "Comedy A", "Comedy B"];
const movies = names.map((title, index) => ({
  id: `synthetic-t16-${index}`, title, releaseYear: 2025,
  genres: [genres[index === 0 || index === 2 ? 0 : 1]], popularityScore: 100 - index,
  reason: { matchedGenres: [genres[index === 0 || index === 2 ? 0 : 1]] },
}));

function titles() {
  return [...document.querySelectorAll(".movie-card h2")].map((node) => node.textContent);
}

afterEach(() => {
  cleanup(); vi.restoreAllMocks(); window.history.replaceState({}, "", "/");
});

it.each([false, true])("all S06 criteria on one accepted snapshot (noMatch=%s)", async (noMatch) => {
  const calls: { url: string; method: string }[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation((input, options) => {
    const url = String(input); calls.push({ url, method: options?.method ?? "GET" });
    let body: unknown;
    if (url === "/api/auth/me") body = { data: { user: { id: "synthetic-account", email: "synthetic@example.com" } } };
    else if (url === "/api/genres") body = { data: { genres } };
    else if (url === "/api/me/recommendations?limit=10") body = { data: {
      movies, mode: noMatch ? "popular" : "personalised", personalised: !noMatch, noMatch,
    } };
    else return Promise.reject(new Error(`Unexpected acceptance request: ${url}`));
    return Promise.resolve(new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } }));
  });
  window.history.pushState({}, "", "/recommendations"); render(<App />);
  const select = await screen.findByRole("combobox", { name: "Filter by genre" });
  await waitFor(() => expect(select).toBeEnabled());
  expect(titles()).toEqual(names);
  const baseline = [...calls];
  fireEvent.change(select, { target: { value: "28" } });
  expect(titles()).toEqual(["Action Z", "Action A"]);
  fireEvent.click(screen.getByRole("button", { name: "Clear filter" }));
  expect(titles()).toEqual(names);
  fireEvent.change(select, { target: { value: "35" } });
  expect(titles()).toEqual(["Comedy C", "Comedy A", "Comedy B"]);
  fireEvent.change(select, { target: { value: "27" } });
  expect(titles()).toEqual([]);
  expect(screen.getByText("No movies match this filter.")).toBeInTheDocument();
  expect(screen.getByText("Showing 0 of 5 movies")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Show all movies" }));
  expect(titles()).toEqual(names);
  expect(select).toHaveValue("");
  expect(calls).toEqual(baseline);
  expect(calls.every(({ method }) => method === "GET")).toBe(true);
});
