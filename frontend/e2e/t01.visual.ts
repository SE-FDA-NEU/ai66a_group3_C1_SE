import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { releaseResponseGate, waitForResponseGate } from "./support/responseGates.ts";

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

async function expectActionButton(link: ReturnType<Page["getByRole"]>) {
  await expect(link).toBeVisible();
  const style = await link.evaluate(node => {
    const css = getComputedStyle(node);
    return { tag: node.tagName, decoration: css.textDecorationLine,
      height: node.getBoundingClientRect().height, radius: parseFloat(css.borderRadius),
      border: parseFloat(css.borderTopWidth) };
  });
  expect(style.tag).toBe("A");
  expect(style.decoration).toBe("none");
  expect(style.height).toBeGreaterThanOrEqual(44);
  expect(style.radius).toBeGreaterThan(0);
  expect(style.border).toBeGreaterThan(0);
}

test.beforeEach(async ({ page, request }) => {
  if (live) return;
  expect((await request.post(`${controls}/scenario/ranked`)).ok()).toBe(true);
  // Deterministic offline image failure checks, not fabricated TMDb screenshots.
  await page.route("https://image.tmdb.org/**", route => route.abort());
});

test.afterEach(async ({ request }) => {
  if (!live) expect((await request.post(`${controls}/release-gates`)).status()).toBe(200);
});

