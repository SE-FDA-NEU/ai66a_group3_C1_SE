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
async function settlePublicPosters(page: Page) {
  // Full-page screenshots must not capture lazy images before the browser has
  // scrolled them into view. Do not replace images or fabricate loaded states.
  for (const poster of await page.locator("article.movie-card img").all())
    await poster.scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator("article.movie-card img").evaluateAll(images =>
    images.every(img => (img as HTMLImageElement).complete)), { timeout: 30_000 }).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
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
  await expect(page).toHaveURL("/");
  await page.getByRole("link", { name: "Start", exact: true }).click();
  await expect(page).toHaveURL(/\/preferences$/);
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

test("Home hero and navbar leave personalisation entirely user initiated", async ({ page, request }) => {
  test.skip(live, "Synthetic authentication is isolated from the imported catalogue");
  const email = `home-${crypto.randomUUID()}@example.test`;
  const password = "home-synthetic-only";
  expect((await request.post("/api/auth/register", { data: { email, password } })).status()).toBe(201);
  const personalRequests: string[] = [];
  page.on("request", r => {
    if (new URL(r.url()).pathname.startsWith("/api/me/")) personalRequests.push(`${r.method()} ${new URL(r.url()).pathname}`);
  });
  await page.goto("/");
  await expect(page.locator("article.movie-card").first()).toBeVisible();
  await expect(page.getByText(/Choose Start to pick up to 5/)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "My recommendations", exact: true })).toHaveCount(1);
  await screenshot(page, "t01-home-followup-dark-fixture");
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await screenshot(page, "t01-home-followup-light-fixture");
  await page.setViewportSize({ width: 375, height: 900 });
  await noOverflow(page);
  await page.getByRole("link", { name: "Explore Catalogue", exact: true }).click();
  await expect(page).toHaveURL(/#catalogue-shelf$/);
  await expect(page.getByRole("region", { name: "Catalogue results" })).toBeFocused();
  expect(personalRequests).toEqual([]);
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  expect(personalRequests).toEqual([]);
  await noOverflow(page);
  await screenshot(page, "t01-home-followup-mobile-light-fixture");
  await page.getByRole("link", { name: "My recommendations", exact: true }).click();
  await expect(page).toHaveURL(/\/recommendations$/);
  await expect(page.getByText("Not personalised", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "My recommendations", exact: true })).toHaveAttribute("aria-current", "page");
  expect(personalRequests.filter(r => r.startsWith("PUT "))).toEqual([]);
  await page.getByRole("link", { name: "Preferences", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Action", exact: true })).not.toBeChecked();
  await page.getByRole("checkbox", { name: "Action", exact: true }).check();
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.getByText("1 of 5 selected", { exact: true })).toBeVisible();
  await noOverflow(page);
  await screenshot(page, "t01-preferences-followup-mobile-dark-fixture");
  expect(personalRequests.filter(r => r.startsWith("PUT "))).toEqual([]);
  await page.getByRole("button", { name: "Save preferences", exact: true }).click();
  await expect(page).toHaveURL(/\/recommendations$/);
  await expect(page.getByRole("heading", { name: "Recommended for you", exact: true })).toBeVisible();
  expect(personalRequests.filter(r => r === "PUT /api/me/preferences")).toHaveLength(1);
});

