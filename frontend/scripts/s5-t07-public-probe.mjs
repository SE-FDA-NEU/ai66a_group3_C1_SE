/** Read-only browser and API probe for the S5-T07 public candidate. */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const output = path.join(root, "docs/evidence/s5-t07");
const base = process.env.S5_T07_PUBLIC_URL ?? "https://cineai-o9tf.onrender.com";
const movieId = process.env.S5_T07_MOVIE_ID ?? "2626f71e-8458-491c-a1f4-c2017d8f684b";
const label = process.env.S5_T07_PROBE_LABEL ?? "public";
if (!/^[a-z0-9-]+$/.test(label)) throw new Error("Invalid probe label");

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const result = {
  checkedAt: new Date().toISOString(),
  target: base,
  requestedMovieId: movieId,
  browser: `Microsoft Edge ${browser.version()} (headless)`,
  device: "desktop browser and emulated 390x844 mobile viewport; no physical phone",
};

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const response = await page.goto(base, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByRole("heading", { name: /find your.*next movie/i }).waitFor({ timeout: 20000 });
  await page.locator('a[href^="/movies/"]').first().waitFor({ timeout: 20000 });
  result.home = {
    status: response.status(),
    heading: await page.locator("h1").first().innerText(),
    movieLinks: await page.locator('a[href^="/movies/"]').count(),
  };
  await page.screenshot({ path: path.join(output, `${label}-home-desktop.png`), fullPage: true });
  await page.getByRole("button", { name: /switch to light theme/i }).click();
  result.home.lightTheme = await page.locator("html").getAttribute("data-theme");
  await page.getByRole("button", { name: /switch to dark theme/i }).click();
  await page.getByRole("link", { name: "Popular movies" }).first().click();
  await page.getByRole("heading", { name: "Popular movies" }).first().waitFor();
  result.popular = { url: page.url(), heading: await page.locator("h1").first().innerText() };
  await page.getByRole("link", { name: "Home" }).first().click();
  const movieLink = page.locator('a[href^="/movies/"]').first();
  await movieLink.waitFor();
  result.detail = { clickedHref: await movieLink.getAttribute("href") };
  await movieLink.click();
  await page.waitForURL(url => url.pathname === result.detail.clickedHref);
  await page.locator(".movie-detail h1").waitFor();
  result.detail.url = page.url();
  result.detail.heading = await page.locator(".movie-detail h1").innerText();
  result.detail.countrySelector = await page.getByRole("combobox", { name: "Country" }).count();
  result.detail.watchOptionsActions = await page.getByRole("link", { name: /view watch options on tmdb/i }).count();
  if (result.detail.countrySelector) {
    result.detail.regions = {};
    for (const country of ["US", "GB", "SG"]) {
      const responsePromise = country === "US" ? null : page.waitForResponse(response =>
        response.url().includes(`/api/movies/${result.detail.clickedHref.split("/").at(-1)}?country=${country}`));
      await page.getByRole("combobox", { name: "Country" }).selectOption(country);
      if (responsePromise) await responsePromise;
      await page.waitForFunction(() => !document.querySelector('.movie-providers__content [role="status"]'));
      const action = page.getByRole("link", { name: /view watch options on tmdb/i });
      result.detail.regions[country] = {
        heading: await page.locator(".movie-providers h2").innerText(),
        actionHref: await action.count() ? await action.getAttribute("href") : null,
        actionTarget: await action.count() ? await action.getAttribute("target") : null,
        actionRel: await action.count() ? await action.getAttribute("rel") : null,
      };
    }
  }
  await page.screenshot({ path: path.join(output, `${label}-detail-desktop.png`), fullPage: true });

  const health = await page.request.get(`${base}/health`);
  result.health = { status: health.status(), body: await health.json() };
  result.regionalApi = {};
  for (const country of ["US", "GB", "SG"]) {
    const api = await page.request.get(`${base}/api/movies/${movieId}?country=${country}`);
    const body = await api.json();
    const movie = body.data?.movie;
    result.regionalApi[country] = {
      status: api.status(),
      movieId: movie?.id ?? null,
      country: movie?.providers?.country ?? null,
      providerStatus: movie?.providers?.status ?? null,
      watchOptionsUrl: movie?.watchOptionsUrl ?? null,
      fieldsPresent: Boolean(movie && "providers" in movie && "watchOptionsUrl" in movie),
    };
  }
  await context.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 },
    isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const mobilePage = await mobile.newPage();
  const mobileResponse = await mobilePage.goto(`${base}${result.detail.clickedHref}`,
    { waitUntil: "domcontentloaded", timeout: 60000 });
  await mobilePage.locator(".movie-detail h1").waitFor();
  result.mobileEmulation = {
    status: mobileResponse.status(), heading: await mobilePage.locator(".movie-detail h1").innerText(),
    countrySelector: await mobilePage.getByRole("combobox", { name: "Country" }).count(),
  };
  await mobilePage.screenshot({ path: path.join(output, `${label}-detail-mobile-emulated.png`), fullPage: true });
  await mobile.close();
} catch (error) {
  result.failure = String(error.message).slice(0, 300);
  process.exitCode = 1;
} finally {
  await browser.close();
  await writeFile(path.join(output, `${label}-probe.json`), `${JSON.stringify(result, null, 2)}\n`);
}

console.log(JSON.stringify(result, null, 2));
if (!result.failure && Object.values(result.regionalApi ?? {}).some(value => !value.fieldsPresent))
  process.exitCode = 2;
