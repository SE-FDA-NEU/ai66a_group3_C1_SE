// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import App from "../App.tsx";

const genres = [{ id: 28, name: "Action" }, { id: 35, name: "Comedy" },
  { id: 27, name: "Horror" }];
const names = ["Action Z", "Comedy C", "Action A", "Comedy A", "Comedy B"];
const movies = names.map((title, index) => ({
  id: `synthetic-t16-${index}`, title, releaseYear: 2025,
  genres: [genres[index === 0 || index === 2 ? 0 : 1]], popularityScore: 100 - index,
  reason: { matchedGenres: [genres[index === 0 || index === 2 ? 0 : 1]] },
}));

function titles() {
  return [...document.querySelectorAll(".movie-card h2")].map(node => node.textContent);
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); window.history.replaceState({}, "", "/"); });

it.each([false, true])("S06 filters the server result, preserves mode and never writes (noMatch=%s)", async noMatch => {
  const calls: { url: string; method: string }[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation((input, options) => {
    const url = String(input); calls.push({ url, method: options?.method ?? "GET" });
    let body: unknown;
    if (url === "/api/auth/me") body = { data: { user: { id: "synthetic-account", email: "synthetic@example.com" } } };
    else if (url === "/api/genres") body = { data: { genres } };
    else if (url.startsWith("/api/me/recommendations?")) {
      const genreId = new URL(url, "http://localhost").searchParams.get("genreId");
      const selected = genreId ? movies.filter(movie => movie.genres.some(genre => String(genre.id) === genreId)) : movies;
      body = { data: { movies: selected, mode: noMatch ? "popular" : "personalised",
        personalised: !noMatch, noMatch }, meta: { count: selected.length,
        limit: 10, page: 1, total: selected.length, totalPages: selected.length ? 1 : 0,
        unfilteredTotal: 5, catalogueRevision: "revision" } };
    } else return Promise.reject(new Error(`Unexpected acceptance request: ${url}`));
    return Promise.resolve(new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } }));
  });
  window.history.pushState({}, "", "/recommendations"); render(<App />);
  await waitFor(() => expect(titles()).toEqual(names));
  const select = screen.getByRole("combobox", { name: "Filter by genre" });
  await waitFor(() => expect(select).toBeEnabled());
  fireEvent.change(select, { target: { value: "28" } });
  await waitFor(() => expect(titles()).toEqual(["Action Z", "Action A"]));
  expect(window.location.search).toContain("genreId=28");
  expect(screen.getByText("Showing 1-2 of 2 matches (5 recommendations before filtering)")).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("combobox")).toBeEnabled());
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "35" } });
  expect(window.location.search).toContain("genreId=35");
  await waitFor(() => expect(titles()).toEqual(["Comedy C", "Comedy A", "Comedy B"]));
  await waitFor(() => expect(screen.getByRole("combobox")).toBeEnabled());
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "27" } });
  expect(await screen.findByText("No movies match this filter.")).toBeInTheDocument();
  expect(titles()).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: "Show all movies" }));
  await waitFor(() => expect(titles()).toEqual(names));
  expect(screen.getByRole("combobox")).toHaveValue("");
  expect(calls.filter(call => call.url.startsWith("/api/me/recommendations"))).toHaveLength(5);
  expect(calls.every(call => call.method === "GET")).toBe(true);
});
