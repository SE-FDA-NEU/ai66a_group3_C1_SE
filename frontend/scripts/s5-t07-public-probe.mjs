/** Read-only browser/API diagnostics. A green result is not a PO/physical-phone sign-off. */
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import { COUNTRIES, assertHealth, assertProviderUi, assertRegional, sourceHead } from "./s5-t07-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const output = path.resolve(root, process.env.S5_T07_OUTPUT_DIR ?? ".venv/t07ops/results");
const base = new URL(process.env.S5_T07_PUBLIC_URL ?? "https://cineai-o9tf.onrender.com").origin;
const label = process.env.S5_T07_PROBE_LABEL ?? "public";
if (!/^[a-z0-9-]+$/.test(label)) throw new Error("Invalid probe label");
const mappingFile = path.resolve(root, process.env.S5_T07_MOVIES_FILE ?? "docs/evidence/s5-t07/movie-sources.json");
const mapping = JSON.parse(await readFile(mappingFile, "utf8"));
const sourceIds = new Map(mapping.movies.map(movie => [movie.id, movie.sourceId]));
const expectedHead = process.env.S5_T07_EXPECTED_HEAD ?? await sourceHead(root);
await mkdir(output, { recursive: true });
const result = {
  checkedAt: new Date().toISOString(), target: base,
  sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  expectedHead, deployedSha: null,
  device: "fresh headless Edge contexts; desktop and emulated 390x844; no physical phone",
  checks: [], physicalPhone: "pending", poAcceptance: "pending", teamRehearsal: "pending",
};
async function check(name, action) {
  try { const value = await action(); result.checks.push({ name, status: "pass" }); return value; }
  catch (error) { result.checks.push({ name, status: "fail", message: error.message.split("\n")[0].slice(0, 240) }); return null; }
}
const browser = await chromium.launch({ channel: "msedge", headless: true });
result.browser = `Microsoft Edge ${browser.version()}`;
async function observeUi(page) {
  const action = page.getByRole("link", { name: /view watch options on tmdb/i });
  const groups = {};
  for (const [key, title] of Object.entries({ flatrate: "Stream", rent: "Rent", buy: "Buy", free: "Free", ads: "With ads" })) {
    const group = page.locator(".provider-group").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
    groups[key] = await group.locator(".provider-badge__name").allTextContents();
  }
  const selector = page.getByRole("combobox", { name: "Country", exact: true });
  const count = await action.count();
  return {
    countrySelector: await selector.count(), selectedCountry: await selector.inputValue(),
    heading: await page.locator(".movie-providers h2").innerText(), actionCount: count,
    actionHref: count ? await action.getAttribute("href") : null,
    actionTarget: count ? await action.getAttribute("target") : null,
    actionRel: count ? await action.getAttribute("rel") : null, groups,
    attribution: /TMDb, powered by JustWatch/.test(await page.locator(".provider-note").innerText()),
    staleWarning: await page.locator(".provider-warning").count() === 1,
  };
}
async function settleDetails(page) {
  await expect(page.getByText("Loading similar movies...", { exact: true })).toHaveCount(0);
  await expect(page.locator('.similar-movies [role="alert"]')).toHaveCount(0);
  // Scroll through the real page so its lazy-loaded images finish before capture.
  for (const image of await page.locator(".movie-detail img").all()) {
    if (await image.isVisible()) await image.scrollIntoViewIfNeeded();
  }
  await expect.poll(() => page.locator(".movie-detail img").evaluateAll(images => images.every(image => image.complete)), { timeout: 20000 }).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
}
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const health = await page.request.get(`${base}/health`, { timeout: 90000 });
  result.health = { status: health.status(), body: await health.json() };
  await check("health matches source migration", () => assertHealth(result.health, expectedHead));
  await check("Home is reachable and contains imported data", async () => {
    const response = await page.goto(base, { waitUntil: "domcontentloaded", timeout: 90000 });
    expect(response.status()).toBe(200);
    await expect(page.getByRole("heading", { name: /find your.*next movie/i })).toBeVisible();
    await expect(page.locator('a[href^="/movies/"]').first()).toBeVisible();
    result.home = { status: response.status(), movieLinks: await page.locator('a[href^="/movies/"]').count() };
    await page.screenshot({ path: path.join(output, `${label}-home-desktop.png`), fullPage: true });
  });
  await check("light and dark themes", async () => {
    await page.getByRole("button", { name: /switch to light theme/i }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.getByRole("button", { name: /switch to dark theme/i }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
  await check("Popular navigation", async () => {
    await page.getByRole("link", { name: "Popular movies", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "Popular movies", exact: true }).first()).toBeVisible();
    await page.getByRole("link", { name: "Home", exact: true }).first().click();
  });
  await check("Home Z-A, page two and exact Details return context", async () => {
    const responsePromise = page.waitForResponse(response => new URL(response.url()).pathname === "/api/movies"
      && new URL(response.url()).searchParams.get("sort") === "title_desc");
    await page.getByLabel("Sort by title", { exact: true }).selectOption("title_desc");
    expect((await responsePromise).status()).toBe(200);
    await expect(page.locator('.movie-grid a[href^="/movies/"]').first()).toBeVisible();
    await page.getByRole("navigation", { name: "Movie pages", exact: true }).getByRole("button", { name: "Next", exact: true }).click();
    await expect(page).toHaveURL(url => url.searchParams.get("page") === "2" && url.searchParams.get("sort") === "title_desc");
    const originalUrl = page.url();
    const movieLink = page.locator('.movie-grid a[href^="/movies/"]').first();
    await expect(movieLink).toBeVisible(); await movieLink.click();
    await page.getByRole("link", { name: "Return to catalogue", exact: true }).click();
    await expect(page).toHaveURL(originalUrl);
    await expect(page.getByLabel("Sort by title", { exact: true })).toHaveValue("title_desc");
    await page.getByRole("link", { name: "Home", exact: true }).first().click();
  });
  await check("Search is submit-only and paginates all matches; return context survives Details", async () => {
    await page.getByRole("link", { name: "Search", exact: true }).first().click();
    let searches = 0;
    const listener = request => { if (new URL(request.url()).pathname === "/api/movies/search") searches++; };
    page.on("request", listener);
    try {
      await page.getByLabel("Title or description", { exact: true }).fill("the");
      await expect(page.getByText("Press Enter or Search to see results.", { exact: true })).toBeVisible();
      expect(searches).toBe(0);
      const responsePromise = page.waitForResponse(response => new URL(response.url()).pathname === "/api/movies/search");
      await page.getByLabel("Title or description", { exact: true }).press("Enter");
      const response = await responsePromise; expect(response.status()).toBe(200);
      const first = await response.json(); expect(first.meta.total).toBeGreaterThan(10);
      await expect(page.locator('.movie-grid a[href^="/movies/"]').first()).toBeVisible();
      const nextPromise = page.waitForResponse(response => new URL(response.url()).pathname === "/api/movies/search"
        && new URL(response.url()).searchParams.get("page") === "2");
      await page.getByRole("navigation", { name: "Movie pages", exact: true }).getByRole("button", { name: "Next", exact: true }).click();
      const nextResponse = await nextPromise; expect(nextResponse.status()).toBe(200);
      const second = await nextResponse.json(); expect(second.meta.total).toBe(first.meta.total);
      expect(second.data.movies.some(movie => first.data.movies.some(previous => previous.id === movie.id))).toBe(false);
      result.search = { query: "the", total: first.meta.total, firstPage: first.data.movies.length, secondPage: second.data.movies.length, noDuplicateIds: true };
      const originalUrl = page.url();
      await page.locator('.movie-grid a[href^="/movies/"]').first().click();
      await page.getByRole("link", { name: "Back to search", exact: true }).click();
      await expect(page).toHaveURL(originalUrl);
    } finally { page.off("request", listener); }
    await page.getByRole("link", { name: "Home", exact: true }).first().click();
  });
  let movieId;
  await check("Details reached through visible Home navigation", async () => {
    const requested = process.env.S5_T07_MOVIE_ID;
    const movieLink = requested ? page.locator(`a[href="/movies/${requested}"]`).first() : page.locator('a[href^="/movies/"]').first();
    await expect(movieLink).toBeVisible();
    const href = await movieLink.getAttribute("href");
    movieId = decodeURIComponent(href.split("/").at(-1));
    result.detail = { clickedHref: href, movieId, sourceId: sourceIds.get(movieId) ?? null };
    await movieLink.click();
    await expect(page).toHaveURL(url => url.pathname === href);
    await expect(page.locator(".movie-detail h1")).toBeVisible();
    result.detail.heading = await page.locator(".movie-detail h1").innerText();
  });
  if (movieId) {
    await check("real media and NLP Similar render on Details", async () => {
      const response = await page.request.get(`${base}/api/movies/${encodeURIComponent(movieId)}?country=US`);
      expect(response.status()).toBe(200); const movie = (await response.json()).data.movie;
      if (movie.posterUrl) {
        const image = page.locator(".movie-detail__poster .movie-poster img");
        await expect(image).toHaveCount(1);
        await expect.poll(() => image.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
      } else await expect(page.locator(".movie-detail__poster .movie-poster__fallback")).toBeVisible();
      if (movie.trailer) {
        const original = page.url(); await page.getByRole("button", { name: "Watch trailer", exact: true }).click();
        const dialog = page.getByRole("dialog"); await expect(dialog).toBeVisible();
        const frame = new URL(await dialog.locator("iframe").getAttribute("src"));
        expect(["www.youtube-nocookie.com", "www.youtube.com"]).toContain(frame.hostname);
        expect(frame.pathname).toBe(`/embed/${movie.trailer.key}`); expect(page.url()).toBe(original);
        await dialog.getByRole("button", { name: "Close trailer", exact: true }).click();
      } else await expect(page.getByText("Trailer unavailable", { exact: true })).toBeVisible();
      const similarResponse = await page.request.get(`${base}/api/movies/${encodeURIComponent(movieId)}/similar`);
      expect(similarResponse.status()).toBe(200); const similar = (await similarResponse.json()).data.movies;
      const section = page.locator(".similar-movies");
      await expect(section.getByText("Loading similar movies...", { exact: true })).toHaveCount(0);
      await expect(section.locator('a[href^="/movies/"]')).toHaveCount(similar.length);
      expect(similar.some(movie => movie.id === movieId)).toBe(false);
      result.media = { realPoster: Boolean(movie.posterUrl), backdropPresent: Boolean(movie.backdropUrl), trailerEmbedOpens: Boolean(movie.trailer), similarCount: similar.length, playbackConfirmation: "not asserted; external YouTube availability depends on the network/video" };
    });
    const movies = {};
    result.regionalApi = {};
    for (const country of Object.keys(COUNTRIES)) {
      const response = await page.request.get(`${base}/api/movies/${encodeURIComponent(movieId)}?country=${country}`);
      const observation = { status: response.status(), body: await response.json() };
      result.regionalApi[country] = observation;
      movies[country] = await check(`API movie/country/link ${country}`, () => assertRegional(observation, movieId, country, sourceIds.get(movieId)));
    }
    await check("unsupported region is a safe refusal", async () => {
      const response = await page.request.get(`${base}/api/movies/${encodeURIComponent(movieId)}?country=VN`);
      expect(response.status()).toBe(400);
      expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
    });
    await check("US default and country UI/API consistency", async () => {
      const selector = page.getByRole("combobox", { name: "Country", exact: true });
      await expect(selector).toHaveCount(1);
      await expect(selector).toHaveValue("US");
      result.detail.regions = {};
      for (const country of Object.keys(COUNTRIES)) {
        await selector.selectOption(country);
        await expect(page.locator(".movie-providers h2")).toHaveText(`Where to watch in ${COUNTRIES[country]}`);
        await expect(page.locator('.movie-providers__content [role="status"]')).toHaveCount(0);
        const ui = await observeUi(page);
        expect(movies[country], "API contract failed for this country").not.toBeNull();
        assertProviderUi(ui, movies[country], country, sourceIds.get(movieId));
        expect(await page.evaluate(() => localStorage.getItem("cineai-watch-country"))).toBe(country);
        result.detail.regions[country] = ui;
        if (ui.actionCount && !result.externalTab) {
          const previousUrl = page.url();
          const popupPromise = page.waitForEvent("popup");
          await page.getByRole("link", { name: /view watch options on tmdb/i }).click();
          const popup = await popupPromise;
          await expect.poll(() => popup.url(), { timeout: 20000 }).toBe(ui.actionHref);
          expect(page.url()).toBe(previousUrl);
          result.externalTab = { destination: popup.url(), originalRouteRetained: true };
          await popup.close();
        }
      }
      await page.reload();
      await expect(selector).toHaveValue("SG");
      await expect(page.locator('.movie-providers__content [role="status"]')).toHaveCount(0);
      assertProviderUi(await observeUi(page), movies.SG, "SG", sourceIds.get(movieId));
    });
    await settleDetails(page);
    await page.screenshot({ path: path.join(output, `${label}-detail-desktop.png`), fullPage: true });
    await check("invalid stored market falls back to US; mobile layout", async () => {
      const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      try {
        await mobile.addInitScript(() => localStorage.setItem("cineai-watch-country", "invalid"));
        const mobilePage = await mobile.newPage();
        const response = await mobilePage.goto(base, { waitUntil: "domcontentloaded", timeout: 90000 });
        expect(response.status()).toBe(200);
        await mobilePage.locator(`a[href="/movies/${movieId}"]`).first().click();
        const selector = mobilePage.getByRole("combobox", { name: "Country", exact: true });
        await expect(selector).toHaveValue("US");
        await expect(mobilePage.locator('.movie-providers__content [role="status"]')).toHaveCount(0);
        assertProviderUi(await observeUi(mobilePage), movies.US, "US", sourceIds.get(movieId));
        expect(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        await settleDetails(mobilePage);
        await mobilePage.screenshot({ path: path.join(output, `${label}-detail-mobile-emulated.png`), fullPage: true });
      } finally { await mobile.close(); }
    });
  }
  await context.close();
} catch (error) {
  result.checks.push({ name: "probe execution", status: "fail", message: error.message.split("\n")[0].slice(0, 240) });
} finally {
  await browser.close();
  result.technicalPass = result.checks.length > 0 && result.checks.every(check => check.status === "pass");
  result.fullIssueAcceptance = false;
  await writeFile(path.join(output, `${label}-probe.json`), `${JSON.stringify(result, null, 2)}\n`);
}
console.log(JSON.stringify({ ...result, regionalApi: undefined }, null, 2));
if (!result.technicalPass) process.exitCode = 1;
