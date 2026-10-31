import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const trailer = {
  site: "YouTube", key: "AbCdEf123_-", name: "Official trailer", type: "Trailer",
  official: true, language: "en", publishedAt: null,
  url: "https://www.youtube.com/watch?v=AbCdEf123_-",
};
const image = "https://image.tmdb.org/t/p/w780/fixture.jpg";
const evidence = path.resolve("../docs/evidence/s4-t20/screenshots");

function movie(id: string, backdrop: boolean, hasTrailer: boolean) {
  return {
    id, title: `Fixture ${id}`, releaseYear: 2026,
    genres: [{ id: 18, name: "Drama" }], overview: "Synthetic detail fixture.",
    popularityScore: 42, voteAverage: null, voteCount: null,
    backdropUrl: backdrop ? image : null, posterUrl: null,
    trailer: hasTrailer ? trailer : null,
  };
}

async function fixture(page: Page, options: { delayed?: boolean } = {}) {
  const requests: string[] = [];
  await page.route("**/api/**", async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (!pathname.startsWith("/api/")) return route.continue();
    requests.push(pathname);
    if (pathname === "/api/auth/me")
      return route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
    if (pathname.endsWith("/similar"))
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({
        data: { movies: pathname === "/api/movies/broken/similar"
          ? [movie("next", false, false)] : [] },
      }) });
    const match = /^\/api\/movies\/(both|backdrop|trailer|neither|broken|next)$/.exec(pathname);
    if (!match) throw new Error(`Unexpected API request: ${pathname}`);
    const id = match[1];
    if (options.delayed && id === "next") await new Promise(resolve => setTimeout(resolve, 350));
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({
      data: { movie: movie(id, ["both", "backdrop", "broken"].includes(id),
        ["both", "trailer", "broken"].includes(id)) },
    }) });
  });
  await page.route("https://image.tmdb.org/**", route => route.fulfill({ status: 404, body: "" }));
  return requests;
}

test("all media combinations work in both themes and responsive widths", async ({ page }) => {
  const requests = await fixture(page);
  const tmdbMetadataRequests: string[] = [];
  page.on("request", request => {
    if (request.url().includes("api.themoviedb.org")) tmdbMetadataRequests.push(request.url());
  });
  await mkdir(evidence, { recursive: true });
  await page.goto("/movies/neither");
  for (const theme of ["dark", "light"] as const) {
    await page.evaluate(value => localStorage.setItem("cineai-theme", value), theme);
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const id of ["both", "backdrop", "trailer", "neither"] as const) {
        await page.goto(`/movies/${id}`);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await expect(page.getByRole("heading", { name: `Fixture ${id}` })).toBeVisible();
        await expect(page.locator(".movie-trailer")).toBeVisible();
        const link = page.getByRole("link", { name: /Watch trailer.*new tab/ });
        if (id === "both" || id === "trailer") {
          await expect(link).toHaveCount(1);
          await expect(link).toHaveAttribute("href", trailer.url);
          await expect(link).toHaveAttribute("target", "_blank");
          await expect(link).toHaveAttribute("rel", "noopener noreferrer");
          await link.focus();
          await expect(link).toBeFocused();
        } else {
          await expect(link).toHaveCount(0);
          await expect(page.getByText("Trailer unavailable")).toBeVisible();
        }
        await expect(page.locator(".movie-detail__hero-image")).toHaveCount(0);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
        expect(overflow).toBe(false);
        if ((theme === "dark" && width === 1440 && id === "both")
            || (theme === "light" && width === 375 && id === "neither")) {
          await page.screenshot({ path: path.join(evidence, `${theme}-${width}-${id}.png`), fullPage: true });
        }
      }
    }
  }
  await page.context().route("https://www.youtube.com/**", route =>
    route.fulfill({ contentType: "text/html", body: "Synthetic destination" }));
  await page.goto("/movies/both");
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("link", { name: /Watch trailer/ }).click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(trailer.url);
  await popup.close();
  expect(requests.every(url => url.startsWith("/api/"))).toBe(true);
  expect(tmdbMetadataRequests).toHaveLength(0);
  expect(await page.locator("iframe").count()).toBe(0);
});

test("broken image and rapid navigation clear the previous trailer", async ({ page }) => {
  await fixture(page, { delayed: true });
  await page.goto("/movies/broken");
  await expect(page.getByRole("heading", { name: "Fixture broken" })).toBeVisible();
  await expect(page.locator(".movie-detail__hero-image")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Watch trailer/ })).toHaveCount(1);
  await page.getByRole("link", { name: "View details for Fixture next" }).click();
  await expect(page.getByText("Loading movie...")).toBeVisible();
  await expect(page.getByRole("link", { name: /Watch trailer/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Fixture next" })).toBeVisible();
  await expect(page.getByText("Trailer unavailable")).toBeVisible();
});