test("S08 search uses real API/index across themes, sizes, states and safe return", async ({ page, request, browser }, info) => {
  test.skip(live, "Search acceptance owns synthetic DB/index fixtures");
  test.setTimeout(120_000);
  const observations: object[] = [];
  const errors: string[] = [];
  const privateRequests: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/me/") || url.hostname === "api.themoviedb.org") privateRequests.push(url.pathname);
  });
  const scenario = async (name: string) => {
    const response = await request.post(`${controls}/scenario/${name}`);
    expect(response.ok()).toBe(true);
    const data = await response.json();
    observations.push(data);
    return data;
  };
  const search = page.getByRole("searchbox", { name: "Title or description" });
  const titles = page.locator("article.movie-card h2");
  for (const width of [375, 768, 1440]) {
    for (const theme of ["light", "dark"]) {
      const seed = await scenario("search-ranked");
      expect(seed.titleHits).toBe(11);
      expect(seed.scores["Moon Rescue"]).toBeGreaterThan(seed.scores["City Robot"]);
      expect(seed.scores["City Robot"]).toBeGreaterThan(0);
      await page.setViewportSize({ width, height: 960 });
      await page.goto("/search");
      if (await page.locator("html").getAttribute("data-theme") !== theme)
        await page.getByRole("button", { name: `Switch to ${theme} theme` }).click();
      await expect(page.getByText("Enter at least 2 characters", { exact: true })).toBeVisible();
      const gate = `search-loading-${width}-${theme}`;
      await request.post(`${controls}/gates/${gate}/arm`);
      await search.fill("  inCEPTION  ");
      await search.press("Enter");
      await waitForResponseGate(request, controls, gate, "/api/movies/search");
      await expect(page.getByText("Loading movies...", { exact: true })).toBeVisible();
      await noOverflow(page);
      if (width === 375 && theme === "light") await screenshot(page, "search-loading-375-light");
      await request.post(`${controls}/gates/${gate}/seal`);
      await request.post(`${controls}/gates/${gate}/release`);
      const api = await (await request.get("/api/movies/search?q=inCEPTION")).json();
      await expect(titles).toHaveText(api.data.movies.map((movie: { title: string }) => movie.title));
      expect(api.data.movies).toHaveLength(10);
      expect(api.data.movies[0].title).toBe("Inception");
      observations.push({ width, theme, titleApi: api });
      await search.fill("astronaut rescue moon");
      await search.press("Enter");
      await expect(titles).toHaveText(["Moon Rescue", "City Robot"]);
      await search.focus();
      await expect(search).toBeFocused();
      expect(await search.evaluate(node => getComputedStyle(node).outlineStyle)).not.toBe("none");
      const searchUrl = page.url();
      const submitted = () => page.waitForResponse(response => {
        const url = new URL(response.url());
        return url.pathname === "/api/movies/search" && url.searchParams.get("q") === "astronaut rescue moon";
      });
      const enterResponse = submitted();
      await search.press("Enter");
      expect((await enterResponse).status()).toBe(200);
      await expect(titles).toHaveText(["Moon Rescue", "City Robot"]);
      await expect(page).toHaveURL(searchUrl);
      await expect(search).toBeFocused();
      await page.keyboard.press("Tab");
      const submit = page.getByRole("button", { name: "Search", exact: true });
      await expect(submit).toBeFocused();
      const buttonResponse = submitted();
      await page.keyboard.press("Enter");
      expect((await buttonResponse).status()).toBe(200);
      await expect(titles).toHaveText(["Moon Rescue", "City Robot"]);
      await expect(page).toHaveURL(searchUrl);
      await page.keyboard.press("Tab");
      await expect(page.getByRole("link", { name: "View details for Moon Rescue" })).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(submit).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(search).toBeFocused();
      await noOverflow(page);
      await screenshot(page, `search-results-${width}-${theme}`);
      await page.getByRole("link", { name: "View details for Moon Rescue" }).click();
      const back = page.getByRole("link", { name: "Back to search", exact: true });
      await expect(back).toHaveAttribute("href", "/search?q=astronaut+rescue+moon");
      await back.click();
      await expect(search).toHaveValue("astronaut rescue moon");
      await page.reload();
      await expect(titles).toHaveText(["Moon Rescue", "City Robot"]);
      await search.fill("volcano jazz galaxy");
      await search.press("Enter");
      await expect(page.getByText("No movies found", { exact: true })).toBeVisible();
      await expect(titles).toHaveCount(0);
      await noOverflow(page);
      if (width === 375 && theme === "light") await screenshot(page, "search-empty-375-light");
      await scenario("search-index-failure");
      const failedQueries: string[] = [];
      const record = (response: import("@playwright/test").Response) => {
        const url = new URL(response.url());
        if (url.pathname === "/api/movies/search") failedQueries.push(url.searchParams.get("q")!);
      };
      page.on("response", record);
      await search.fill("rescue astronaut moon");
      await search.press("Enter");
      await expect(page.getByRole("alert")).toContainText("Search index is temporarily unavailable");
      await noOverflow(page);
      if (width === 375 && theme === "light") await screenshot(page, "search-error-375-light");
      const fallback = await request.get("/api/movies/search?q=Inception");
      expect(fallback.status()).toBe(200);
      expect((await fallback.json()).data.movies).toHaveLength(10);
      await scenario("search-ranked");
      await page.getByRole("button", { name: "Retry", exact: true }).click();
      await expect(titles).toHaveText(["Moon Rescue", "City Robot"]);
      expect(failedQueries).toEqual(["rescue astronaut moon", "rescue astronaut moon"]);
      page.off("response", record);
      await noOverflow(page);
      if (width === 375 && theme === "light") await screenshot(page, "search-retry-375-light");
      const zero = await scenario("search-zero");
      expect(zero.scores["Moon Rescue"]).toBeGreaterThan(0);
      expect(zero.scores["City Robot"]).toBe(0);
      await search.fill("astronaut rescue moon");
      await search.press("Enter");
      await expect(titles).toHaveText(["Moon Rescue"]);
      await scenario("search-empty");
      await search.fill("astronaut moon");
      await search.press("Enter");
      await expect(page.getByText("No movies found", { exact: true })).toBeVisible();
      await noOverflow(page);
    }
  }
  expect(errors).toEqual([]);
  expect(privateRequests).toEqual([]);
  const evidence = { browser: browser.version(), observations, errors, privateRequests };
  await info.attach("search-api-db.json", { body: JSON.stringify(evidence, null, 2), contentType: "application/json" });
  if (process.env.T01_SCREENSHOT_DIR)
    await writeFile(path.join(process.env.T01_SCREENSHOT_DIR, "search-api-db.json"), JSON.stringify(evidence, null, 2) + "\n");
});

