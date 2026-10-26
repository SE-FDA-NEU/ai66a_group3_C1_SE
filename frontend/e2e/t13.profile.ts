import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const password = "Synthetic-t13-password";
const success = "Your personalisation profile was reset.";
const backendError = { error: { code: "SERVICE_UNAVAILABLE", message: "Service is temporarily unavailable", requestId: "req_t13" } };

async function account(request: APIRequestContext, name: string) {
  const email = `t13-${name}-${crypto.randomUUID()}@example.test`;
  expect((await request.post("/api/auth/register", { data: { email, password } })).status()).toBe(201);
  return email;
}
async function signIn(page: Page, email: string, destination = "/") {
  await page.goto("/");
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(destination);
}
async function seed(page: Page, genres = 3, ratings = 2, saved = 2) {
  const genreBody = await (await page.request.get("/api/genres")).json();
  expect((await page.request.put("/api/me/preferences", { data: {
    genreIds: genreBody.data.genres.slice(0, genres).map((genre: { id: number }) => genre.id),
  } })).status()).toBe(200);
  const movies = (await (await page.request.get("/api/movies?limit=10")).json()).data.movies;
  for (let i = 0; i < ratings; i++) expect((await page.request.put(`/api/me/ratings/${movies[i].id}`,
    { data: { rating: 5 - i } })).status()).toBe(200);
  for (let i = 0; i < saved; i++) expect((await page.request.put(`/api/me/watchlist/${movies[i].id}`)).status()).toBe(200);
}
async function openProfile(page: Page) {
  await page.getByRole("link", { name: "Profile", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your profile", exact: true })).toBeVisible();
  await expect(page.getByTestId("profile-genres-count")).toBeVisible();
  const notice = page.getByRole("button", { name: "Dismiss notification" });
  if (await notice.isVisible()) await notice.click();
}
async function screenshot(page: Page, name: string) {
  if (!process.env.T13_SCREENSHOT_DIR) return;
  await mkdir(process.env.T13_SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(process.env.T13_SCREENSHOT_DIR, `${name}.png`), fullPage: !name.includes("confirm-") });
}
async function confirm(page: Page) {
  await page.getByRole("button", { name: "Reset personalisation", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Reset personalisation", exact: true }).click();
}

test.beforeEach(async ({ request }) => {
  expect((await request.post("http://127.0.0.1:8014/__acceptance/scenario/ranked")).ok()).toBe(true);
});

test("real reset, cancel, persistence, A/B ownership and preserved watchlists", async ({ page, request }) => {
  const a = await account(request, "a"), b = await account(request, "b");
  await signIn(page, b);
  await seed(page, 1, 1, 1);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
  await signIn(page, a);
  await seed(page);
  await openProfile(page);
  await expect(page.getByTestId("profile-genres-count")).toHaveText("3");
  await expect(page.getByTestId("profile-ratings-count")).toHaveText("2");
  let posts = 0;
  page.on("request", request => { if (request.method() === "POST" && request.url().endsWith("/api/me/profile/reset")) posts++; });
  const trigger = page.getByRole("button", { name: "Reset personalisation", exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Reset personalisation", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await screenshot(page, "profile-confirm-dark-1440");
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  expect(posts).toBe(0);
  await page.reload();
  await expect(page.getByTestId("profile-genres-count")).toHaveText("3");
  await confirm(page);
  await expect(page.locator(".profile-reset").getByText(success, { exact: true })).toBeVisible();
  await expect(page.getByTestId("profile-genres-count")).toHaveText("0");
  await expect(page.getByTestId("profile-ratings-count")).toHaveText("0");
  await expect(page.getByTestId("profile-watchlist-count")).toHaveText("2");
  expect(posts).toBe(1);
  await screenshot(page, "profile-success-dark-1440");
  await page.getByRole("link", { name: "View watchlist" }).click();
  await expect(page.locator("article.watchlist-card")).toHaveCount(2);
  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page, b);
  await openProfile(page);
  await expect(page.getByTestId("profile-genres-count")).toHaveText("1");
  await expect(page.getByTestId("profile-ratings-count")).toHaveText("1");
  await expect(page.getByTestId("profile-watchlist-count")).toHaveText("1");
  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page, a);
  await openProfile(page);
  await expect(page.getByTestId("profile-ratings-count")).toHaveText("0");
  await page.reload();
  await expect(page.getByTestId("profile-genres-count")).toHaveText("0");
});

test("both themes, responsive keyboard controls and real page visuals", async ({ page, request }) => {
  await signIn(page, await account(request, "visual"));
  await seed(page);
  await openProfile(page);
  for (const theme of ["dark", "light"]) for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    if (await page.locator("html").getAttribute("data-theme") !== theme)
      await page.getByRole("button", { name: `Switch to ${theme} theme` }).click();
    await expect(page.getByTestId("profile-genres-count")).toHaveText("3");
    await expect(page.getByTestId("profile-ratings-count")).toHaveText("2");
    if (width === 1440) {
      const ratios = await page.evaluate(() => {
        const style = getComputedStyle(document.documentElement);
        const color = (value: string) => value.startsWith("--") ? style.getPropertyValue(value).trim() : value;
        const luminance = (value: string) => {
          let hex = color(value).replace("#", "");
          if (hex.length === 3) hex = hex.split("").map(c => c + c).join("");
          const channels = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
            .map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
          return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
        };
        return Object.fromEntries([
          ["text", "--text", "--surface"], ["muted", "--muted", "--surface"],
          ["error", "--error", "--surface-raised"], ["success", "--success", "--surface-raised"],
          ["button", "#ffffff", "--primary"],
        ].map(([name, foreground, background]) => {
          const a = luminance(foreground), b = luminance(background);
          return [name, (Math.max(a, b) + .05) / (Math.min(a, b) + .05)];
        }));
      });
      for (const [name, ratio] of Object.entries(ratios)) expect(ratio, `${theme} ${name} text contrast`).toBeGreaterThanOrEqual(4.5);
      test.info().annotations.push({ type: "contrast", description: `${theme}: ${JSON.stringify(ratios)}` });
    }
    const reset = page.getByRole("button", { name: "Reset personalisation", exact: true });
    await reset.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    expect(await reset.evaluate(node => getComputedStyle(node).outlineStyle)).not.toBe("none");
    const size = await reset.boundingBox();
    expect(size!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await screenshot(page, `profile-${theme}-${width}`);
    await reset.click();
    await expect(page.getByRole("dialog").getByRole("button", { name: "Cancel" })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    if (width === 375) await screenshot(page, `profile-confirm-${theme}-375`);
    await page.keyboard.press("Escape");
    await expect(reset).toBeFocused();
  }
});

test("explicit rejection and ambiguous committed response require truthful recovery", async ({ page, request }) => {
  await signIn(page, await account(request, "recovery"));
  await seed(page);
  await openProfile(page);
  await page.route("**/api/me/profile/reset", route => route.fulfill({ status: 503, json: backendError }));
  await confirm(page);
  await expect(page.getByText(/Your displayed profile has not been cleared/)).toBeVisible();
  await expect(page.getByTestId("profile-ratings-count")).toHaveText("2");
  await screenshot(page, "profile-rollback-dark-1440");
  await page.unroute("**/api/me/profile/reset");
  let posts = 0, failRead = true;
  await page.route("**/api/me/profile/reset", async route => {
    posts++;
    // Playwright's API transport omits browser Fetch Metadata; preserve this
    // real same-origin browser write while forwarding it to the test backend.
    const response = await route.fetch({ headers: { ...route.request().headers(), "sec-fetch-site": "same-origin" } });
    expect(response.status()).toBe(200); // the real database committed before the response is lost
    await route.abort();
  });
  await page.route("**/api/me/profile", route => failRead ? route.fulfill({ status: 503, json: backendError }) : route.continue());
  await confirm(page);
  await expect(page.getByRole("button", { name: "Check current profile" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reset personalisation", exact: true })).toBeDisabled();
  await expect(page.getByText(success, { exact: true })).toHaveCount(0);
  await screenshot(page, "profile-unconfirmed-dark-1440");
  failRead = false;
  await page.getByRole("button", { name: "Check current profile" }).click();
  await expect(page.getByText(/summary shows your current server data/)).toBeVisible();
  await expect(page.getByTestId("profile-ratings-count")).toHaveText("0");
  await expect(page.getByTestId("profile-watchlist-count")).toHaveText("2");
  expect(posts).toBe(1);
  await expect(page.getByText(success, { exact: true })).toHaveCount(0);
  await screenshot(page, "profile-reconciled-dark-1440");
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await page.setViewportSize({ width: 375, height: 1000 });
  await screenshot(page, "profile-reconciled-light-375");
});

test("signed-out access restores Profile intent and expired sessions use the existing guard", async ({ page, request }) => {
  const email = await account(request, "guard");
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/profile");
  await expect(page.getByText("No saved genres yet.")).toBeVisible();
  await page.route("**/api/me/profile", route => route.fulfill({ status: 401, json: {
    error: { code: "AUTHENTICATION_REQUIRED", message: "Authentication required", requestId: "req_expired" },
  } }));
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page.getByRole("link", { name: "Profile", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});
