// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "../auth/AuthContext.tsx";
import MovieDetailPage from "../pages/MovieDetailPage.tsx";
import {
  readWatchCountry, validWatchOptionsUrl, WATCH_COUNTRIES, WATCH_COUNTRY_STORAGE_KEY,
} from "../watchCountry.ts";

const LOGO = "https://image.tmdb.org/t/p/w92/logo.png";
const NAMES: Record<string, string> = { US: "United States", GB: "United Kingdom", SG: "Singapore" };

type Providers = Record<string, unknown> | null | undefined;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function link(movie: string, country: string) {
  return `https://www.themoviedb.org/movie/603-${movie}/watch?locale=${country}`;
}

function success(country: string, names: string[], extra: Record<string, unknown> = {}) {
  return {
    country, status: "success", attemptedAt: "2026-11-10T10:00:00Z",
    checkedAt: "2026-11-10T10:00:01Z",
    groups: {
      flatrate: names.map((name, index) => ({ id: index + 1, name, logoUrl: null })),
      rent: [], buy: [], free: [], ads: [], ...extra,
    },
  };
}

function movieBody(id: string, providers: Providers, watchOptionsUrl: string | null) {
  return { data: { movie: {
    id, title: `Title ${id}`, releaseYear: 2025, genres: [{ id: 18, name: "Drama" }],
    popularityScore: 50, overview: `Overview ${id}`, voteAverage: null, voteCount: null,
    providers, watchOptionsUrl,
  } } };
}

type Responder = (id: string, country: string) => Response | Promise<Response>;

function deferred() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>(done => { resolve = done; });
  return { promise, resolve };
}

function installApi(responder: Responder) {
  const requests: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const path = String(input);
    requests.push(path);
    const detail = /^\/api\/movies\/([^/?]+)\?country=([A-Z]+)$/.exec(path);
    if (detail) return responder(detail[1], detail[2]);
    if (/^\/api\/movies\/[^/?]+\/similar$/.test(path)) return json({ data: { movies: [] } });
    if (path === "/api/auth/me") return json({ error: { code: "AUTHENTICATION_REQUIRED" } }, 401);
    throw new Error(`Unexpected request: ${path}`);
  });
  return requests;
}

function standard(): Responder {
  return (id, country) => json(movieBody(id, success(country, [`${country} Stream ${id}`]), link(id, country)));
}

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={["/movies/movie-a"]}>
      <AuthProvider>
        <Link to="/movies/movie-b">Open movie B</Link>
        <Routes><Route path="/movies/:movieId" element={<MovieDetailPage />} /></Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function selector() {
  return screen.getByRole("combobox", { name: "Country" }) as HTMLSelectElement;
}

function choose(code: string) {
  fireEvent.change(selector(), { target: { value: code } });
}