test("S08 delayed real search response cannot replace a newer query or return after unmount", async ({ page, request }) => {
  test.skip(live, "Delayed responses use the isolated acceptance harness");
  expect((await request.post(`${controls}/scenario/search-ranked`)).ok()).toBe(true);
  try {
    await page.goto("/search");
    await request.post(`${controls}/gates/search-stale/arm`);
    await page.getByRole("searchbox").fill("Inception");
    await page.getByRole("searchbox").press("Enter");
    await waitForResponseGate(request, controls, "search-stale", "/api/movies/search");
    await request.post(`${controls}/gates/search-stale/seal`);
    await page.getByRole("searchbox").fill("astronaut rescue moon");
    await page.getByRole("searchbox").press("Enter");
    await expect(page.locator("article.movie-card h2")).toHaveText(["Moon Rescue", "City Robot"]);
    await releaseResponseGate(request, controls, "search-stale");
    await expect(page.locator("article.movie-card h2")).toHaveText(["Moon Rescue", "City Robot"]);
    await request.post(`${controls}/gates/search-unmount/arm`);
    await page.getByRole("searchbox").fill("Inception");
    await page.getByRole("searchbox").press("Enter");
    await waitForResponseGate(request, controls, "search-unmount", "/api/movies/search");
    await request.post(`${controls}/gates/search-unmount/seal`);
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await releaseResponseGate(request, controls, "search-unmount");
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Find your next movie" })).toBeVisible();
    await expect(page.getByRole("searchbox")).toHaveCount(0);
  } finally {
    await request.post(`${controls}/release-gates`);
  }
});

const similarSource = "20000000-0000-0000-0000-000000000001";
const archiveMovie = "20000000-0000-0000-0000-000000000013";
const rankedSimilarTitles = ["Moon Rescue", "Orbit Medic", "City Robot", "Desert Heist", "Jazz Voyage"];
type SimilarMovie = { id: string; title: string; genres: { id: number }[] };
async function setTheme(page: Page, theme: string) {
  if (await page.locator("html").getAttribute("data-theme") !== theme)
    await page.getByRole("button", { name: `Switch to ${theme} theme` }).click();
}
async function similarApi(request: import("@playwright/test").APIRequestContext, movieId: string) {
  const response = await request.get(`/api/movies/${movieId}/similar`);
  expect(response.status()).toBe(200);
  return (await response.json()).data.movies as SimilarMovie[];
}
async function similarHrefs(page: Page) {
  return page.getByRole("region", { name: "Similar movies", exact: true }).locator("article.movie-card")
    .getByRole("link").evaluateAll(links => links.map(link => link.getAttribute("href")));
}

