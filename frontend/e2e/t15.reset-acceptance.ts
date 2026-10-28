import { test, expect, type Page, type APIRequestContext, type Route } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

// S4-T15 #210: independent browser acceptance for Story #33 (full reset).
// Fixture: scenario "ranked" (movies 1..12, genres Action 8101, Comedy 8102, Archive 8103).
const password = "Synthetic-t15-password";
const origin = "http://127.0.0.1:5174";
const success = "Your personalisation profile was reset.";
const ACTION = 8101, COMEDY = 8102, ARCHIVE = 8103;
const id = (n: number) => `20000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const rejection = { error: { code: "SERVICE_UNAVAILABLE", message: "Service is temporarily unavailable", requestId: "req_t15" } };
type Ranked = { id: string; popularityScore: number; ratingAdjustment: number; adjustedScore: number; basis: string };
type Taste = { genres: number[]; ratings: [number, number][]; saved: number[] };
// A: 3 genres / 2 ratings / 2 watchlist rows. B: 1 / 1 / 1, with a different list.
const A: Taste = { genres: [ACTION, COMEDY, ARCHIVE], ratings: [[1, 5], [2, 4]], saved: [1, 2] };
const B: Taste = { genres: [COMEDY], ratings: [[3, 3]], saved: [3] };

async function account(request: APIRequestContext, name: string) {
  const email = `t15-${name}-${crypto.randomUUID()}@example.test`;
  expect((await request.post("/api/auth/register", { data: { email, password } })).status()).toBe(201);
  return email;
}
async function signIn(page: Page, email: string) {
  await page.goto("/");
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
  await expect(page.getByRole("banner")).toContainText(email);
}
async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
}
async function seed(api: APIRequestContext, taste: Taste) {
  expect((await api.put("/api/me/preferences", { data: { genreIds: taste.genres } })).status()).toBe(200);
  for (const [movie, rating] of taste.ratings)
    expect((await api.put(`/api/me/ratings/${id(movie)}`, { data: { rating } })).status()).toBe(200);
  for (const movie of taste.saved) expect((await api.put(`/api/me/watchlist/${id(movie)}`)).status()).toBe(200);
}
// Committed server state as the account itself reads it, never what the page claims.
async function server(api: APIRequestContext, ratedMovies: number[] = []) {
  const read = async (url: string) => (await (await api.get(url)).json());
  const profile = (await read("/api/me/profile")).data;
  const watchlist = (await read("/api/me/watchlist?limit=10")).data.movies.map((m: { id: string }) => m.id).sort();
  const ratings: Record<number, number | null> = {};
  for (const movie of ratedMovies) ratings[movie] = (await read(`/api/me/ratings/${id(movie)}`)).data.rating;
  const preferences = (await read("/api/me/preferences")).data.genres.map((g: { id: number }) => g.id).sort();
  return { profile, watchlist, ratings, preferences };
}
async function setTheme(page: Page, theme: "dark" | "light") {
  if (await page.locator("html").getAttribute("data-theme") !== theme)
    await page.getByRole("button", { name: `Switch to ${theme} theme` }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}
async function openProfile(page: Page) {
  await page.getByRole("link", { name: "Profile", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your profile", exact: true })).toBeVisible();
  await expect(page.getByTestId("profile-genres-count")).toBeVisible();
  const notice = page.getByRole("button", { name: "Dismiss notification" });
  if (await notice.isVisible()) await notice.click();
}
async function counts(page: Page, genres: number, ratings: number, saved: number) {
  await expect(page.getByTestId("profile-genres-count")).toHaveText(String(genres));
  await expect(page.getByTestId("profile-ratings-count")).toHaveText(String(ratings));
  await expect(page.getByTestId("profile-watchlist-count")).toHaveText(String(saved));
}
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
const resetButton = (page: Page) => page.getByRole("button", { name: "Reset personalisation", exact: true });
const dialogOf = (page: Page) => page.getByRole("dialog");
async function confirmWithClicks(page: Page) {
  await resetButton(page).click();
  await dialogOf(page).getByRole("button", { name: "Reset personalisation", exact: true }).click();
}
// Playwright's own transport omits Fetch Metadata; a browser write forwarded to
// the real backend keeps the browser's same-origin semantics.
const forward = (route: Route) => route.fetch({ headers: { ...route.request().headers(), "sec-fetch-site": "same-origin" } });
async function shot(page: Page, name: string) {
  if (!process.env.T15_SCREENSHOT_DIR) return;
  await mkdir(process.env.T15_SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(process.env.T15_SCREENSHOT_DIR, `${name}.png`), fullPage: !name.includes("confirm") });
}
function countResetPosts(page: Page) {
  const seen = { posts: 0 };
  page.on("request", r => { if (r.method() === "POST" && new URL(r.url()).pathname === "/api/me/profile/reset") seen.posts++; });
  return seen;
}

// Holds EVERY request to `url` made while holding (React StrictMode may send a duplicate on
// mount, so holding only the first one would not be deterministic). Each held request keeps its
// real body, fetched before any later write, and is delivered on release(). stopHolding() lets
// later requests through. settled() reports how every late reply ended: "delivered", or
// "abandoned" if the browser had already dropped it. Any other error is rethrown.
async function holdRequests(page: Page, url: string) {
  let holding = true, held = 0, release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const outcomes: Promise<"delivered" | "abandoned">[] = [];
  await page.route(url, async route => {
    if (!holding) return route.continue();
    held++;
    const outcome = (async () => {
      const snapshot = await route.fetch();
      await gate;
      try { await route.fulfill({ response: snapshot }); return "delivered" as const; }
      catch (error) {
        if (error instanceof Error && /already handled|abort|disposed|closed/i.test(error.message)) return "abandoned" as const;
        throw error;
      }
    })();
    outcomes.push(outcome);
    await outcome.catch(() => undefined); // the test observes the same promise through settled()
  });
  return {
    held: () => held, release, stopHolding: () => { holding = false; },
    settled: async () => (await Promise.all(outcomes)).join(","),
  };
}
// Two animation frames after the late reply: React has had the chance to apply it.
const afterLateReply = (page: Page) => page.evaluate(() => new Promise<void>(resolve =>
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));

test.beforeEach(async ({ request }) => {
  expect((await request.post("http://127.0.0.1:8014/__acceptance/scenario/ranked")).ok()).toBe(true);
});

for (const variant of [{ theme: "dark", width: 1440 }, { theme: "light", width: 375 }] as const) {
  test(`journey ${variant.theme} ${variant.width}px: A3/2 and B1/1, cancel, confirm, later login, B intact`,
    async ({ page, request, browser }) => {
      const a = await account(request, "a"), b = await account(request, "b");
      const bContext = await browser.newContext({ baseURL: origin });
      const bPage = await bContext.newPage();
      try {
        await signIn(bPage, b);
        await seed(bPage.request, B);
        const bBefore = await server(bPage.request, [3]);
        expect(bBefore.profile).toMatchObject({ ratingCount: 1, watchlistCount: 1 });
        expect(bBefore.profile.genres).toHaveLength(1);

        await page.setViewportSize({ width: variant.width, height: 1000 });
        await signIn(page, a);
        await setTheme(page, variant.theme);
        await seed(page.request, A);
        const aBefore = await server(page.request, [1, 2]);
        expect(aBefore.profile).toMatchObject({ ratingCount: 2, watchlistCount: 2 });
        expect(aBefore.profile.genres).toHaveLength(3);
        expect(aBefore.watchlist).toEqual([id(1), id(2)]);
        expect(aBefore.watchlist).not.toContain(id(3));
        await openProfile(page);
        await counts(page, 3, 2, 2);
        const seen = countResetPosts(page);

        // Cancel by button, then by Escape: no request, focus back, nothing changed.
        await resetButton(page).click();
        await dialogOf(page).getByRole("button", { name: "Cancel", exact: true }).click();
        await expect(dialogOf(page)).toHaveCount(0);
        await expect(resetButton(page)).toBeFocused();
        await resetButton(page).focus();
        await page.keyboard.press("Enter");
        await expect(dialogOf(page).getByRole("button", { name: "Cancel" })).toBeFocused();
        await page.keyboard.press("Escape");
        await expect(resetButton(page)).toBeFocused();
        expect(seen.posts).toBe(0);
        expect(await server(page.request, [1, 2])).toEqual(aBefore);
        expect(await server(bPage.request, [3])).toEqual(bBefore);
        await page.reload();
        await counts(page, 3, 2, 2);
        await shot(page, `journey-${variant.theme}-${variant.width}-1-before`);

        // Confirm by keyboard only.
        await resetButton(page).focus();
        await page.keyboard.press("Enter");
        await shot(page, `journey-${variant.theme}-${variant.width}-2-confirm`);
        await page.keyboard.press("Shift+Tab");
        await expect(dialogOf(page).getByRole("button", { name: "Reset personalisation", exact: true })).toBeFocused();
        await page.keyboard.press("Enter");
        await expect(page.locator(".profile-reset").getByText(success, { exact: true })).toBeVisible();
        await counts(page, 0, 0, 2);
        expect(seen.posts).toBe(1);
        await expect(page.getByRole("heading", { name: "Your saved taste" })).toBeFocused();
        expect(await noOverflow(page)).toBe(true);
        await shot(page, `journey-${variant.theme}-${variant.width}-3-after`);

        // Committed state: A is empty except the watchlist; B is exactly as before.
        const aAfter = await server(page.request, [1, 2]);
        expect(aAfter.profile).toEqual({ genres: [], ratingCount: 0, watchlistCount: 2 });
        expect(aAfter.preferences).toEqual([]);
        expect(aAfter.ratings).toEqual({ 1: null, 2: null });
        expect(aAfter.watchlist).toEqual(aBefore.watchlist);
        const recommendations = (await (await page.request.get("/api/me/recommendations?limit=10")).json()).data;
        expect(recommendations).toMatchObject({ mode: "popular", personalised: false, noMatch: false });
        for (const movie of recommendations.movies) expect(movie.reason.matchedGenres).toEqual([]);
        expect(await server(bPage.request, [3])).toEqual(bBefore);

        // Details membership agrees with the list: A's movie saved, B's movie not A's.
        await page.goto(`/movies/${id(1)}`);
        await expect(page.getByText("Saved to your watchlist")).toBeVisible();
        await page.goto(`/movies/${id(3)}`);
        await expect(page.getByText("Not in your watchlist")).toBeVisible();

        // Later login: A still 0/0/2; B can still sign in and still has 1/1/1.
        await signOut(page);
        await signIn(page, a);
        await openProfile(page);
        await counts(page, 0, 0, 2);
        await page.reload();
        await counts(page, 0, 0, 2);
        await page.getByRole("link", { name: "View watchlist" }).click();
        await expect(page.locator("article.watchlist-card")).toHaveCount(2);
        expect(await server(page.request, [1, 2])).toEqual(aAfter);
        await signOut(bPage);
        await signIn(bPage, b);
        await openProfile(bPage);
        await counts(bPage, 1, 1, 1);
        await bPage.goto(`/movies/${id(3)}`);
        await expect(bPage.getByText("Saved to your watchlist")).toBeVisible();
        expect(await server(bPage.request, [3])).toEqual(bBefore);

        // Zero is not permanent: a later intentional save is accepted as new data.
        expect((await page.request.put("/api/me/preferences", { data: { genreIds: [ACTION] } })).status()).toBe(200);
        await page.goto("/profile");
        await counts(page, 1, 0, 2);
      } finally {
        await bContext.close();
      }
    });
}

test("prior rating signals are gone after reset and reselection; cold start is non-personalised", async ({ page, request }) => {
  await signIn(page, await account(request, "signals"));
  const api = page.request;
  const read = async () => (await (await api.get("/api/me/recommendations?limit=10")).json()).data;
  const byId = (data: { movies: Ranked[] }) =>
    Object.fromEntries(data.movies.map(m => [m.id, [m.ratingAdjustment, m.adjustedScore, m.basis]]));
  const select = async () => expect((await api.put("/api/me/preferences", { data: { genreIds: [ACTION, COMEDY] } })).status()).toBe(200);

  await select();
  const baseline = await read();
  expect(baseline).toMatchObject({ mode: "personalised", personalised: true });
  for (const movie of baseline.movies) expect([movie.ratingAdjustment, movie.adjustedScore]).toEqual([0, movie.popularityScore]);
  const baselineScores = byId(baseline);

  // Each related rated movie moves a candidate by +1 (>=4 stars) or -1 (<=2 stars).
  // Comedy movie 7 at 5 stars raises Comedy candidates; Action movie 1 at 1 star lowers Action ones.
  expect((await api.put(`/api/me/ratings/${id(7)}`, { data: { rating: 5 } })).status()).toBe(200);
  expect((await api.put(`/api/me/ratings/${id(1)}`, { data: { rating: 1 } })).status()).toBe(200);
  const rated = await read();
  expect(rated.movies.some((m: Ranked) => m.ratingAdjustment > 0)).toBe(true);
  expect(rated.movies.some((m: Ranked) => m.ratingAdjustment < 0)).toBe(true);
  expect(byId(rated)).not.toEqual(baselineScores);
  await page.goto("/recommendations");
  await expect(page.getByText("Your high ratings of related movies raised this score.").first()).toBeVisible();
  await shot(page, "signals-1-rated-recommendations");

  // Reset through the real UI.
  const seen = countResetPosts(page);
  await openProfile(page);
  await counts(page, 2, 2, 0);
  await confirmWithClicks(page);
  await expect(page.locator(".profile-reset").getByText(success, { exact: true })).toBeVisible();
  await counts(page, 0, 0, 0);
  expect(seen.posts).toBe(1);

  // Actual cold start: popular, not personalised, no match reasons, no rating adjustment.
  const cold = await read();
  expect(cold).toMatchObject({ mode: "popular", personalised: false, noMatch: false });
  for (const movie of cold.movies) {
    expect(movie.reason.matchedGenres).toEqual([]);
    expect(movie.ratingAdjustment ?? 0).toBe(0);
  }
  await page.getByRole("link", { name: "My recommendations", exact: true }).first().click();
  await expect(page.getByText("Not personalised")).toBeVisible();
  await expect(page.getByText("raised this score")).toHaveCount(0);
  await expect(page.getByText("lowered this score")).toHaveCount(0);
  await shot(page, "signals-2-cold-start");

  // Reselecting the same genres brings back the exact baseline: old ratings left no residue.
  await select();
  const reselected = await read();
  expect(reselected).toMatchObject({ mode: "personalised", personalised: true });
  expect(byId(reselected)).toEqual(baselineScores);
  expect(reselected.movies.map((m: Ranked) => m.id)).toEqual(baseline.movies.map((m: Ranked) => m.id));
  for (const movie of [1, 7]) expect((await (await api.get(`/api/me/ratings/${id(movie)}`)).json()).data.rating).toBeNull();
  await page.goto("/recommendations");
  await expect(page.getByText("Your ratings have not changed this score.").first()).toBeVisible();
  await expect(page.getByText("raised this score")).toHaveCount(0);
  await shot(page, "signals-3-reselected");

  // A new rating after reset is accepted as new data.
  expect((await api.put(`/api/me/ratings/${id(7)}`, { data: { rating: 5 } })).status()).toBe(200);
  expect((await read()).movies.some((m: Ranked) => m.ratingAdjustment > 0)).toBe(true);
});

for (const theme of ["dark", "light"] as const) for (const width of [375, 1440]) {
  test(`keyboard order, focus return and dialog fit: ${theme} ${width}px`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: width === 375 ? 740 : 1000 });
    await signIn(page, await account(request, "keys"));
    await setTheme(page, theme);
    await seed(page.request, A);
    await openProfile(page);
    const seen = countResetPosts(page);
    const before = await server(page.request, [1, 2]);

    // Tab order inside the page: summary heading -> three links -> reset control.
    await page.getByRole("heading", { name: "Your saved taste" }).evaluate(node => (node as HTMLElement).focus());
    for (const name of ["Change my genres", "My recommendations", "View watchlist"]) {
      await page.keyboard.press("Tab");
      await expect(page.getByRole("link", { name, exact: true }).last()).toBeFocused();
    }
    await page.keyboard.press("Tab");
    await expect(resetButton(page)).toBeFocused();
    const trigger = await resetButton(page).boundingBox();
    expect(trigger!.height).toBeGreaterThanOrEqual(44);

    // Dialog: safe default focus, Tab trapped in both directions, no overflow.
    await page.keyboard.press("Enter");
    const cancel = dialogOf(page).getByRole("button", { name: "Cancel", exact: true });
    const confirm = dialogOf(page).getByRole("button", { name: "Reset personalisation", exact: true });
    await expect(cancel).toBeFocused();
    for (const control of [confirm, cancel, confirm]) { await page.keyboard.press("Tab"); await expect(control).toBeFocused(); }
    await page.keyboard.press("Shift+Tab");
    await expect(cancel).toBeFocused();
    for (const button of [cancel, confirm]) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const panel = (await dialogOf(page).boundingBox())!;
    expect(panel.x).toBeGreaterThanOrEqual(0);
    expect(panel.x + panel.width).toBeLessThanOrEqual(width + 1);
    expect(panel.y + panel.height).toBeLessThanOrEqual((width === 375 ? 740 : 1000) + 1);
    expect(await noOverflow(page)).toBe(true);
    await shot(page, `keyboard-confirm-${theme}-${width}`);

    // Escape, then Cancel by keyboard: focus returns to the initiating control each time.
    await page.keyboard.press("Escape");
    await expect(resetButton(page)).toBeFocused();
    await page.keyboard.press("Space");
    await expect(cancel).toBeFocused();
    await page.keyboard.press("Space");
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(resetButton(page)).toBeFocused();
    expect(await noOverflow(page)).toBe(true);
    expect(seen.posts).toBe(0);
    expect(await server(page.request, [1, 2])).toEqual(before);
  });
}

test("duplicate submissions are blocked while one reset is pending", async ({ page, request }) => {
  await signIn(page, await account(request, "dup"));
  await seed(page.request, A);
  await openProfile(page);
  let posts = 0, release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/me/profile/reset", async route => {
    posts++;
    await gate;
    await route.fulfill({ response: await forward(route) });
  });
  await resetButton(page).click();
  await dialogOf(page).getByRole("button", { name: "Reset personalisation", exact: true }).dblclick();
  const working = dialogOf(page).getByRole("button", { name: "Working..." });
  await expect(working).toBeDisabled();
  await expect(dialogOf(page).getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await working.dispatchEvent("click");
  await expect(dialogOf(page)).toBeVisible();
  await expect.poll(() => posts).toBe(1);
  await shot(page, "duplicate-pending");
  expect((await server(page.request, [1, 2])).profile).toMatchObject({ ratingCount: 2, watchlistCount: 2 });
  release();
  await expect(page.locator(".profile-reset").getByText(success, { exact: true })).toBeVisible();
  await counts(page, 0, 0, 2);
  expect(posts).toBe(1);
  expect((await server(page.request, [1, 2])).profile).toEqual({ genres: [], ratingCount: 0, watchlistCount: 2 });
});

test("explicit failure, lost-before-commit and lost-after-commit keep truthful status and both watchlists", async ({ page, request, browser }) => {
  const a = await account(request, "fail-a"), b = await account(request, "fail-b");
  const bContext = await browser.newContext({ baseURL: origin });
  const bPage = await bContext.newPage();
  try {
    await signIn(bPage, b);
    await seed(bPage.request, B);
    const bBefore = await server(bPage.request, [3]);
    await signIn(page, a);
    await seed(page.request, A);
    const aBefore = await server(page.request, [1, 2]);
    await openProfile(page);
    await counts(page, 3, 2, 2);
    const bothUnchanged = async () => {
      expect(await server(page.request, [1, 2])).toEqual(aBefore);
      expect(await server(bPage.request, [3])).toEqual(bBefore);
    };

    // 1. Documented backend rejection: nothing cleared, a new attempt is possible.
    await page.route("**/api/me/profile/reset", route => route.fulfill({ status: 503, json: rejection }));
    await confirmWithClicks(page);
    await expect(page.getByText(/Your displayed profile has not been cleared/)).toBeVisible();
    await expect(page.getByText(success, { exact: true })).toHaveCount(0);
    await counts(page, 3, 2, 2);
    await expect(resetButton(page)).toBeEnabled();
    await bothUnchanged();
    await shot(page, "failure-1-rejected");
    await page.unroute("**/api/me/profile/reset");

    // 2. Response lost BEFORE the server saw it: reconciliation shows unchanged data
    //    without claiming success, and no POST is repeated automatically.
    let posts = 0;
    await page.route("**/api/me/profile/reset", route => { posts++; return route.abort(); });
    await confirmWithClicks(page);
    await expect(page.getByText(/summary shows your current server data/)).toBeVisible();
    await expect(page.getByText(success, { exact: true })).toHaveCount(0);
    await counts(page, 3, 2, 2);
    expect(posts).toBe(1);
    await bothUnchanged();
    await shot(page, "failure-2-lost-before-commit");
    await page.unroute("**/api/me/profile/reset");

    // 3. Response lost AFTER the real commit, and the first reconciliation read fails too:
    //    reset is blocked, nothing is claimed; a later read shows real data and both lists survive.
    posts = 0;
    let failRead = true;
    await page.route("**/api/me/profile/reset", async route => {
      posts++;
      expect((await forward(route)).status()).toBe(200);
      await route.abort();
    });
    await page.route("**/api/me/profile", route => failRead ? route.fulfill({ status: 503, json: rejection }) : route.continue());
    await confirmWithClicks(page);
    await expect(page.getByRole("button", { name: "Check current profile" })).toBeVisible();
    await expect(resetButton(page)).toBeDisabled();
    await expect(page.getByText(success, { exact: true })).toHaveCount(0);
    await shot(page, "failure-3-unconfirmed");
    failRead = false;
    await page.getByRole("button", { name: "Check current profile" }).click();
    await expect(page.getByText(/summary shows your current server data/)).toBeVisible();
    await counts(page, 0, 0, 2);
    await expect(page.getByText(success, { exact: true })).toHaveCount(0);
    expect(posts).toBe(1);
    expect(await server(page.request, [1, 2])).toEqual({
      profile: { genres: [], ratingCount: 0, watchlistCount: 2 }, watchlist: aBefore.watchlist,
      ratings: { 1: null, 2: null }, preferences: [],
    });
    expect(await server(bPage.request, [3])).toEqual(bBefore);
    await shot(page, "failure-3-reconciled");
    await page.getByRole("link", { name: "View watchlist" }).click();
    await expect(page.locator("article.watchlist-card")).toHaveCount(2);
  } finally {
    await bContext.close();
  }
});

test("reset stays blocked while the profile read is unfinished", async ({ page, request }) => {
  await signIn(page, await account(request, "blocked"));
  await seed(page.request, A);
  const read = await holdRequests(page, "**/api/me/profile");
  const seen = countResetPosts(page);
  await page.getByRole("link", { name: "Profile", exact: true }).click();
  await expect.poll(read.held).toBeGreaterThanOrEqual(1);
  await expect(page.getByText("Loading your profile…")).toBeVisible();
  await expect(resetButton(page)).toBeDisabled();
  await resetButton(page).click({ force: true });
  await expect(dialogOf(page)).toHaveCount(0);
  await expect(page.getByTestId("profile-genres-count")).toHaveCount(0);
  expect(seen.posts).toBe(0);
  await shot(page, "profile-read-pending-reset-blocked");
  read.release();
  expect(await read.settled()).toMatch(/delivered/);
  await counts(page, 3, 2, 2);
  await expect(resetButton(page)).toBeEnabled();
  expect(seen.posts).toBe(0);
  expect((await server(page.request, [1, 2])).profile).toMatchObject({ ratingCount: 2, watchlistCount: 2 });
});

test("a delayed old profile response cannot overwrite a completed reset", async ({ page, request }) => {
  await signIn(page, await account(request, "oldprofile"));
  await seed(page.request, A);
  const old = await holdRequests(page, "**/api/me/profile"); // the first visit's reads: real 3/2/2 summary
  await page.getByRole("link", { name: "Profile", exact: true }).click();
  await expect.poll(old.held).toBeGreaterThanOrEqual(1);
  await page.getByRole("link", { name: "Home", exact: true }).click();
  old.stopHolding();
  await page.getByRole("link", { name: "Profile", exact: true }).click(); // second visit reads normally
  await counts(page, 3, 2, 2);
  await confirmWithClicks(page);
  await expect(page.locator(".profile-reset").getByText(success, { exact: true })).toBeVisible();
  await counts(page, 0, 0, 2);
  old.release(); // the old 3/2/2 reply is delivered after the reset completed
  const outcome = await old.settled();
  test.info().annotations.push({ type: "late-reply", description: outcome });
  await afterLateReply(page);
  await counts(page, 0, 0, 2);
  await expect(page.getByText("No saved genres yet.")).toBeVisible();
  await expect(page.getByRole("list", { name: "Saved genres" })).toHaveCount(0);
  await expect(page.locator(".profile-reset").getByText(success, { exact: true })).toBeVisible();
  expect((await server(page.request, [1, 2])).profile).toEqual({ genres: [], ratingCount: 0, watchlistCount: 2 });
  await shot(page, "old-profile-response-after-reset");
});

test("a recommendations read in flight before the reset cannot restore old cards", async ({ page, request }) => {
  await signIn(page, await account(request, "stale"));
  await seed(page.request, A);
  const old = await holdRequests(page, "**/api/me/recommendations*"); // personalised snapshot before the reset
  await page.getByRole("link", { name: "My recommendations", exact: true }).first().click();
  await expect.poll(old.held).toBeGreaterThanOrEqual(1);
  await page.getByRole("link", { name: "Profile", exact: true }).click();
  old.stopHolding();
  await expect(page.getByTestId("profile-genres-count")).toHaveText("3");
  await confirmWithClicks(page);
  await expect(page.locator(".profile-reset").getByText(success, { exact: true })).toBeVisible();
  await counts(page, 0, 0, 2);
  await page.getByRole("link", { name: "My recommendations", exact: true }).last().click();
  await expect(page.getByText("Not personalised")).toBeVisible();
  old.release();
  const outcome = await old.settled();
  test.info().annotations.push({ type: "late-reply", description: outcome });
  await afterLateReply(page);
  await expect(page.getByText("Not personalised")).toBeVisible();
  await expect(page.getByText("Your ratings have not changed this score.")).toHaveCount(0);
  await expect(page.getByText(/Because you like/)).toHaveCount(0);
  await page.getByRole("link", { name: "Preferences", exact: true }).click();
  await expect(page.getByText("0 of 5 selected")).toBeVisible();
  await shot(page, "stale-recommendations-after-reset");
});
