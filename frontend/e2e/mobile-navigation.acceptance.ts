import { test, expect, type Page } from "@playwright/test";

const movieId = "20000000-0000-0000-0000-000000000001";
const controls = "http://127.0.0.1:8014/__acceptance";
async function menu(page: Page) {
  await page.getByRole("button", { name: "Open navigation" }).click();
  return page.getByRole("dialog", { name: "Explore movies" });
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}
test.beforeEach(async ({ page, request }) => {
  expect((await request.post(`${controls}/scenario/ranked`)).ok()).toBe(true);
  // Offline, isolated fixtures: this verifies honest image fallbacks too.
  await page.route("https://image.tmdb.org/**", route => route.abort());
});

test("mobile drawer contains focus, closes safely and preserves guest protected-route navigation", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(page.locator("article.movie-card").first()).toBeVisible();
  expect((await page.getByRole("banner").boundingBox())!.height).toBeLessThanOrEqual(76);
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);
  let panel = await menu(page);
  const close = panel.getByRole("button", { name: "Close navigation" });
  await expect(close).toBeFocused();
  expect(await page.locator("#root").evaluate(root => (root as HTMLElement).inert)).toBe(true);
  await page.keyboard.press("Shift+Tab");
  await expect(panel.getByRole("link", { name: "Create account", exact: true })).toBeFocused();
  await page.keyboard.press("Tab"); await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeFocused();
  expect(await page.locator("#root").evaluate(root => (root as HTMLElement).inert)).toBe(false);
  await menu(page);
  await page.locator(".navigation-backdrop").click({ position: { x: 370, y: 200 } });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  panel = await menu(page);
  await panel.getByRole("link", { name: "Preferences", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await noOverflow(page);
});

test("mobile and desktop layouts work across themes with real isolated session and account APIs", async ({ page, request }, info) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const email = `mobile-long-account-${crypto.randomUUID()}@example.test`;
  const password = "mobile-synthetic-only";
  expect((await request.post("/api/auth/register", { data: { email, password } })).status()).toBe(201);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/");
  await page.keyboard.press("Escape");
  await expect(await menu(page)).toContainText(email);
  await page.keyboard.press("Escape");
  const paths = ["/", "/popular", "/search", "/preferences", "/recommendations", "/watchlist", "/profile", `/movies/${movieId}`];
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["light", "dark"]) {
      for (const path of paths) {
        await page.goto(path);
        await expect(page.locator("#main-content h1").first()).toBeVisible();
        await expect(page.getByText("Loading movies...", { exact: true })).toHaveCount(0);
        if (await page.locator("html").getAttribute("data-theme") !== theme)
          await page.getByRole("button", { name: `Switch to ${theme} theme` }).click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await noOverflow(page);
        if (width <= 1100) {
          expect((await page.getByRole("banner").boundingBox())!.height).toBeLessThanOrEqual(76);
          const panel = await menu(page);
          await expect(panel).toContainText(email);
          await expect(panel.getByRole("link", { name: "Profile", exact: true })).toBeVisible();
          await noOverflow(page);
          if (path === "/" && width === 375) await page.screenshot({ path: info.outputPath(`drawer-${theme}-fixture.png`) });
          await page.keyboard.press("Escape");
        } else {
          await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
          await expect(page.getByRole("button", { name: "Open navigation" })).toHaveCount(0);
        }
        if (width === 375 || (width === 1440 && path === "/"))
          await page.screenshot({ path: info.outputPath(`${path.replace(/\W/g, "") || "home"}-${width}-${theme}-fixture.png`), fullPage: true });
      }
    }
  }
  await page.setViewportSize({ width: 375, height: 420 });
  await page.goto("/popular");
  const panel = await menu(page);
  await panel.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(await menu(page)).not.toContainText(email);
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("resizing an open drawer restores desktop controls and does not leave scrolling locked", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 }); await page.goto("/");
  await menu(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.locator("#root").evaluate(root => (root as HTMLElement).inert)).toBe(false);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 900 });
  await expect(page.getByRole("button", { name: "Open navigation" })).toHaveAttribute("aria-expanded", "false");
});
