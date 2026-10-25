import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const movieId = "20000000-0000-0000-0000-000000000001";
const controls = "http://127.0.0.1:8014/__acceptance";

async function signIn(page: import("@playwright/test").Page, email: string, destination = "/") {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Synthetic-t12-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(destination);
}

async function screenshot(page: import("@playwright/test").Page, name: string) {
  const directory = process.env.T12_SCREENSHOT_DIR;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: path.join(directory, `${name}.png`), fullPage: true });
}

test.beforeEach(async ({ request }) => {
  expect((await request.post(`${controls}/scenario/ranked`)).ok()).toBe(true);
});

test("detail add, reload, account separation, return context and removal", async ({ page, request }) => {
  const a = `t12-a-${crypto.randomUUID()}@example.test`;
  const b = `t12-b-${crypto.randomUUID()}@example.test`;
  for (const email of [a, b])
    expect((await request.post("/api/auth/register", { data: {
      email, password: "Synthetic-t12-password",
    } })).status()).toBe(201);

  await page.goto(`/movies/${movieId}`);
  await expect(page.getByRole("link", { name: "Sign in to save this movie" })).toBeVisible();
  await screenshot(page, "detail-guest-dark-1440");
  const guestWatchlistReads: string[] = [];
  page.on("request", request => {
    if (request.method() === "GET" && new URL(request.url()).pathname.startsWith("/api/me/watchlist"))
      guestWatchlistReads.push(request.url());
  });
  await page.goto("/watchlist");
  await expect(page).toHaveURL(/\/login$/);
  expect(guestWatchlistReads).toEqual([]);
  await signIn(page, a, "/watchlist");
  await page.goto(`/movies/${movieId}`);
  await expect(page.getByText("Not in your watchlist")).toBeVisible();
  await page.getByRole("button", { name: "Add to watchlist" }).click();
  await expect(page.getByText("Saved to your watchlist")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Saved to your watchlist")).toBeVisible();
  await screenshot(page, "detail-saved-dark-1440");
  await page.getByRole("link", { name: "View watchlist" }).click();
  await expect(page).toHaveURL("/watchlist");
  await expect(page.locator("article.watchlist-card")).toHaveCount(1);
  await page.getByRole("link", { name: "View details for A" }).click();
  await expect(page.getByRole("link", { name: "Back to watchlist" })).toBeVisible();
  await page.getByRole("link", { name: "Back to watchlist" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page, b);
  await page.goto("/watchlist");
  await expect(page.getByText("No saved movies yet")).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page, a);
  await page.goto("/watchlist");
  await expect(page.locator("article.watchlist-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Remove A from watchlist" }).click();
  await expect(page.getByText("No saved movies yet")).toBeVisible();
  await screenshot(page, "watchlist-empty-dark-1440");
  await page.reload();
  await expect(page.getByText("No saved movies yet")).toBeVisible();
});

test("saved list remains usable at mobile, tablet and desktop in both themes", async ({ page, request }) => {
  const email = `t12-visual-${crypto.randomUUID()}@example.test`;
  expect((await request.post("/api/auth/register", { data: {
    email, password: "Synthetic-t12-password",
  } })).status()).toBe(201);
  await signIn(page, email);
  await expect(page.locator("article.movie-card")).toHaveCount(10);
  const catalogue = await (await page.request.get("/api/movies?limit=10")).json();
  const second = await (await page.request.get("/api/movies?limit=10&page=2")).json();
  const ids = [...catalogue.data.movies, ...second.data.movies].slice(0, 11)
    .map((movie: { id: string }) => movie.id);
  for (const [index, id] of ids.entries()) {
    const result = await page.request.put(`/api/me/watchlist/${id}`);
    expect(result.status(), `save ${index + 1}: ${await result.text()}`).toBe(200);
  }
  for (const theme of ["dark", "light"]) for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/watchlist?page=2");
    await expect(page.locator("article.watchlist-card")).toHaveCount(1);
    if (await page.locator("html").getAttribute("data-theme") !== theme)
      await page.getByRole("button", { name: `Switch to ${theme} theme` }).click();
    await expect(page.getByRole("button", { name: "Previous" })).toBeEnabled();
    const remove = page.locator("article.watchlist-card button");
    await remove.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(remove).toBeFocused();
    expect(await remove.evaluate(node => getComputedStyle(node).outlineStyle)).not.toBe("none");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await screenshot(page, `watchlist-${theme}-${width}`);
  }
  await page.goto("/watchlist?page=1");
  await expect(page.locator("article.watchlist-card")).toHaveCount(10);
  await screenshot(page, "watchlist-grid-light-1440");
  await page.route("**/api/me/watchlist?page=1*", route => route.abort());
  await page.reload();
  await expect(page.getByRole("heading", { name: "Watchlist unavailable" })).toBeVisible();
  await screenshot(page, "watchlist-error-light-1440");
  await page.unroute("**/api/me/watchlist?page=1*");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.locator("article.watchlist-card")).toHaveCount(10);
  await page.goto("/watchlist?page=2");
  await expect(page.locator("article.watchlist-card")).toHaveCount(1);
  await page.locator("article.watchlist-card button").click();
  await expect(page).toHaveURL(/\/watchlist\?page=1/);
  await expect(page.locator("article.watchlist-card")).toHaveCount(10);
});