test("S07 similar movies satisfy all five criteria with the real API, index and DB", async ({ page, request, browser }, info) => {
  test.skip(live, "Similar acceptance owns synthetic DB/index fixtures");
  test.setTimeout(240_000);
  const observations: object[] = [];
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (new URL(request.url()).hostname === "api.themoviedb.org") external.push(request.url());
  });
  const scenario = async (name: string) => {
    const response = await request.post(`${controls}/scenario/${name}`);
    expect(response.ok()).toBe(true);
    const data = await response.json();
    observations.push(data);
    return data;
  };
  const section = page.getByRole("region", { name: "Similar movies", exact: true });
  const titles = section.locator("article.movie-card h2");
  const sourceHeading = page.getByRole("heading", { name: "Moon Source", level: 1 });
  for (const width of [375, 768, 1440]) {
    for (const theme of ["light", "dark"]) {
      const tag = `${width}-${theme}`;
      const showEvidence = width === 375 && theme === "light";
      await page.setViewportSize({ width, height: 960 });

      // AC1 and AC4: real vectorisation. Popularity runs opposite to cosine, a missing-text
      // candidate is the most popular, and one candidate matches through two shared genres.
      const seed = await scenario("similar-ranked");
      expect(seed.scores["Moon Rescue"]).toBeGreaterThan(seed.scores["Orbit Medic"]);
      expect(seed.scores["Orbit Medic"]).toBeGreaterThan(seed.scores["City Robot"]);
      expect(seed.scores["City Robot"]).toBeGreaterThan(0);
      expect(seed.scores["Desert Heist"]).toBe(0);
      expect(seed.scores["Jazz Voyage"]).toBe(0);
      expect(seed.scores["Quiet Archive"]).toBeNull();
      const api = await similarApi(request, similarSource);
      const source = (await (await request.get(`/api/movies/${similarSource}`)).json()).data.movie;
      expect(api.map(movie => movie.title)).toEqual(rankedSimilarTitles);
      expect(new Set(api.map(movie => movie.id)).size).toBe(5);
      expect(api.map(movie => movie.id)).not.toContain(similarSource);
      for (const movie of api)
        expect(movie.genres.some(genre => source.genres.some((own: { id: number }) => own.id === genre.id))).toBe(true);
      observations.push({ width, theme, sourceGenres: source.genres, similarApi: api });

      const gate = `similar-loading-${tag}`;
      await request.post(`${controls}/gates/${gate}/arm`);
      await page.goto(`/movies/${similarSource}`);
      await setTheme(page, theme);
      await waitForResponseGate(request, controls, gate, `/api/movies/${similarSource}/similar`);
      await expect(page.getByText("Loading similar movies...", { exact: true })).toBeVisible();
      await expect(sourceHeading).toBeVisible();
      await noOverflow(page);
      if (showEvidence) await screenshot(page, "similar-loading-375-light");
      await request.post(`${controls}/gates/${gate}/seal`);
      await request.post(`${controls}/gates/${gate}/release`);

      await expect(titles).toHaveText(rankedSimilarTitles);
      await expect(section.getByRole("heading", { name: "Quiet Archive" })).toHaveCount(0);
      await expect(section.getByRole("heading", { name: "Archive candidate" })).toHaveCount(0);
      await expect(section.getByRole("heading", { name: "Moon Source" })).toHaveCount(0);
      expect(await similarHrefs(page)).toEqual(api.map(movie => `/movies/${movie.id}`));
      await noOverflow(page);
      await screenshot(page, `similar-results-${tag}`);

      // Keyboard: Tab enters the section from the last detail control, follows API order and reverses.
      const link = (title: string) => section.getByRole("link", { name: `View details for ${title}`, exact: true });
      await page.getByRole("link", { name: "Sign in to save this movie", exact: true }).focus();
      await page.keyboard.press("Tab");
      await expect(link("Moon Rescue")).toBeFocused();
      expect(await link("Moon Rescue").evaluate(node => getComputedStyle(node).outlineStyle)).not.toBe("none");
      for (const title of rankedSimilarTitles.slice(1)) {
        await page.keyboard.press("Tab");
        await expect(link(title)).toBeFocused();
      }
      for (const title of [...rankedSimilarTitles].reverse().slice(1)) {
        await page.keyboard.press("Shift+Tab");
        await expect(link(title)).toBeFocused();
      }

      // AC3: the selected ID opens, by keyboard in the dark theme and by click in the light theme.
      if (theme === "dark") await page.keyboard.press("Enter");
      else await link("Moon Rescue").click();
      await expect(page).toHaveURL(`/movies/${api[0].id}`);
      await expect(page.getByRole("heading", { name: "Moon Rescue", level: 1 })).toBeVisible();
      const next = await similarApi(request, api[0].id);
      expect(next.map(movie => movie.id)).not.toContain(api[0].id);
      await expect(titles).toHaveText(next.map(movie => movie.title));
      expect(await similarHrefs(page)).toEqual(next.map(movie => `/movies/${movie.id}`));

      // AC2: no suitable candidate keeps the original details visible.
      await scenario("similar-empty");
      expect(await similarApi(request, archiveMovie)).toEqual([]);
      await page.goto(`/movies/${archiveMovie}`);
      await expect(page.getByRole("heading", { name: "Archive candidate", level: 1 })).toBeVisible();
      await expect(section.getByText("No similar movies are available", { exact: true })).toBeVisible();
      await expect(titles).toHaveCount(0);
      await expect(section.getByRole("alert")).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
      await noOverflow(page);
      if (showEvidence) await screenshot(page, "similar-empty-375-light");

      // AC4: adding a candidate without an overview cannot invert the cosine order.
      const pair = await scenario("similar-pair");
      expect(pair.scores["Moon Rescue"]).toBeGreaterThan(pair.scores["Orbit Medic"]);
      await page.goto(`/movies/${similarSource}`);
      await expect(titles).toHaveText(["Moon Rescue", "Orbit Medic"]);
      const plus = await scenario("similar-missing-candidate");
      expect(plus.scores["Quiet Archive"]).toBeNull();
      await page.reload();
      await expect(titles).toHaveText(["Moon Rescue", "Orbit Medic", "Quiet Archive"]);
      expect((await similarApi(request, similarSource)).map(movie => movie.title)).toEqual(["Moon Rescue", "Orbit Medic", "Quiet Archive"]);
      await noOverflow(page);

      // AC5: a missing, blank or zero-vector source falls back to popularity, then title and ID.
      for (const name of ["similar-missing-source", "similar-blank-source", "similar-zero-source"]) {
        expect((await scenario(name)).sourceUsable).toBe(false);
        await page.reload();
        await expect(titles).toHaveText(["Quiet Archive", "Orbit Medic", "Moon Rescue"]);
        await expect(section.getByRole("alert")).toHaveCount(0);
        await expect(sourceHeading).toBeVisible();
        expect((await similarApi(request, similarSource)).map(movie => movie.title)).toEqual(["Quiet Archive", "Orbit Medic", "Moon Rescue"]);
      }

      // A failed index is a recoverable error, not an empty list or a fallback ordering.
      await scenario("similar-index-failure");
      const statuses: number[] = [];
      const record = (response: import("@playwright/test").Response) => {
        if (new URL(response.url()).pathname.endsWith("/similar")) statuses.push(response.status());
      };
      page.on("response", record);
      await page.goto(`/movies/${similarSource}`);
      await expect(section.getByRole("alert")).toContainText("Similar movies are unavailable. Search index is temporarily unavailable");
      await expect(sourceHeading).toBeVisible();
      await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
      await expect(section.getByText("No similar movies are available", { exact: true })).toHaveCount(0);
      await expect(titles).toHaveCount(0);
      await noOverflow(page);
      if (showEvidence) await screenshot(page, "similar-error-375-light");
      await scenario("similar-ranked");
      await section.getByRole("button", { name: "Retry similar movies", exact: true }).click();
      await expect(titles).toHaveText(rankedSimilarTitles);
      await expect(section.getByRole("alert")).toHaveCount(0);
      expect(statuses).toEqual([503, 200]);
      page.off("response", record);
      await noOverflow(page);
      if (showEvidence) await screenshot(page, "similar-retry-375-light");
    }
  }
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  const evidence = { browser: browser.version(), observations, errors, external };
  await info.attach("similar-api-db.json", { body: JSON.stringify(evidence, null, 2), contentType: "application/json" });
  if (process.env.T01_SCREENSHOT_DIR)
    await writeFile(path.join(process.env.T01_SCREENSHOT_DIR, "similar-api-db.json"), JSON.stringify(evidence, null, 2) + "\n");
});

