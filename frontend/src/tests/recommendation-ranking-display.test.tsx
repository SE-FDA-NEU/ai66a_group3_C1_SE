// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../App";

const action = { id: 28, name: "Action" };
const comedy = { id: 35, name: "Comedy" };

type Basis = "rating_signals" | "baseline" | "rating_unavailable";

function ranked(
  id: string,
  title: string,
  popularityScore: number | null,
  ratingAdjustment: number,
  adjustedScore: number | null,
  basis: Basis,
) {
  return {
    id,
    title,
    releaseYear: 2024,
    genres: [action, comedy],
    popularityScore,
    ratingAdjustment,
    adjustedScore,
    basis,
    reason: { matchedGenres: [action] },
  };
}

function renderBody(body: unknown) {
  window.history.pushState({}, "", "/recommendations");
  vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url = String(input);
    const json = (data: unknown) =>
      Promise.resolve(new Response(JSON.stringify(data), { status: 200 }));
    if (url === "/api/auth/me")
      return json({ data: { user: { id: "user-a", email: "a@example.com" } } });
    if (url === "/api/genres") return json({ data: { genres: [action, comedy] } });
    if (url.startsWith("/api/me/recommendations")) return json(body);
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  render(<App />);
}

function personalised(movies: unknown[]) {
  return { data: { movies, mode: "personalised", personalised: true, noMatch: false } };
}

function card(title: string) {
  return screen.getByRole("heading", { name: title }).closest("article")!;
}

function valueOf(article: HTMLElement, label: string) {
  return within(article).getByText(label).nextElementSibling;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("S4-T04 personal ranking score on recommendation cards", () => {
  it("shows base popularity and the personal score separately in server order", async () => {
    renderBody(personalised([
      ranked("movie-a", "Zenith Action", 80, 1, 81, "rating_signals"),
      ranked("movie-b", "Aardvark Comedy", 80, 0, 80, "baseline"),
    ]));

    await screen.findByRole("heading", { name: "Recommended for you" });
    const titles = screen.getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(titles).toEqual(["Recommended for you", "Zenith Action", "Aardvark Comedy"]);

    const boosted = card("Zenith Action");
    expect(valueOf(boosted, "TMDb popularity")).toHaveTextContent("80");
    expect(valueOf(boosted, "Ranking score for you")).toHaveTextContent("81");
    expect(within(boosted).getByText(
      "Your high ratings of related movies raised this score.")).toBeInTheDocument();

    const unchanged = card("Aardvark Comedy");
    expect(valueOf(unchanged, "TMDb popularity")).toHaveTextContent("80");
    expect(valueOf(unchanged, "Ranking score for you")).toHaveTextContent("80");
    expect(within(unchanged).getByText(
      "Your ratings have not changed this score.")).toBeInTheDocument();
  });

  it("explains a negative adjustment without relabelling the score as popularity", async () => {
    renderBody(personalised([
      ranked("movie-b", "Aardvark Comedy", 80, 0, 80, "baseline"),
      ranked("movie-a", "Zenith Action", 80, -1, 79, "rating_signals"),
    ]));

    await screen.findByRole("heading", { name: "Recommended for you" });
    const lowered = card("Zenith Action");
    expect(valueOf(lowered, "TMDb popularity")).toHaveTextContent("80");
    expect(valueOf(lowered, "Ranking score for you")).toHaveTextContent("79");
    expect(within(lowered).getByText(
      "Your low ratings of related movies lowered this score.")).toBeInTheDocument();
  });

  it("discloses unavailable rating signals without claiming the account has no ratings", async () => {
    renderBody(personalised([
      ranked("movie-a", "Zenith Action", 80, 0, 80, "rating_unavailable"),
    ]));

    await screen.findByRole("heading", { name: "Recommended for you" });
    const unavailable = card("Zenith Action");
    expect(within(unavailable).getByText(
      "Your rating signals are temporarily unavailable, so this score uses popularity only."))
      .toBeInTheDocument();
    expect(within(unavailable).queryByText(/no ratings|not rated|haven.t rated/i))
      .not.toBeInTheDocument();
  });

  it("shows Information unavailable for a missing score instead of 0 or NaN", async () => {
    renderBody(personalised([
      ranked("movie-a", "Zenith Action", null, 1, null, "rating_signals"),
    ]));

    await screen.findByRole("heading", { name: "Recommended for you" });
    const missing = card("Zenith Action");
    expect(valueOf(missing, "TMDb popularity")).toHaveTextContent("Information unavailable");
    expect(valueOf(missing, "Ranking score for you")).toHaveTextContent("Information unavailable");
    expect(missing).not.toHaveTextContent(/NaN|\b0\b/);
    expect(within(missing).queryByText(/raised this score|lowered this score/))
      .not.toBeInTheDocument();
  });

  it("keeps the backend order when two scores round to the same text", async () => {
    renderBody(personalised([
      ranked("movie-b", "Aardvark Comedy", 80.004, 0, 80.004, "baseline"),
      ranked("movie-a", "Zenith Action", 80.003, 0, 80.003, "baseline"),
    ]));

    await screen.findByRole("heading", { name: "Recommended for you" });
    expect(valueOf(card("Aardvark Comedy"), "Ranking score for you")).toHaveTextContent("80");
    expect(valueOf(card("Zenith Action"), "Ranking score for you")).toHaveTextContent("80");
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent))
      .toEqual(["Recommended for you", "Aardvark Comedy", "Zenith Action"]);
  });

  it("never copies a rating onto a related unrated candidate", async () => {
    renderBody(personalised([
      ranked("movie-a", "Zenith Action", 80, 1, 81, "rating_signals"),
    ]));

    await screen.findByRole("heading", { name: "Recommended for you" });
    expect(screen.queryByText(/Your rating|Your saved rating|\d\/5/)).not.toBeInTheDocument();
  });

  it("popular mode shows base popularity and Not personalised without a private score", async () => {
    renderBody({
      data: {
        movies: [ranked("movie-a", "Zenith Action", 80, 1, 81, "rating_signals")],
        mode: "popular",
        personalised: false,
        noMatch: false,
      },
    });

    await screen.findByRole("heading", { name: "Popular" });
    expect(screen.getByText("Not personalised")).toBeInTheDocument();
    expect(valueOf(card("Zenith Action"), "TMDb popularity")).toHaveTextContent("80");
    expect(screen.queryByText("Ranking score for you")).not.toBeInTheDocument();
    expect(screen.queryByText(/raised this score|lowered this score/)).not.toBeInTheDocument();
  });
});
