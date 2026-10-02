// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "../App";

const APPROVED_GUEST_STATEMENT =
  "You can browse popular movies without signing in or providing preferences.";
const APPROVED_STEP_TITLES = [
  "Register or sign in.",
  "Choose genres.",
  "Receive recommendations with optional movie ratings.",
];

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function renderExplanationRoute() {
  window.history.pushState({}, "", "/about-recommendations");
  render(<App />);
}

beforeEach(() => {
  window.history.replaceState({}, "", "/");
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("S2-T19 recommendation explanation verification", () => {
  it("renders the recommendation explanation page", () => {
    renderExplanationRoute();

    expect(
      screen.getByRole("heading", { name: "About Recommendations", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "How recommendations work", level: 2 }),
    ).toBeInTheDocument();
  });

  it("shows exactly the three approved numbered recommendation steps", () => {
    renderExplanationRoute();

    const processSection = screen.getByRole("region", {
      name: "How recommendations work",
    });
    const processList = within(processSection).getByRole("list");
    const steps = within(processList).getAllByRole("listitem");

    expect(processList.tagName).toBe("OL");
    expect(steps).toHaveLength(APPROVED_STEP_TITLES.length);
    expect(
      steps.map((step) => step.querySelector("strong")?.textContent),
    ).toEqual(APPROVED_STEP_TITLES);
  });

  it("shows the approved guest statement outside the numbered process", () => {
    renderExplanationRoute();

    const guestSection = screen.getByRole("region", {
      name: "Browse without an account",
    });
    const processList = within(
      screen.getByRole("region", { name: "How recommendations work" }),
    ).getByRole("list");
    expect(
      within(guestSection).getByText(APPROVED_GUEST_STATEMENT, { exact: true }),
    ).toBeInTheDocument();
    expect(processList).not.toHaveTextContent(APPROVED_GUEST_STATEMENT);
  });

  it("shows TMDb attribution in its own section instead of a fourth step", () => {
    renderExplanationRoute();

    const attributionSection = screen.getByRole("region", {
      name: "TMDb Attribution",
    });
    const processList = within(
      screen.getByRole("region", { name: "How recommendations work" }),
    ).getByRole("list");
    const attribution =
      "This product uses the TMDB API but is not endorsed or certified by TMDB.";

    expect(within(attributionSection).getByText(attribution)).toBeInTheDocument();
    expect(processList).not.toHaveTextContent(attribution);
    expect(within(processList).getAllByRole("listitem")).toHaveLength(3);
  });

  it("allows guest access to the public route without an authentication request", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    renderExplanationRoute();

    expect(window.location.pathname).toBe("/about-recommendations");
    expect(
      screen.getByRole("heading", { name: "About Recommendations" }),
    ).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("navigates from the public catalogue to the explanation and back in an empty browser context", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      jsonResponse({
        data: { movies: [] },
        meta: { count: 0, limit: 10, catalogueRevision: "revision-test" },
      }),
    );

    render(<App />);

    fireEvent.click(
      screen.getByRole("link", { name: "How recommendations work" }),
    );

    expect(
      await screen.findByRole("heading", { name: "About Recommendations" }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/about-recommendations");

    fireEvent.click(screen.getByRole("link", { name: "Back to Catalogue" }));

    expect(
      await screen.findByRole("heading", { name: "Find your next movie" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "No movies available" }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
    expect(fetchSpy.mock.calls.map(([request]) => request)).toEqual([
      "/api/movies?limit=10",
      "/api/movies?limit=10",
    ]);
  });
});