test("S07 similar results are public, identical across accounts, independent of ratings and keep the return context", async ({ page, request }) => {
  test.skip(live, "Similar acceptance owns synthetic DB/index fixtures");
  test.setTimeout(120_000);
  expect((await request.post(`${controls}/scenario/similar-ranked`)).ok()).toBe(true);
  const preferenceWrites: string[] = [];
  page.on("request", request => {
    if (request.method() !== "GET" && new URL(request.url()).pathname === "/api/me/preferences")
      preferenceWrites.push(request.method());
  });
  const api = await similarApi(request, similarSource);
  const expected = api.map(movie => `/movies/${movie.id}`);
  const section = page.getByRole("region", { name: "Similar movies", exact: true });
  const titles = section.locator("article.movie-card h2");

  // Guest: no sign-in or private read is needed.
  await page.goto(`/movies/${similarSource}`);
  await expect(titles).toHaveText(rankedSimilarTitles);
  expect(await similarHrefs(page)).toEqual(expected);

  const accounts = [] as { email: string; password: string }[];
  for (const label of ["a", "b"]) {
    const credentials = { email: `similar-${label}-${crypto.randomUUID()}@example.test`, password: "Synthetic-similar-password" };
    accounts.push(credentials);
    expect((await request.post("/api/auth/register", { data: credentials })).status()).toBe(201);
    expect((await page.request.post("/api/auth/login", { data: credentials })).status()).toBe(200);
    if (label === "a") expect((await page.request.put("/api/me/preferences", { data: { genreIds: [8101] } })).status()).toBe(200);
    const before = label === "a" ? await (await page.request.get("/api/me/preferences")).json() : null;
    // The rating dependency fails for the signed-in account; Similar neither waits for nor depends on it.
    if (label === "a") await page.route("**/api/me/ratings/**", route => route.fulfill({
      status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "SERVICE_UNAVAILABLE", message: "Rating service is unavailable" } }) }));
    preferenceWrites.length = 0;
    await page.goto(`/movies/${similarSource}`);
    await expect(titles).toHaveText(rankedSimilarTitles);
    expect(await similarHrefs(page)).toEqual(expected);
    if (label === "a") {
      await expect(page.getByText("Rating service is unavailable").first()).toBeVisible();
      await page.unroute("**/api/me/ratings/**");
      const after = await (await page.request.get("/api/me/preferences")).json();
      expect(after).toEqual(before);
      expect(after.data.genres).toEqual([{ id: 8101, name: "Action" }]);
      expect(preferenceWrites).toEqual([]);
    }
    expect((await page.request.post("/api/auth/logout")).status()).toBe(204);
  }

  // Safe return context survives moving between similar movies.
  await page.goto("/search?q=astronaut+rescue+moon#results");
  await expect(page.getByRole("heading", { name: "Moon Rescue" })).toBeVisible();
  await page.getByRole("link", { name: "View details for Moon Rescue", exact: true }).click();
  const back = page.getByRole("link", { name: "Back to search", exact: true });
  await expect(back).toHaveAttribute("href", "/search?q=astronaut+rescue+moon#results");
  await expect(titles.first()).toBeVisible();
  await section.getByRole("link", { name: "View details for Orbit Medic", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Orbit Medic", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to search", exact: true })).toHaveAttribute("href", "/search?q=astronaut+rescue+moon#results");
  await page.getByRole("link", { name: "Back to search", exact: true }).click();
  await expect(page.getByRole("searchbox", { name: "Title or description" })).toHaveValue("astronaut rescue moon");
});

