// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../App";

function renderExplanationRoute() {
  window.history.pushState({}, "", "/about-recommendations");
  render(<App />);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("T18 recommendation explanation page", () => {
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
    expect(steps).toHaveLength(3);
    expect(steps.map((step) => step.textContent)).toEqual([
      "Register or sign in. Create an account or sign in so that the system can keep your preferences and optional ratings with your account.",
      "Choose genres. Select the movie genres that you prefer.",
      "Receive recommendations with optional movie ratings. View recommendations based on your selected genres, and optionally rate movies to provide feedback for later recommendations.",
    ]);
  });

  it("shows the approved guest statement outside the numbered process", () => {
    renderExplanationRoute();

    const guestSection = screen.getByRole("region", {
      name: "Browse without an account",
    });
    const processList = within(
      screen.getByRole("region", { name: "How recommendations work" }),
    ).getByRole("list");
    const guestStatement =
      "You can browse popular movies without signing in or providing preferences.";

    expect(within(guestSection).getByText(guestStatement)).toBeInTheDocument();
    expect(processList).not.toHaveTextContent(guestStatement);
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

  it("provides a link back to the public catalogue", () => {
    renderExplanationRoute();

    expect(
      screen.getByRole("link", { name: "Back to Catalogue" }),
    ).toHaveAttribute("href", "/");
  });
});
