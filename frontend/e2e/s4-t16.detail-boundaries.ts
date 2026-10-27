import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { releaseResponseGate } from "./support/responseGates.ts";

const controls = "http://127.0.0.1:8014/__acceptance";
const password = "Synthetic-t16-password";
const id = (number: number) => `20000000-0000-0000-0000-${String(number).padStart(12, "0")}`;

async function signIn(page: Page, request: APIRequestContext, label = "a") {
  const email = `t16-${label}-${crypto.randomUUID()}@example.test`;
  expect((await request.post("/api/auth/register", { data: { email, password } })).status()).toBe(201);
  if (page.url() === "about:blank") await page.goto("/");
  else if (new URL(page.url()).pathname !== "/")
    await page.getByRole("link", { name: "Home", exact: true }).click();
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/");
  return email;
}

async function screenshot(page: Page, name: string) {
  const directory = process.env.S4_T16_SCREENSHOT_DIR;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: path.join(directory, `${name}.png`), fullPage: true });
}

async function arm(request: APIRequestContext, name: string, apiPath: string, method = "GET") {
  expect((await request.post(`${controls}/gates/${name}/arm`, {
    data: { paths: [apiPath], methods: [method] },
  })).status()).toBe(200);
}

async function captured(request: APIRequestContext, name: string, apiPath: string) {
  // StrictMode may start more than one physical request. Require at least one
  // real response and verify identity/payload, rather than assuming exactly one.
  await expect.poll(async () => {
    const result = await request.get(`${controls}/gates/${name}`);
    expect(result.status()).toBe(200);
    const gate = await result.json();
    expect(gate.responses.every((row: { path: string }) => row.path === apiPath)).toBe(true);
    return gate.responses.length;
  }).toBeGreaterThan(0);
  expect((await request.post(`${controls}/gates/${name}/seal`)).status()).toBe(200);
  return (await (await request.get(`${controls}/gates/${name}`)).json()).responses;
}

async function release(request: APIRequestContext, name: string) {
  await releaseResponseGate(request, controls, name);
}

test.beforeEach(async ({ page, request }) => {
  expect((await request.post(`${controls}/scenario/detail-boundaries`)).status()).toBe(200);
  await page.route("https://image.tmdb.org/**", route => route.abort());
});

test.afterEach(async ({ request }) => {
  // Even a failed assertion must not strand the next test behind a held response.
  expect((await request.post(`${controls}/release-gates`)).status()).toBe(200);
});

