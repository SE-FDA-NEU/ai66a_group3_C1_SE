// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../App";
import { RecommendationState } from "../pages/RecommendationsPage";

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function renderAuthenticatedRoute(path: string) {
  window.history.pushState({}, "", path);
  vi.spyOn(globalThis, "fetch").mockImplementationOnce(() =>
    jsonResponse({ data: { user: { id: "user-1", email: "viewer@example.com" } } }),
  );
  render(<App />);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("T13 recommendation landing", () => {
  it("renders the Popular section and an empty state without fake movie cards", async () => {
    renderAuthenticatedRoute("/recommendations");

    expect(await screen.findByRole("heading", { name: "Recommendations" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Popular" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No recommendations available yet." })).toBeInTheDocument();
    expect(screen.getByText("Enter your preferences to get personalised recommendations.")).toBeInTheDocument();
    expect(document.querySelectorAll(".movie-card")).toHaveLength(0);
  });

  it("links the empty state to the real preferences route", async () => {
    renderAuthenticatedRoute("/recommendations");

    expect(await screen.findByRole("link", { name: "Enter preferences →" })).toHaveAttribute(
      "href",
      "/preferences",
    );
  });

  it("renders the loading state", () => {
    render(<RecommendationState status="loading" />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading recommendations...");
  });

  it("makes preferences a real protected page", async () => {
    renderAuthenticatedRoute("/preferences");

    expect(await screen.findByRole("heading", { name: "Movie Preferences" })).toBeInTheDocument();
    expect(screen.getByText("Preference selection will be available soon.")).toBeInTheDocument();
  });
});