function section() {
  return screen.getByRole("region", { name: /Where to watch in/ });
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("S5-T05 regional watch providers", () => {
  it("defaults to the United States with exactly US, GB and SG choices", async () => {
    const requests = installApi(standard());
    renderDetail();

    expect(await screen.findByRole("heading", { name: "Where to watch in United States" })).toBeVisible();
    expect(requests).toContain("/api/movies/movie-a?country=US");
    expect(selector().value).toBe("US");
    expect(within(selector()).getAllByRole("option").map(option => option.getAttribute("value")))
      .toEqual(["US", "GB", "SG"]);
    const stream = within(section()).getByRole("region", { name: "Stream in United States" });
    expect(within(stream).getByText("US Stream movie-a")).toBeVisible();
    expect(section()).toHaveTextContent("TMDb, powered by JustWatch");
    expect(section()).toHaveTextContent("depends on the selected market");
  });

  it.each(["GB", "SG"])("uses a persisted %s selection for the first request", async (code) => {
    localStorage.setItem(WATCH_COUNTRY_STORAGE_KEY, code);
    const requests = installApi(standard());
    renderDetail();

    expect(await screen.findByRole("heading", { name: `Where to watch in ${NAMES[code]}` })).toBeVisible();
    expect(requests).toContain(`/api/movies/movie-a?country=${code}`);
    expect(requests).not.toContain("/api/movies/movie-a?country=US");
    expect(selector().value).toBe(code);
  });

  it.each(["VN", "gb", "", "{\"x\":1}"])("falls back to US for the corrupt stored value %j", async (value) => {
    localStorage.setItem(WATCH_COUNTRY_STORAGE_KEY, value);
    const requests = installApi(standard());
    renderDetail();

    expect(await screen.findByRole("heading", { name: "Where to watch in United States" })).toBeVisible();
    expect(requests).toContain("/api/movies/movie-a?country=US");
  });

  it("falls back to US when browser storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(readWatchCountry()).toBe("US");
  });

  it("saves a valid choice, requests that country and clears the previous region while loading", async () => {
    const gb = deferred();
    const requests = installApi((id, country) => country === "GB" ? gb.promise : standard()(id, country));
    renderDetail();
    await screen.findByText("US Stream movie-a");

    choose("GB");

    expect(localStorage.getItem(WATCH_COUNTRY_STORAGE_KEY)).toBe("GB");
    expect(screen.getByRole("heading", { name: "Where to watch in United Kingdom" })).toBeVisible();
    expect(await screen.findByText("Loading availability for United Kingdom…")).toBeVisible();
    expect(screen.queryByText("US Stream movie-a")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /View watch options/ })).not.toBeInTheDocument();
    expect(requests).toContain("/api/movies/movie-a?country=GB");

    await act(async () => { gb.resolve(json(movieBody("movie-a", success("GB", ["BBC Stream"]), link("movie-a", "GB")))); });
    expect(await screen.findByText("BBC Stream")).toBeVisible();
    expect(screen.getByRole("link", { name: "View watch options on TMDb ↗" }))
      .toHaveAttribute("href", link("movie-a", "GB"));
  });

  it("keeps the latest country through rapid US to GB to SG switches and late responses", async () => {
    const gb = deferred();
    const sg = deferred();
    installApi((id, country) => country === "GB" ? gb.promise : country === "SG" ? sg.promise : standard()(id, country));
    renderDetail();
    await screen.findByText("US Stream movie-a");

    choose("GB");
    choose("SG");
    await act(async () => { sg.resolve(json(movieBody("movie-a", success("SG", ["SG Stream"]), link("movie-a", "SG")))); });
    expect(await screen.findByText("SG Stream")).toBeVisible();
    await act(async () => { gb.resolve(json(movieBody("movie-a", success("GB", ["GB Late"]), link("movie-a", "GB")))); });

    expect(screen.getByRole("heading", { name: "Where to watch in Singapore" })).toBeVisible();
    expect(screen.queryByText("GB Late")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View watch options/ })).toHaveAttribute("href", link("movie-a", "SG"));
    expect(selector().value).toBe("SG");
    // The superseded GB request was cancelled; choosing GB later requests it afresh.
    expect(screen.queryByText("SG Stream")).toBeVisible();
  });

  it("rejects a response for a different region instead of showing it under the selected label", async () => {
    installApi((id, country) => country === "SG"
      ? json(movieBody(id, success("GB", ["Wrong region"]), link(id, "GB"))) : standard()(id, country));
    renderDetail();
    await screen.findByText("US Stream movie-a");

    choose("SG");

    expect(await screen.findByText("Viewing availability could not be loaded for Singapore.")).toBeVisible();
    expect(screen.queryByText("Wrong region")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /View watch options/ })).not.toBeInTheDocument();
  });

  it("shows a recoverable error and retries only the selected country", async () => {
    let attempts = 0;
    const requests = installApi((id, country) => {
      if (country === "GB" && ++attempts === 1) return json({ error: { message: "boom" } }, 500);
      return standard()(id, country);
    });
    renderDetail();
    await screen.findByText("US Stream movie-a");

    choose("GB");
    expect(await screen.findByRole("alert")).toHaveTextContent("Viewing availability could not be loaded for United Kingdom.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("GB Stream movie-a")).toBeVisible();
    expect(requests.filter(path => path.endsWith("country=GB"))).toHaveLength(2);
    expect(requests.filter(path => path === "/api/movies/movie-a?country=US")).toHaveLength(1);
  });

  it("ignores a late response for the previous movie after navigating to another movie", async () => {
    const gbForA = deferred();
    installApi((id, country) => id === "movie-a" && country === "GB" ? gbForA.promise : standard()(id, country));
    renderDetail();
    await screen.findByText("US Stream movie-a");
    choose("GB");

    fireEvent.click(screen.getByRole("link", { name: "Open movie B" }));
    // The stored choice is reused when opening another movie.
    expect(await screen.findByText("GB Stream movie-b")).toBeVisible();
    await act(async () => { gbForA.resolve(json(movieBody("movie-a", success("GB", ["Movie A leak"]), link("movie-a", "GB")))); });

    expect(screen.queryByText("Movie A leak")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Title movie-b", level: 1 })).toBeVisible();
    expect(screen.getByRole("link", { name: /View watch options/ })).toHaveAttribute("href", link("movie-b", "GB"));
  });

  it("opens the validated TMDb page safely in a new tab with the exact label", async () => {
    installApi(standard());
    renderDetail();
    await screen.findByText("US Stream movie-a");

    const action = screen.getByRole("link", { name: "View watch options on TMDb ↗" });
    expect(action).toHaveAttribute("href", link("movie-a", "US"));
    expect(action).toHaveAttribute("target", "_blank");
    expect(action).toHaveAttribute("rel", "noopener noreferrer");
    expect(action).toHaveAccessibleDescription("Opens TMDb for United States in a new tab.");
    expect(screen.getAllByRole("link", { name: /View watch options/ })).toHaveLength(1);
  });

  it("shows badges without an action when the link is null", async () => {
    installApi((id, country) => json(movieBody(id, success(country, ["Only badges"]), null)));
    renderDetail();

    expect(await screen.findByText("Only badges")).toBeVisible();
    expect(screen.queryByRole("link", { name: /View watch options/ })).not.toBeInTheDocument();
  });

  it.each([
    ["wrong country", link("movie-a", "GB")],
    ["wrong host", "https://evil.example/movie/603/watch?locale=US"],
    ["plain http", "http://www.themoviedb.org/movie/603/watch?locale=US"],
    ["extra parameter", "https://www.themoviedb.org/movie/603/watch?locale=US&redirect=x"],
    ["javascript URL", "javascript:alert(1)"],
    ["credentials", "https://user@www.themoviedb.org/movie/603/watch?locale=US"],
  ])("omits the action for an invalid link: %s", async (_label, url) => {
    installApi((id, country) => json(movieBody(id, success(country, ["Badge stays"]), url)));
    renderDetail();

    expect(await screen.findByText("Badge stays")).toBeVisible();
    expect(screen.queryByRole("link", { name: /View watch options/ })).not.toBeInTheDocument();
  });

  it("shows the neutral message and the action when groups are empty but the link is valid", async () => {
    installApi((id, country) => json(movieBody(id, {
      country, status: "no_data", attemptedAt: "2026-11-10T10:00:00Z",
      checkedAt: "2026-11-10T10:00:00Z",
      groups: { flatrate: [], rent: [], buy: [], free: [], ads: [] },
    }, link(id, country))));
    renderDetail();

    expect(await screen.findByText("Viewing availability is not available for United States.")).toBeVisible();
    expect(screen.getByRole("link", { name: "View watch options on TMDb ↗" })).toBeVisible();
  });

  it.each([
    ["not_checked", "Viewing availability has not been checked for United States yet."],
    ["error", "Viewing availability could not be checked for United States. Try again later."],
    ["no_data", "Viewing availability is not available for United States."],
  ])("shows a neutral %s state with no badges and no action", async (status, message) => {
    installApi((id, country) => json(movieBody(id, {
      country, status, attemptedAt: null, checkedAt: null,
      groups: { flatrate: [], rent: [], buy: [], free: [], ads: [] },
    }, null)));
    renderDetail();

    expect(await screen.findByText(message)).toBeVisible();
    expect(within(section()).queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.queryByRole("link", { name: /View watch options/ })).not.toBeInTheDocument();
  });

  it("treats a response without provider fields as unavailable", async () => {
    installApi((id) => json(movieBody(id, undefined, undefined as unknown as null)));
    renderDetail();

    expect(await screen.findByText("Viewing availability is not available for United States.")).toBeVisible();
  });

  it("keeps stale data with a freshness warning", async () => {
    installApi((id, country) => json(movieBody(id, {
      ...success(country, ["Old but kept"]), status: "stale",
    }, link(id, country))));
    renderDetail();

    expect(await screen.findByText("Old but kept")).toBeVisible();
    expect(screen.getByRole("note")).toHaveTextContent("Showing the last successful check on 10 Nov 2026.");
    expect(screen.getByRole("link", { name: /View watch options/ })).toBeVisible();
  });

  it.each([null, link("movie-a", "US")])(
    "warns about an empty stale snapshot with watch URL %s",
    async (watchUrl) => {
      installApi((id, country) => json(movieBody(id, {
        ...success(country, []), status: "stale",
      }, watchUrl)));
      renderDetail();

      const warning = await screen.findByRole("note");
      expect(warning).toHaveTextContent("Showing the last successful check on 10 Nov 2026.");
      expect(warning).toHaveTextContent("The latest refresh failed");
      expect(screen.getByText("Viewing availability is not available for United States.")).toBeVisible();
      expect(within(section()).queryAllByRole("listitem")).toHaveLength(0);
      if (watchUrl) {
        expect(screen.getByRole("link", { name: /View watch options/ })).toHaveAttribute("href", watchUrl);
      } else {
        expect(screen.queryByRole("link", { name: /View watch options/ })).not.toBeInTheDocument();
      }
    },
  );

  it("renders every group in order with validated logos and keeps names when a logo breaks", async () => {
    installApi((id, country) => json(movieBody(id, {
      country, status: "success", attemptedAt: null, checkedAt: "2026-11-10T10:00:01Z",
      groups: {
        flatrate: [{ id: 1, name: "Stream One", logoUrl: LOGO }],
        rent: [{ id: 2, name: "Rent One", logoUrl: "https://evil.example/x.png" }],
        buy: [{ id: 3, name: "Buy One", logoUrl: null }],
        free: [{ id: 4, name: "A very long provider name that must wrap rather than overflow the badge", logoUrl: LOGO }],
        ads: [{ id: 5, name: "Ads One", logoUrl: null }],
      },
    }, null)));
    const { container } = renderDetail();
    await screen.findByText("Stream One");

    expect(within(section()).getAllByRole("heading", { level: 3 }).map(h => h.textContent))
      .toEqual(["Stream", "Rent", "Buy", "Free", "With ads"]);
    const images = [...container.querySelectorAll("img.provider-badge__logo")];
    expect(images.map(img => img.getAttribute("src"))).toEqual([LOGO, LOGO]);
    fireEvent.error(images[0]);
    expect(container.querySelectorAll("img.provider-badge__logo")).toHaveLength(1);
    expect(screen.getByText("Stream One")).toBeVisible();
    expect(screen.getByText(/A very long provider name/)).toBeVisible();
  });

  it("keeps the overview, trailer fallback and title beside the new section", async () => {
    installApi(standard());
    renderDetail();
    await screen.findByText("US Stream movie-a");

    expect(screen.getByRole("heading", { name: "Overview" })).toBeVisible();
    expect(screen.getByText("Trailer unavailable")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Title movie-a", level: 1 })).toBeVisible();
    await waitFor(() => expect(screen.queryByText("Loading movie...")).not.toBeInTheDocument());
  });
});

describe("watch country helpers", () => {
  it("supports exactly US, GB and SG", () => {
    expect(WATCH_COUNTRIES.map(country => country.code)).toEqual(["US", "GB", "SG"]);
  });

  it.each([
    ["https://www.themoviedb.org/movie/603-the-matrix/watch?locale=US", "US", true],
    ["https://themoviedb.org/movie/603/watch?locale=GB", "GB", true],
    ["https://www.themoviedb.org:443/movie/603/watch?locale=SG", "SG", true],
    ["https://www.themoviedb.org/movie/603/watch?locale=US#frag", "US", false],
    ["https://www.themoviedb.org/movie/603/watch?locale=GB", "US", false],
    ["https://www.themoviedb.org/tv/603/watch?locale=US", "US", false],
    ["https://www.themoviedb.org/movie/603/watch", "US", false],
    ["https://www.themoviedb.org:8443/movie/603/watch?locale=US", "US", false],
    ["https://www.themoviedb.org/movie/603/watch?locale=US ", "US", false],
    [null, "US", false],
  ])("validates %s for %s", (url, country, ok) => {
    expect(validWatchOptionsUrl(url, country as "US" | "GB" | "SG")).toBe(ok ? url : null);
  });
});
