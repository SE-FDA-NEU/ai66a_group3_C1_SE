import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { mkdir } from "node:fs/promises";

const live = Boolean(process.env.T01_LIVE_URL);
const fixtureMovie = "20000000-0000-0000-0000-000000000001";
const controls = "http://127.0.0.1:8014/__acceptance";
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}
function contrast(a: string, b: string) {
  const luminance = (hex: string) => {
    const full = hex.length === 4 ? "#" + [...hex.slice(1)].map(c => c + c).join("") : hex;
    const rgb = full.match(/\w\w/g)!.map(part => parseInt(part, 16) / 255)
      .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  };
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + .05) / (dark + .05);
}
async function screenshot(page: Page, name: string) {
  const directory = process.env.T01_SCREENSHOT_DIR;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: path.join(directory, `${name}.png`), fullPage: true });
}

test.beforeEach(async ({ page, request }) => {
  if (live) return;
  expect((await request.post(`${controls}/scenario/ranked`)).ok()).toBe(true);
  // Deterministic offline image failure checks, not fabricated TMDb screenshots.
  await page.route("https://image.tmdb.org/**", route => route.abort());
});

test("existing public pages, both themes and 375/768/1440 layouts", async ({ page }) => {
  test.skip(live, "Fixture regression is separate from imported-catalogue smoke");
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    for (const route of ["/", "/popular", "/login", "/register", "/about-recommendations"]) {
      await page.goto(route);
      await expect(page.locator("h1")).toBeVisible();
      for (const theme of ["dark", "light"]) {
        if (await page.locator("html").getAttribute("data-theme") !== theme)
          await page.getByRole("button", { name: `Switch to ${theme} theme` }).click();
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const tokens = await page.evaluate(() => {
          const css = getComputedStyle(document.documentElement);
          return Object.fromEntries(["--text", "--muted", "--surface", "--page-bg", "--accent", "--primary", "--error", "--error-bg", "--control-border"]
            .map(key => [key, css.getPropertyValue(key).trim()]));
        });
        for (const fg of ["--text", "--muted", "--accent"])
          for (const bg of ["--surface", "--page-bg"])
            expect(contrast(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(4.5);
        expect(contrast("#ffffff", tokens["--primary"])).toBeGreaterThanOrEqual(4.5);
        expect(contrast(tokens["--error"], tokens["--error-bg"])).toBeGreaterThanOrEqual(4.5);
        expect(contrast(tokens["--control-border"], tokens["--page-bg"])).toBeGreaterThanOrEqual(3);
        await noOverflow(page);
      }
    }
  }
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
});

test("native star keyboard draft, save and theme preserve real state", async ({ page, request }) => {
  test.skip(live, "Synthetic accounts never write to an imported developer database");
  const email = `t01-${crypto.randomUUID()}@example.test`;
  const password = "t01-synthetic-only";
  expect((await request.post("/api/auth/register", { data: { email, password } })).status()).toBe(201);
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/recommendations/);
  await page.getByRole("link", { name: "Change my genres", exact: true }).click();
  await page.getByRole("checkbox", { name: "Action", exact: true }).check();
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(page.getByRole("checkbox", { name: "Action", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Save preferences", exact: true }).click();
  await expect(page).toHaveURL(/\/recommendations/);
  // Synthetic fixture IDs are intentionally not TMDb genre IDs (Action=8101).
  await page.getByRole("combobox", { name: "Filter by genre", exact: true }).selectOption({ label: "Action" });
  await expect(page).toHaveURL(/genreId=8101/);
  const filteredUrl = page.url();
  await expect(page.locator("article.movie-card").first()).toBeVisible();
  const filteredTitles = await page.locator("article.movie-card h2").allTextContents();
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  expect(page.url()).toBe(filteredUrl);
  expect(await page.locator("article.movie-card h2").allTextContents()).toEqual(filteredTitles);
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await page.goto(`/movies/${fixtureMovie}`);
  await expect(page.getByRole("radio")).toHaveCount(5);
  let writes = 0;
  page.on("request", r => { if (r.method() === "PUT" && r.url().includes("/rating")) writes++; });
  const three = page.getByRole("radio", { name: "3 stars", exact: true });
  await three.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: "4 stars", exact: true })).toBeChecked();
  expect(writes).toBe(0);
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.getByRole("radio", { name: "4 stars", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Save rating", exact: true }).click();
  await expect(page.getByText("Your saved rating: 4/5", { exact: true })).toBeVisible();
  expect(writes).toBe(1);
  await screenshot(page, "t01-rating-dark-fixture");
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    await noOverflow(page);
  }
  await page.reload();
  await expect(page.getByText("Your saved rating: 4/5", { exact: true })).toBeVisible();
});

test("theme toggle preserves a real paginated URL and its ordered results", async ({ page }) => {
  test.skip(live, "Fixture pagination regression");
  await page.goto("/");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  const expected = await (await page.request.get("/api/movies?page=2")).json();
  expect(expected.data.movies.length).toBeGreaterThan(0);
  await expect(page.locator("article.movie-card")).toHaveCount(expected.data.movies.length);
  const before = await page.locator("article.movie-card h2").allTextContents();
  const url = page.url();
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  expect(page.url()).toBe(url);
  expect(await page.locator("article.movie-card h2").allTextContents()).toEqual(before);
});

test("blocked browser storage still renders and switches theme", async ({ browser }) => {
  test.skip(live, "Deterministic browser failure regression");
  const context = await browser.newContext();
  await context.addInitScript(() => {
    Object.defineProperty(Storage.prototype, "getItem", { value() { throw new Error("blocked"); } });
    Object.defineProperty(Storage.prototype, "setItem", { value() { throw new Error("blocked"); } });
  });
  const page = await context.newPage();
  try {
    await page.goto("http://127.0.0.1:5174/login");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: "Switch to light theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  } finally { await context.close(); }
});

test("read-only imported TMDb catalogue screenshots, real poster loading and themes", async ({ page }) => {
  test.skip(!live, "Requires an explicitly provided, separately running imported-DB preview");
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("requestfailed", request => {
    if (request.url().startsWith("https://image.tmdb.org/"))
      console.log(`image request failed: ${request.failure()?.errorText}`);
  });
  await page.goto("/");
  await expect(page.locator("article.movie-card").first()).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const firstPoster = page.locator("article.movie-card img").first();
  await expect(firstPoster).toBeVisible();
  await expect.poll(() => firstPoster.evaluate((img: HTMLImageElement) => img.naturalWidth), { timeout: 30_000 }).toBeGreaterThan(0);
  await screenshot(page, "t01-home-dark");
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await screenshot(page, "t01-home-light");
  await page.locator('article.movie-card a[href^="/movies/"]').first().click();
  await expect(page.locator(".movie-detail__poster img")).toBeVisible();
  await screenshot(page, "t01-details-light");
  await page.setViewportSize({ width: 375, height: 900 });
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await noOverflow(page);
  await screenshot(page, "t01-details-mobile-dark");
  await page.goto("/popular");
  await noOverflow(page);
  expect(errors).toEqual([]);
});