test("T16 extension: pointer halves and keyboard persist real half-star ratings", async ({ page, request }) => {
  await signIn(page, request, "half-stars");
  await page.goto(`/movies/${id(1)}`);
  await expect(page.getByRole("radio")).toHaveCount(10);
  let writes = 0;
  page.on("request", request => {
    if (request.method() === "PUT" && new URL(request.url()).pathname.startsWith("/api/me/ratings/")) writes++;
  });
  for (const [theme, width] of [["dark", 1440], ["light", 375]] as const) {
    await page.setViewportSize({ width, height: 1000 });
    if (await page.locator("html").getAttribute("data-theme") !== theme)
      await page.getByRole("button", { name: `Switch to ${theme} theme` }).click();
    await expect(page.getByRole("button", { name: "Save rating", exact: true })).toBeVisible();
    for (let star = 1; star <= 5; star++) {
      const target = page.locator(".star-rating__star").nth(star - 1);
      await target.scrollIntoViewIfNeeded();
      const bounds = await target.boundingBox();
      expect(bounds).not.toBeNull();
      await page.mouse.click(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
      await expect(page.getByRole("radio", { name: `${star - 0.5} stars`, exact: true })).toBeChecked();
      await page.mouse.click(bounds!.x + bounds!.width - 3, bounds!.y + bounds!.height / 2);
      await expect(page.getByRole("radio", { name: star === 1 ? "1 star" : `${star} stars`, exact: true })).toBeChecked();
    }
    const savedValue = theme === "dark" ? 2.5 : 3.5;
    const half = page.getByRole("radio", { name: `${savedValue} stars`, exact: true });
    await half.check();
    await half.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: `${savedValue + 0.5} stars`, exact: true })).toBeChecked();
    await page.keyboard.press("ArrowLeft");
    await expect(half).toBeChecked();
    expect(writes).toBe(theme === "dark" ? 0 : 1);
    await page.getByRole("button", { name: "Save rating", exact: true }).click();
    await expect(page.getByText(`Your saved rating: ${savedValue}/5`, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Dismiss notification", exact: true }).click();
    await screenshot(page, `half-stars-${width}-${theme}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.reload();
    await expect(page.getByText(`Your saved rating: ${savedValue}/5`, { exact: true })).toBeVisible();
    expect((await (await page.request.get(`/api/me/ratings/${id(1)}`)).json()).data.rating).toBe(savedValue);
  }
});

test("T16 extension: Search sends nothing on typing, submits on Enter/button and restores Back", async ({ page }) => {
  const searches: string[] = [];
  page.on("request", request => {
    if (new URL(request.url()).pathname === "/api/movies/search") searches.push(request.url());
  });
  await page.goto("/search?source=t16#results");
  const input = page.getByRole("searchbox");
  await input.pressSequentially("astronaut");
  await expect(page.getByText("Press Enter or Search to see results.", { exact: true })).toBeVisible();
  expect(searches).toEqual([]);
  await expect(page).toHaveURL("/search?source=t16#results");
  await input.press("Enter");
  await expect(page.locator("article.movie-card").first()).toBeVisible();
  await expect(page).toHaveURL("/search?source=t16&q=astronaut#results");
  const submittedCount = searches.length;
  await input.fill("Changed draft");
  await expect(page.locator("article.movie-card")).toHaveCount(0);
  expect(searches).toHaveLength(submittedCount);
  await screenshot(page, "search-unsent-draft");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL("/search?source=t16&q=Changed+draft#results");
  await expect.poll(() => searches.length).toBeGreaterThan(submittedCount);
  await page.goBack();
  await expect(input).toHaveValue("astronaut");
  await expect(page.locator("article.movie-card").first()).toBeVisible();
});

test("Search exposes every ranked match and restores page two from details and Back", async ({ page }) => {
  await page.goto("/search?q=astronaut&source=t16#results");
  await expect(page.getByText("Showing 1-10 of 12 movies", { exact: true })).toBeVisible();
  const first = await page.locator("article.movie-card h2").allTextContents();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Showing 11-12 of 12 movies", { exact: true })).toBeVisible();
  const source = page.url();
  const last = await page.locator("article.movie-card h2").allTextContents();
  expect(new Set([...first, ...last]).size).toBe(12);
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  await page.locator("article.movie-card a.movie-card__link").first().click();
  await page.getByRole("link", { name: "Back to search", exact: true }).click();
  await expect(page).toHaveURL(source);
  await expect(page.locator("article.movie-card h2")).toHaveText(last);
  await page.locator("article.movie-card a.movie-card__link").first().click();
  await page.goBack();
  await expect(page).toHaveURL(source);
  await expect(page.locator("article.movie-card h2")).toHaveText(last);
  await screenshot(page, "search-page-two");
  await page.getByRole("searchbox").fill("rescue");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText("Showing 1-10 of 12 movies", { exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("page")).toBeNull();
  expect(new URL(page.url()).hash).toBe("#results");
});

for (const kind of ["catalogue", "popular"] as const) {
  test(`TC-S4-T16-RET-001 ${kind} page 2 survives app return and browser Back in both themes`,
    async ({ page }) => {
      const source = kind === "catalogue" ? "/?page=2&sort=title_desc&source=t16#catalogue-shelf" :
        "/popular?page=2&source=t16#catalogue-shelf";
      const privateReads: string[] = [];
      page.on("request", request => {
        if (/\/api\/me\/(ratings|watchlist)/.test(request.url())) privateReads.push(request.url());
      });
      for (const [theme, width] of [["dark", 1440], ["light", 375]] as const) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(source);
        await expect(page.locator("article.movie-card").first()).toBeVisible();
        if (await page.locator("html").getAttribute("data-theme") !== theme)
          await page.getByRole("button", { name: `Switch to ${theme} theme` }).click();
        const selected = page.locator("article.movie-card a.movie-card__link").first();
        const href = await selected.getAttribute("href");
        const expected = (await (await page.request.get(`/api${href}`)).json()).data.movie;
        await selected.click();
        await expect(page).toHaveURL(href!);
        await expect(page.getByRole("heading", { name: expected.title, exact: true })).toBeVisible();
        await page.goBack();
        await expect(page).toHaveURL(source);
        await expect(page.getByRole("button", { name: "Previous", exact: true })).toBeEnabled();
        await page.locator(`article.movie-card a[href="${href}"]`).click();
        const back = page.getByRole("link", { name: kind === "catalogue" ? "Return to catalogue" : "Back to popular movies" });
        await expect(back).toHaveAttribute("href", source);
        await back.focus();
        await expect(back).toBeFocused();
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(source);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        await screenshot(page, `${kind}-return-${theme}-${width}`);
      }
      expect(privateReads).toEqual([]);
    });
}

test("TC-S4-T16-PUBLIC-001 actual missing-field and not-found labels, with a safe return", async ({ page }) => {
  await page.goto(`/movies/${id(13)}`);
  await expect(page.getByRole("heading", { name: "Archive candidate", exact: true })).toBeVisible();
  await expect(page.locator(".movie-detail__facts > div")
    .filter({ has: page.locator("dt", { hasText: /^Year$/ }) }).locator("dd"))
    .toHaveText("Information unavailable");
  await expect(page.getByRole("heading", { name: "Overview", exact: true }).locator("..")
    .getByText("Information unavailable", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
  await screenshot(page, "detail-missing-fields-dark-1440");
  await page.evaluate(() => window.history.replaceState({ usr: {
    returnTo: "https://outside.invalid/steal",
  } }, ""));
  await page.reload();
  await expect(page.getByRole("link", { name: "Return to catalogue" })).toHaveAttribute("href", "/");
  await page.goto("/movies/ffffffff-ffff-4fff-8fff-ffffffffffff");
  await expect(page.getByRole("heading", { name: "Movie not found", exact: true })).toBeVisible();
  await screenshot(page, "detail-not-found-dark-1440");
  await page.getByRole("link", { name: "Return to catalogue" }).click();
  await expect(page.locator("article.movie-card").first()).toBeVisible();
});

test("TC-S4-T16-RET-003 recommendation page/filter survive rating save and preferences remain unchanged", async ({ page, request }) => {
  await signIn(page, request);
  await page.getByRole("link", { name: "Start", exact: true }).click();
  await page.getByRole("checkbox", { name: "Action", exact: true }).check();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page).toHaveURL("/recommendations");
  const before = await (await page.request.get("/api/me/preferences")).json();
  await page.getByRole("combobox", { name: "Filter by genre" }).selectOption("8101");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/\/recommendations\?.*page=2.*genreId=8101/);
  const source = new URL(page.url()).pathname + new URL(page.url()).search;
  const selected = page.locator("article.movie-card a.movie-card__link").first();
  const href = await selected.getAttribute("href");
  await selected.click();
  await expect(page.getByText("Not rated yet", { exact: true })).toBeVisible();
  await page.getByRole("radio", { name: "4 stars", exact: true }).check();
  expect((await (await page.request.get(`/api/me/ratings/${href!.split("/").at(-1)}`)).json()).data.rating).toBeNull();
  await page.getByRole("button", { name: "Save rating", exact: true }).click();
  await expect(page.getByText("Your saved rating: 4/5", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to recommendations" })).toHaveAttribute("href", source);
  await page.getByRole("link", { name: "Back to recommendations" }).click();
  await expect(page).toHaveURL(source);
  await expect(page.getByRole("combobox", { name: "Filter by genre" })).toHaveValue("8101");
  await expect(page.getByRole("button", { name: "Previous", exact: true })).toBeEnabled();
  expect(await (await page.request.get("/api/me/preferences")).json()).toEqual(before);
  await screenshot(page, "recommendations-filtered-return-dark-1440");
});

test("TC-S4-T16-RET-002 a changed catalogue clears the old recommendation filter on return", async ({ page, request }) => {
  await signIn(page, request);
  expect((await page.request.put("/api/me/preferences", { data: { genreIds: [8101] } })).status()).toBe(200);
  await page.goto("/recommendations?page=2&genreId=8101&source=t16#results");
  await page.locator("article.movie-card a.movie-card__link").first().click();
  const before = await (await page.request.get("/api/me/preferences")).json();
  expect((await request.post(`${controls}/scenario/detail-new-revision`)).status()).toBe(200);
  const reads: string[] = [];
  page.on("request", request => {
    if (request.url().includes("/api/me/recommendations?")) reads.push(request.url());
  });
  await page.getByRole("link", { name: "Back to recommendations" }).click();
  await expect(page).toHaveURL("/recommendations?page=1&source=t16#results");
  await expect(page.getByRole("combobox", { name: "Filter by genre" })).toHaveValue("");
  await expect(page.locator("article.movie-card")).toHaveCount(10);
  expect(reads.some(url => url.includes("catalogueRevision=s04-browser-main"))).toBe(true);
  expect(reads.at(-1)).not.toContain("genreId=");
  expect(await (await page.request.get("/api/me/preferences")).json()).toEqual(before);
  await screenshot(page, "recommendations-revision-reset-dark-1440");
});

test("TC-S4-T16-RET-004 search to details to similar keeps the original safe search query", async ({ page }) => {
  await page.goto("/search?q=astronaut&source=t16#results");
  const search = page.getByRole("region", { name: "Search results" });
  const first = search.getByRole("link", { name: /^View details for / }).first();
  await first.click();
  const section = page.getByRole("region", { name: "Similar movies" });
  const similar = section.getByRole("link", { name: /^View details for / }).first();
  const next = await similar.getAttribute("href");
  const expected = (await (await page.request.get(`/api${next}`)).json()).data.movie.title;
  await similar.click();
  await expect(page).toHaveURL(next!);
  await expect(page.getByRole("heading", { name: expected, exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Back to search", exact: true }).click();
  await expect(page).toHaveURL("/search?q=astronaut&source=t16#results");
  await expect(page.getByRole("searchbox", { name: "Title or description" })).toHaveValue("astronaut");
  await expect(search.getByRole("link", { name: /^View details for / })).toHaveCount(10);
});

test("TC-S4-T16-RET-005 changed preferences invalidate a historical detail-return filter", async ({ page, request }) => {
  await signIn(page, request);
  expect((await page.request.put("/api/me/preferences", { data: { genreIds: [8101] } })).status()).toBe(200);
  await page.goto("/recommendations?page=2&genreId=8101");
  const selected = page.locator("article.movie-card a.movie-card__link").first();
  const href = await selected.getAttribute("href");
  await selected.click();
  await page.getByRole("link", { name: "Preferences", exact: true }).click();
  await page.getByRole("checkbox", { name: "Action", exact: true }).uncheck();
  await page.getByRole("checkbox", { name: "Comedy", exact: true }).check();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page).toHaveURL("/recommendations");
  await expect(page.locator("article.movie-card")).toHaveCount(10);
  await page.goBack();
  await expect(page).toHaveURL("/preferences");
  await page.goBack();
  await expect(page).toHaveURL(href!);
  await page.getByRole("link", { name: "Back to recommendations" }).click();
  await expect(page).toHaveURL("/recommendations?page=1");
  await expect(page.getByRole("combobox", { name: "Filter by genre" })).toHaveValue("");
  const preferences = await (await page.request.get("/api/me/preferences")).json();
  expect(preferences.data.genres.map((genre: { id: number }) => genre.id)).toEqual([8102]);
});

test("TC-S4-T16-WATCH-001 account B cannot restore account A's page through historical details", async ({ page, request }) => {
  await signIn(page, request, "watch-old");
  const rows = await (await page.request.get("/api/movies?limit=10")).json();
  const rest = await (await page.request.get("/api/movies?limit=10&page=2")).json();
  const ids = [...rows.data.movies, ...rest.data.movies].slice(0, 11).map((movie: { id: string }) => movie.id);
  for (const movieId of ids) expect((await page.request.put(`/api/me/watchlist/${movieId}`)).status()).toBe(200);
  await page.goto("/watchlist?page=2");
  const selected = page.locator("article.watchlist-card a");
  const href = await selected.getAttribute("href");
  await selected.click();
  // Sign-out replaces the current route with Home. Keep an earlier real detail
  // entry by visiting a Similar movie first, rather than fabricating history.
  await page.getByRole("region", { name: "Similar movies" })
    .getByRole("link", { name: /^View details for / }).first().click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  await signIn(page, request, "watch-new");
  // B also has two valid pages: a total-page clamp alone would miss this bug.
  for (const movieId of ids) expect((await page.request.put(`/api/me/watchlist/${movieId}`)).status()).toBe(200);
  for (let step = 0; step < 4 && new URL(page.url()).pathname !== href; step++) {
    const previousIndex = await page.evaluate(() => window.history.state?.idx);
    await page.goBack();
    await page.waitForFunction(previous => window.history.state?.idx !== previous, previousIndex);
  }
  await expect(page).toHaveURL(href!);
  const reads: string[] = [];
  page.on("request", request => {
    if (new URL(request.url()).pathname === "/api/me/watchlist") reads.push(request.url());
  });
  await page.getByRole("link", { name: "Back to watchlist", exact: true }).click();
  await expect(page).toHaveURL("/watchlist?page=1");
  await expect(page.locator("article.watchlist-card")).toHaveCount(10);
  expect(reads.every(url => new URL(url).searchParams.get("page") === "1")).toBe(true);
});

test("TC-S4-T16-WATCH-004 watchlist page 2 returns exactly and last-row removal reconciles totals", async ({ page, request }) => {
  await signIn(page, request);
  const all = await (await page.request.get("/api/movies?limit=10")).json();
  const rest = await (await page.request.get("/api/movies?limit=10&page=2")).json();
  const ids = [...all.data.movies, ...rest.data.movies].slice(0, 11).map((movie: { id: string }) => movie.id);
  for (const movieId of ids) expect((await page.request.put(`/api/me/watchlist/${movieId}`)).status()).toBe(200);
  await page.goto("/watchlist?page=2&source=t16#saved");
  const selected = page.locator("article.watchlist-card a");
  await expect(selected).toHaveCount(1);
  const href = await selected.getAttribute("href");
  await selected.click();
  await expect(page).toHaveURL(href!);
  await page.getByRole("link", { name: "Back to watchlist", exact: true }).click();
  await expect(page).toHaveURL("/watchlist?page=2&source=t16#saved");
  await page.locator("article.watchlist-card button").click();
  await expect(page).toHaveURL("/watchlist?page=1&source=t16#saved");
  await expect(page.locator("article.watchlist-card")).toHaveCount(10);
  const result = await (await page.request.get("/api/me/watchlist?page=1&limit=10")).json();
  expect(result.meta.total).toBe(10);
  expect(result.meta.totalPages).toBe(1);
  expect(result.data.movies.some((movie: { id: string }) => movie.id === href!.split("/").at(-1))).toBe(false);
  await page.setViewportSize({ width: 375, height: 1000 });
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await screenshot(page, "watchlist-reconciled-light-375");
});

test("TC-S4-T16-FAIL-001 membership service outage leaves real details, rating, similar and recommendations usable", async ({ page, request }) => {
  await signIn(page, request);
  let fail = true;
  await page.route("**/api/me/watchlist/*", async route => {
    if (fail) await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({
      error: { code: "SERVICE_UNAVAILABLE", message: "Synthetic membership outage" },
    }) });
    else await route.continue();
  });
  await page.goto("/recommendations");
  await page.getByRole("link", { name: "View details for A", exact: true }).click();
  await expect(page.getByRole("heading", { name: "A", exact: true })).toBeVisible();
  await expect(page.getByText("An astronaut rescue mission on the moon", { exact: true })).toBeVisible();
  await expect(page.getByText("Not rated yet", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Similar movies" }).getByRole("link")).toHaveCount(5);
  await expect(page.getByRole("button", { name: "Retry watchlist status" })).toBeVisible();
  await screenshot(page, "detail-membership-failure-dark-1440");
  fail = false;
  await page.getByRole("button", { name: "Retry watchlist status" }).click();
  await expect(page.getByText("Not in your watchlist", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Back to recommendations" }).click();
  await expect(page.locator("article.movie-card")).toHaveCount(10);
});

test("TC-S4-T16-ASYNC-001 delayed detail, rating, membership and similar for A cannot fill B", async ({ page, request }) => {
  await signIn(page, request);
  expect((await page.request.put(`/api/me/ratings/${id(1)}`, { data: { rating: 5 } })).status()).toBe(200);
  expect((await page.request.put(`/api/me/watchlist/${id(1)}`)).status()).toBe(200);
  for (const [label, apiPath] of [
    ["detail", `/api/movies/${id(1)}`], ["rating", `/api/me/ratings/${id(1)}`],
    ["membership", `/api/me/watchlist/${id(1)}`], ["similar", `/api/movies/${id(1)}/similar`],
  ]) {
    const gate = `t16-${label}-${crypto.randomUUID()}`;
    await arm(request, gate, apiPath);
    await page.goto(`/movies/${id(1)}`);
    const rows = await captured(request, gate, apiPath);
    expect(rows.every((row: { status: number }) => row.status === 200)).toBe(true);
    // This is client-side navigation, not a reload that discards the old JS app.
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await page.getByRole("link", { name: "View details for B", exact: true }).click();
    await expect(page.getByRole("heading", { name: "B", exact: true })).toBeVisible();
    await release(request, gate);
    await expect(page.getByText("Not rated yet", { exact: true })).toBeVisible();
    await expect(page.getByText("Not in your watchlist", { exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Similar movies" }).getByRole("link", { name: "View details for B", exact: true })).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe(`/movies/${id(2)}`);
  }
  await screenshot(page, "detail-stale-replies-dark-1440");
});

test("TC-S4-T16-ASYNC-002 delayed private reads and a committed write cannot leak after account switch", async ({ page, request }) => {
  await signIn(page, request, "old");
  expect((await page.request.put(`/api/me/ratings/${id(1)}`, { data: { rating: 5 } })).status()).toBe(200);
  expect((await page.request.put(`/api/me/watchlist/${id(1)}`)).status()).toBe(200);
  for (const [label, apiPath] of [
    ["old-membership", `/api/me/watchlist/${id(1)}`], ["old-rating", `/api/me/ratings/${id(1)}`],
  ]) {
    expect((await page.request.put(`/api/me/ratings/${id(1)}`, { data: { rating: 5 } })).status()).toBe(200);
    expect((await page.request.put(`/api/me/watchlist/${id(1)}`)).status()).toBe(200);
    const gate = `t16-${label}-${crypto.randomUUID()}`;
    await arm(request, gate, apiPath);
    await page.goto(`/movies/${id(1)}`);
    await captured(request, gate, apiPath);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
    await signIn(page, request, label);
    await page.getByRole("link", { name: "View details for A", exact: true }).click();
    await expect(page.getByText("Not rated yet", { exact: true })).toBeVisible();
    await expect(page.getByText("Not in your watchlist", { exact: true })).toBeVisible();
    await release(request, gate);
    await expect(page.getByText("Not rated yet", { exact: true })).toBeVisible();
    await expect(page.getByText("Not in your watchlist", { exact: true })).toBeVisible();
    expect((await page.request.get("/api/auth/me")).status()).toBe(200);
  }
  const gate = `t16-save-${crypto.randomUUID()}`;
  await page.goto(`/movies/${id(1)}`);
  await expect(page.getByRole("button", { name: "Add to watchlist" })).toBeVisible();
  await arm(request, gate, `/api/me/watchlist/${id(1)}`, "PUT");
  await page.getByRole("button", { name: "Add to watchlist" }).click();
  const rows = await captured(request, gate, `/api/me/watchlist/${id(1)}`);
  expect(rows.every((row: { body: { data: { inWatchlist: boolean } } }) => row.body.data.inWatchlist)).toBe(true);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  await signIn(page, request, "new-after-save");
  await page.getByRole("link", { name: "View details for A", exact: true }).click();
  await expect(page.getByText("Not in your watchlist", { exact: true })).toBeVisible();
  await release(request, gate);
  await expect(page.getByText("Not in your watchlist", { exact: true })).toBeVisible();
  await expect(page.getByTestId("action-feedback")).not.toContainText("Added to watchlist");
});