test("guest Start survives the registration detour and opens real Preferences after sign-in", async ({ page }) => {
  test.skip(live, "Synthetic registration never writes into the imported developer database");
  const email = `start-${crypto.randomUUID()}@example.test`;
  const password = "start-synthetic-only";
  const privateRequests: string[] = [];
  page.on("request", r => { if (new URL(r.url()).pathname.startsWith("/api/me/")) privateRequests.push(r.url()); });
  await page.goto("/");
  await page.getByRole("link", { name: "Start", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(privateRequests).toEqual([]);
  await page.getByRole("link", { name: "Create an account", exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole("heading", { name: "Create your account", exact: true })).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(privateRequests).toEqual([]);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/preferences$/);
  await expect(page.getByRole("checkbox", { name: "Action", exact: true })).toBeVisible();
  await expect(page.getByText("0 of 5 selected", { exact: true })).toBeVisible();
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

test("reference auth layouts stay concise, responsive and fully functional in both themes", async ({ page }) => {
  test.skip(live, "Layout and synthetic form checks use the isolated fixture");
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ["/login", "/register"]) {
      await page.goto(route);
      for (const theme of ["dark", "light"]) {
        if (await page.locator("html").getAttribute("data-theme") !== theme)
          await page.getByRole("button", { name: `Switch to ${theme} theme` }).click();
        await expect(page.locator(".auth-card")).toBeVisible();
        if (width === 1440) {
          await expect(page.locator(".auth-art")).toBeVisible();
          const art = (await page.locator(".auth-art").boundingBox())!;
          const form = (await page.locator(".auth-card").boundingBox())!;
          expect(form.x).toBeGreaterThanOrEqual(art.x + art.width - 1);
        } else await expect(page.locator(".auth-art")).not.toBeVisible();
        await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
        await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
        expect(await page.locator("main").innerText()).not.toMatch(/99\.4|Google|Apple|Forgot password|Neural engine/);
        await noOverflow(page);
        if (width === 1440 || theme === "light")
          await screenshot(page, `onboarding-${route.slice(1)}-${width}-${theme}-fixture`);
      }
    }
  }
});

test("centered action feedback reflects real login/save/logout acknowledgements without blocking the page", async ({ page, request }) => {
  test.skip(live, "Never creates accounts in the imported developer database");
  const email = `feedback-${crypto.randomUUID()}@example.test`;
  const password = "feedback-synthetic-only";
  expect((await request.post("/api/auth/register", { data: { email, password } })).status()).toBe(201);
  await page.goto("/");
  await page.getByRole("link", { name: "My recommendations", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  const feedback = page.getByTestId("action-feedback");
  await expect(feedback).toContainText("Sign in to continue");
  const box = (await feedback.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(box.y + box.height / 2 - viewport.height / 2)).toBeLessThanOrEqual(1);
  expect(await feedback.evaluate(node => getComputedStyle(node).pointerEvents)).toBe("none");
  await page.keyboard.press("Escape"); await expect(feedback).toHaveCount(0);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Email or password is incorrect");
  await expect(feedback).toContainText("Sign-in not confirmed");
  // Click/fill the real form while the non-modal feedback is still visible.
  await page.getByLabel("Password", { exact: true }).fill(password);
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/auth/login", async route => {
    // Delay dispatch, then send the unchanged real browser request. Using an
    // HTTP replay would lose Chromium's Fetch Metadata and test another client.
    await held; await route.continue();
  });
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  try {
    await expect(feedback).toContainText("Signing you in");
    await expect(feedback).not.toContainText("You're signed in");
    await expect(page.getByRole("button", { name: "Signing in...", exact: true })).toBeDisabled();
  } finally { release(); }
  await expect(page).toHaveURL(/\/recommendations$/);
  await expect(feedback).toContainText("You're signed in");
  await page.getByRole("link", { name: "Preferences", exact: true }).click();
  await page.getByRole("checkbox", { name: "Action", exact: true }).check();
  await page.getByRole("button", { name: "Save preferences", exact: true }).click();
  await expect(feedback).toContainText("Your taste is saved");
  await page.goto(`/movies/${fixtureMovie}`);
  await page.getByRole("radio", { name: "5 stars", exact: true }).check();
  await page.getByRole("button", { name: "Save rating", exact: true }).click();
  await expect(page.getByText("Your saved rating: 5/5", { exact: true })).toBeVisible();
  await expect(feedback).toContainText("Rating saved");
  await screenshot(page, "onboarding-rating-feedback-fixture");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(feedback).toContainText("You're signed out");
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Dismiss notification", exact: true }).click();
  await expect(feedback).toHaveCount(0);
});

test("genre cards expose descriptions, native keyboard state and no implicit writes", async ({ page, request }) => {
  test.skip(live, "Synthetic account and preferences are isolated");
  const email = `genres-${crypto.randomUUID()}@example.test`;
  const password = "genres-synthetic-only";
  expect((await request.post("/api/auth/register", { data: { email, password } })).status()).toBe(201);
  let writes = 0;
  page.on("request", r => { if (r.method() === "PUT" && r.url().includes("/preferences")) writes++; });
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/");
  await page.getByRole("link", { name: "Preferences", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".preferences-slogan")).toHaveText("Tell Us What You Love to Watch");
  const action = page.getByRole("checkbox", { name: "Action", exact: true });
  await action.focus(); await page.keyboard.press("Space");
  await expect(action).toBeChecked();
  await expect(page.getByText("1 of 5 selected", { exact: true })).toBeVisible();
  expect(await action.getAttribute("aria-describedby")).toBeTruthy();
  await expect(page.locator(".genre-option__description").first()).not.toBeEmpty();
  expect(writes).toBe(0);
  await screenshot(page, "onboarding-preferences-1440-dark-fixture");
  await page.setViewportSize({ width: 375, height: 900 });
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await noOverflow(page);
  await screenshot(page, "onboarding-preferences-375-light-fixture");
  expect(writes).toBe(0);
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
  await settlePublicPosters(page);
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
  const popular = await (await page.request.get("/api/movies/popular?limit=10")).json();
  const spotlight = page.getByRole("region", { name: "Most popular movie spotlight" });
  await expect(spotlight.getByRole("heading", { level: 2 })).toHaveText(popular.data.movies[0].title);
  await expect(spotlight.locator("img").last()).toBeVisible();
  await expect.poll(() => spotlight.locator("img").last().evaluate((img: HTMLImageElement) => img.naturalWidth), { timeout: 30_000 }).toBeGreaterThan(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await settlePublicPosters(page);
  await screenshot(page, "onboarding-popular-1440-dark-imported");
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await screenshot(page, "onboarding-popular-1440-light-imported");
  await page.setViewportSize({ width: 375, height: 900 });
  await screenshot(page, "onboarding-popular-375-light-imported");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator("article.movie-card").first()).toBeVisible();
  await expect(spotlight).toHaveCount(0);
  await noOverflow(page);
  expect(errors).toEqual([]);
});
