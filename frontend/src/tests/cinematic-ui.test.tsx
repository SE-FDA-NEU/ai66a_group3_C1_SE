// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import App from "../App.tsx";
import MoviePoster from "../components/MoviePoster.tsx";
import StarRating from "../components/StarRating.tsx";
import { ThemeProvider, ThemeToggle } from "../theme.tsx";
import { readTheme, THEME_STORAGE_KEY } from "../themeStorage.ts";
import type { RatingValue } from "../api/ratings.ts";

afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); window.history.replaceState({}, "", "/"); });

it("defaults to dark and persists the explicit choice across remounts", () => {
  expect(readTheme()).toBe("dark");
  const view = render(<ThemeProvider><ThemeToggle /></ThemeProvider>);
  expect(document.documentElement.dataset.theme).toBe("dark");
  fireEvent.click(screen.getByRole("button", { name: "Switch to light theme" }));
  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  view.unmount();
  render(<ThemeProvider><ThemeToggle /></ThemeProvider>);
  expect(document.documentElement.dataset.theme).toBe("light");
});

it("handles corrupt or blocked storage without breaking theme controls", () => {
  localStorage.setItem(THEME_STORAGE_KEY, "not-a-theme");
  expect(readTheme()).toBe("dark");
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  render(<ThemeProvider><ThemeToggle /></ThemeProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Switch to light theme" }));
  expect(document.documentElement.dataset.theme).toBe("light");
});

it("theme changes preserve login input and URL without triggering an API request", () => {
  window.history.pushState({}, "", "/login?from=details");
  const fetch = vi.spyOn(globalThis, "fetch");
  render(<App />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "draft@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "unsaved-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Switch to light theme" }));
  expect(screen.getByLabelText("Email")).toHaveValue("draft@example.com");
  expect(screen.getByLabelText("Password")).toHaveValue("unsaved-password");
  expect(window.location.search).toBe("?from=details");
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.queryByRole("link", { name: "Watchlist" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute("href", "/search");
});

it.each([null, undefined, "https://evil.invalid/x.jpg", "https://image.tmdb.org/t/p/original/x.jpg", "https://image.tmdb.org/t/p/w500/x.jpg?token=secret"])(
  "uses a named poster fallback for %s", url => {
    render(<MoviePoster movieId="a" title="Alpha" posterUrl={url} />);
    expect(screen.getByRole("img", { name: "Poster unavailable for Alpha" })).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  },
);

it("reserves image dimensions, falls back after failure and resets on a new movie", () => {
  const view = render(<MoviePoster movieId="a" title="Alpha" posterUrl="https://image.tmdb.org/t/p/w500/a.jpg" />);
  const image = screen.getByRole("img", { name: "Poster for Alpha" });
  expect(image).toHaveAttribute("loading", "lazy");
  expect(image).toHaveAttribute("width", "500");
  fireEvent.error(image);
  expect(screen.getByRole("img", { name: "Poster unavailable for Alpha" })).toBeInTheDocument();
  view.rerender(<MoviePoster movieId="b" title="Beta" posterUrl="https://image.tmdb.org/t/p/w500/b.jpg" eager />);
  expect(screen.getByRole("img", { name: "Poster for Beta" })).toHaveAttribute("loading", "eager");
  expect(screen.queryByRole("img", { name: /Alpha/ })).not.toBeInTheDocument();
});

function Stars() {
  const [value, setValue] = useState<RatingValue | null>(null);
  return <StarRating value={value} onChange={setValue} />;
}

it("keeps star drafts across theme changes and never writes on select, hover or focus", () => {
  const fetch = vi.spyOn(globalThis, "fetch");
  render(<ThemeProvider><ThemeToggle /><Stars /></ThemeProvider>);
  expect(screen.getAllByRole("radio")).toHaveLength(5);
  expect(screen.queryByRole("radio", { name: "0 stars" })).not.toBeInTheDocument();
  const five = screen.getByRole("radio", { name: "5 stars" });
  fireEvent.mouseEnter(five.closest("label")!);
  fireEvent.focus(five);
  expect(five).not.toBeChecked();
  fireEvent.click(screen.getByRole("radio", { name: "4 stars" }));
  fireEvent.click(screen.getByRole("button", { name: "Switch to light theme" }));
  expect(screen.getByRole("radio", { name: "4 stars" })).toBeChecked();
  expect(screen.getByText("Selected rating: 4/5")).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});