test("S07 delayed real similar response for movie A cannot fill movie B", async ({ page, request }) => {
  test.skip(live, "Delayed responses use the isolated acceptance harness");
  expect((await request.post(`${controls}/scenario/similar-pair`)).ok()).toBe(true);
  const gateState = async (name: string) => (await (await request.get(`${controls}/gates/${name}`)).json());
  try {
    await request.post(`${controls}/gates/similar-stale/arm`);
    await page.goto(`/movies/${similarSource}`);
    await waitForResponseGate(request, controls, "similar-stale", `/api/movies/${similarSource}/similar`);
    const held = (await gateState("similar-stale")).responses[0].body.data.movies.map((movie: { title: string }) => movie.title);
    expect(held).toEqual(["Moon Rescue", "Orbit Medic"]);
    await request.post(`${controls}/gates/similar-stale/seal`);
    await expect(page.getByText("Loading similar movies...", { exact: true })).toBeVisible();

    // Leave A while its response is held, then open B through the public Search page.
    await page.getByRole("link", { name: "Search", exact: true }).click();
    await page.getByRole("searchbox", { name: "Title or description" }).fill("Moon Rescue");
    await page.getByRole("searchbox", { name: "Title or description" }).press("Enter");
    await page.getByRole("link", { name: "View details for Moon Rescue", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Moon Rescue", level: 1 })).toBeVisible();
    const own = await similarApi(request, "20000000-0000-0000-0000-000000000002");
    const titles = page.locator(".similar-movies article.movie-card h2");
    await expect(titles).toHaveText(own.map(movie => movie.title));
    expect(own.map(movie => movie.title)).not.toContain("Moon Rescue");

    await releaseResponseGate(request, controls, "similar-stale");
    await expect(titles).toHaveText(own.map(movie => movie.title));
    await expect(page.locator(".similar-movies").getByRole("heading", { name: "Moon Rescue" })).toHaveCount(0);
  } finally {
    await request.post(`${controls}/release-gates`);
  }
});

test("Home title sort precedes paging and button links preserve detail return in both themes", async ({ page, request }) => {
  test.skip(live, "Fixture regression uses its own migrated catalogue");
  const ascending = [];
  const initial = await (await request.get("/api/movies?limit=10")).json();
  for (let index = 1; index <= initial.meta.totalPages; index++) {
    const body = await (await request.get(`/api/movies?limit=10&page=${index}`)).json();
    ascending.push(...body.data.movies.map((movie: { title: string }) => movie.title));
  }
  expect(ascending.length).toBeGreaterThan(10);
  for (const theme of ["dark", "light"]) {
    for (const width of [1440, 375]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/?page=2&source=t01#catalogue-shelf");
      await expect(page.locator("article.movie-card").first()).toBeVisible();
      if (await page.locator("html").getAttribute("data-theme") !== theme)
        await page.getByRole("button", { name: `Switch to ${theme} theme` }).click();
      await page.getByLabel("Sort by title", { exact: true }).selectOption("title_desc");
      await expect(page).toHaveURL(/sort=title_desc/);
      await expect(page.getByText(`Showing 1-10 of ${ascending.length} movies`, { exact: true })).toBeVisible();
      expect(new URL(page.url()).searchParams.get("page")).toBe("1");
      const titles = page.locator("article.movie-card h2");
      await expect(titles).toHaveText([...ascending].reverse().slice(0, 10));
      const detail = page.locator("article.movie-card").first().getByRole("link");
      await expectActionButton(detail);
      await detail.focus(); await expect(detail).toBeFocused();
      await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab");
      await expect(detail).toBeFocused();
      expect(await detail.evaluate(node => getComputedStyle(node).outlineStyle)).not.toBe("none");
      await noOverflow(page);
      await screenshot(page, `buttons-sort-home-${width}-${theme}-fixture`);
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await expect(titles).toHaveText([...ascending].reverse().slice(10));
      await page.reload();
      await expect(page.getByLabel("Sort by title")).toHaveValue("title_desc");
      await expect(titles).toHaveText([...ascending].reverse().slice(10));
      await page.locator("article.movie-card").first().getByRole("link").focus();
      await page.keyboard.press("Enter");
      const back = page.getByRole("link", { name: "Return to catalogue", exact: true });
      await expectActionButton(back);
      await screenshot(page, `buttons-return-details-${width}-${theme}-fixture`);
      await noOverflow(page);
      await back.click();
      await expect(page.getByLabel("Sort by title")).toHaveValue("title_desc");
      await expect(titles).toHaveText([...ascending].reverse().slice(10));
      expect(new URL(page.url()).searchParams.get("source")).toBe("t01");
      expect(new URL(page.url()).hash).toBe("#catalogue-shelf");
    }
  }
  await page.goto("/popular");
  await expect(page.locator("article.movie-card").first()).toBeVisible();
  await expect(page.getByLabel("Sort by title")).toHaveCount(0);
});

test("personal navigation actions use shared buttons without changing saved genres", async ({ page, request }) => {
  test.skip(live, "Synthetic account never writes to an imported database");
  const email = `buttons-${crypto.randomUUID()}@example.test`;
  const password = "buttons-synthetic-only";
  expect((await request.post("/api/auth/register", { data: { email, password } })).status()).toBe(201);
  await page.goto("/login");
  await expectActionButton(page.getByRole("link", { name: "Create an account", exact: true }));
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/");
  await page.getByRole("link", { name: "Preferences", exact: true }).click();
  const action = page.getByRole("checkbox", { name: "Action", exact: true });
  await action.check();
  await page.getByRole("button", { name: "Save preferences", exact: true }).click();
  await expect(page).toHaveURL(/\/recommendations/);
  await page.keyboard.press("Escape");
  let writes = 0;
  page.on("request", request => {
    if (request.method() === "PUT" && request.url().includes("/preferences")) writes++;
  });
  for (const theme of ["dark", "light"]) {
    if (await page.locator("html").getAttribute("data-theme") !== theme)
      await page.getByRole("button", { name: `Switch to ${theme} theme` }).click();
    for (const width of [1440, 375]) {
      await page.setViewportSize({ width, height: 1000 });
      const change = page.getByRole("link", { name: "Change my genres", exact: true });
      await expectActionButton(change);
      await expectActionButton(page.getByRole("link", { name: "Browse the catalogue", exact: true }));
      await screenshot(page, `buttons-recommendations-${width}-${theme}-fixture`);
      await change.click();
      await expect(action).toBeChecked();
      const back = page.getByRole("link", { name: "Back to recommendations", exact: true });
      await expectActionButton(back);
      await noOverflow(page);
      await back.click();
      await expect(page.locator("article.movie-card").first()).toBeVisible();
      await page.locator("article.movie-card").first().getByRole("link").click();
      const returnLink = page.getByRole("link", { name: "Back to recommendations", exact: true });
      await expectActionButton(returnLink);
      await returnLink.click();
      await expect(page.locator("article.movie-card").first()).toBeVisible();
    }
  }
  expect(writes).toBe(0);
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
  await expect(page.getByRole("radio")).toHaveCount(10);
  let writes = 0;
  page.on("request", r => { if (r.method() === "PUT" && r.url().includes("/rating")) writes++; });
  const three = page.getByRole("radio", { name: "3 stars", exact: true });
  await three.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: "3.5 stars", exact: true })).toBeChecked();
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
  await page.setViewportSize({ width: 375, height: 900 });
  const mobileBox = (await feedback.boundingBox())!;
  const closeBox = (await feedback.getByRole("button", { name: "Dismiss notification" }).boundingBox())!;
  expect(closeBox.width).toBeGreaterThanOrEqual(44);
  expect(closeBox.height).toBeGreaterThanOrEqual(44);
  expect(Math.abs(mobileBox.x + mobileBox.width / 2 - 375 / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(mobileBox.y + mobileBox.height / 2 - 900 / 2)).toBeLessThanOrEqual(1);
  await noOverflow(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
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

  const ascending: string[] = [];
  const descending: string[] = [];
  const initial = await (await page.request.get("/api/movies?limit=10")).json();
  expect(initial.meta.total).toBeGreaterThanOrEqual(200);
  expect(initial.meta.total).toBeLessThanOrEqual(300);
  for (let index = 1; index <= initial.meta.totalPages; index++) {
    for (const [sort, target] of [["title_asc", ascending], ["title_desc", descending]] as const) {
      const result = await page.request.get(`/api/movies?limit=10&page=${index}&sort=${sort}&catalogueRevision=${initial.meta.catalogueRevision}`);
      expect(result.status()).toBe(200);
      const body = await result.json();
      expect(body.meta.total).toBe(initial.meta.total);
      target.push(...body.data.movies.map((movie: { title: string }) => movie.title));
    }
  }
  expect(descending).toEqual([...ascending].reverse());
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByLabel("Sort by title").selectOption("title_desc");
  await expect(page.locator("article.movie-card h2")).toHaveText(descending.slice(0, 10));
  if (await page.locator("html").getAttribute("data-theme") !== "dark")
    await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await settlePublicPosters(page);
  await screenshot(page, "buttons-sort-home-1440-dark-imported");
  await page.setViewportSize({ width: 375, height: 1000 });
  if (await page.locator("html").getAttribute("data-theme") !== "light")
    await page.getByRole("button", { name: "Switch to light theme" }).click();
  await screenshot(page, "buttons-sort-home-375-light-imported");
  await noOverflow(page);
  await page.locator("article.movie-card").first().getByRole("link").click();
  const back = page.getByRole("link", { name: "Return to catalogue", exact: true });
  await expectActionButton(back);
  await screenshot(page, "buttons-return-details-375-light-imported");
  await back.click();
  await expect(page.getByLabel("Sort by title")).toHaveValue("title_desc");
  await expect(page.locator("article.movie-card h2")).toHaveText(descending.slice(0, 10));
  expect(errors).toEqual([]);
});
