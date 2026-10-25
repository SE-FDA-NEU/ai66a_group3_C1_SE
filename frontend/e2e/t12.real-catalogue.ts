import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const screenshotDirectory = process.env.T12_REAL_SCREENSHOT_DIR;
const visualEmail = "watchlist-visual@example.test";
const visualPassword = "Synthetic-t12-visual-password";

async function capture(page: import("@playwright/test").Page, name: string, fullPage = true) {
  if (!screenshotDirectory) return;
  await mkdir(screenshotDirectory, { recursive: true });
  await page.screenshot({ path: path.join(screenshotDirectory, `${name}.png`), fullPage });
}

async function waitForPosters(images: import("@playwright/test").Locator) {
  const count = await images.count();
  for (let index = 0; index < count; index++) {
    const image = images.nth(index);
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth),
      { timeout: 20_000 }).toBeGreaterThan(0);
  }
}

test("real imported movies and posters appear in the saved list and detail", async ({ page, request }) => {
  test.skip(!process.env.S13_TMDB_DATABASE || !screenshotDirectory,
    "Requires an explicit imported-DB source and screenshot directory");

  const catalogueResponse = await request.get("/api/movies/popular?limit=10");
  expect(catalogueResponse.status()).toBe(200);
  const catalogue = await catalogueResponse.json();
  expect(catalogue.data.movies).toHaveLength(10);
  expect(catalogue.data.movies.every((movie: { posterUrl: string | null }) => movie.posterUrl)).toBe(true);

  expect((await request.post("/api/auth/register", { data: {
    email: visualEmail, password: visualPassword,
  } })).status()).toBe(201);
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(visualEmail);
  await page.getByLabel("Password", { exact: true }).fill(visualPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/");

  for (const movie of catalogue.data.movies as { id: string }[]) {
    expect((await page.request.put(`/api/me/watchlist/${movie.id}`)).status()).toBe(200);
  }
  await page.goto("/watchlist");
  await expect(page.locator("article.watchlist-card")).toHaveCount(10);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await waitForPosters(page.locator("article.watchlist-card img"));
  await page.evaluate(() => scrollTo(0, 0));
  await capture(page, "watchlist-real-dark-1440");

  const firstTitle = catalogue.data.movies[0].title as string;
  await page.getByRole("link", { name: `View details for ${firstTitle}` }).click();
  await expect(page.getByRole("heading", { name: firstTitle, exact: true })).toBeVisible();
  await waitForPosters(page.locator(".movie-detail__poster img"));
  await capture(page, "detail-real-dark-1440");

  await page.getByRole("link", { name: "Back to watchlist" }).click();
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await page.setViewportSize({ width: 375, height: 900 });
  await expect(page.locator("article.watchlist-card")).toHaveCount(10);
  await waitForPosters(page.locator("article.watchlist-card img").first());
  await page.evaluate(() => scrollTo(0, 0));
  await capture(page, "watchlist-real-light-375", false);
});
