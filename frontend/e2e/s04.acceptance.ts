import { test as base, expect, type Page, type Response, type APIRequestContext, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";

const fixture = JSON.parse(readFileSync(new URL("../../backend/tests/fixtures/s04_browser_acceptance.json", import.meta.url), "utf8"));
const topTen = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
const matched = ["A", "B", "D", "F", "H", "J", "L"];
const controls = "http://127.0.0.1:8014/__acceptance";
const cards = (page: Page) => page.locator("article.movie-card");
const recommendationResponse = (page: Page) => page.waitForResponse(
  (response) => new URL(response.url()).pathname === "/api/me/recommendations",
);

async function control(request: APIRequestContext, operation: string) {
  const response = await request.post(`${controls}/${operation}`);
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function screenshot(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(name);
  await page.screenshot({ path, fullPage: true, mask: [page.locator(".session-actions .muted")] });
  await info.attach(name, { path, contentType: "image/png" });
}

// Log recommendation/genre/preference JSON, never auth bodies, headers,
// cookies or passwords. Responses originate in the real FastAPI app.
const test = base.extend<{ apiEvidence: void }>({
  apiEvidence: [async ({ page, request, browser }, use, info) => {
    const evidence: object[] = [];
    const preferenceEvidence: object[] = [];
    const pending: Promise<void>[] = [];
    page.on("response", (response) => {
      const url = new URL(response.url());
      const isRecommendation = url.pathname === "/api/me/recommendations";
      if (!isRecommendation && url.pathname !== "/api/me/preferences" && url.pathname !== "/api/genres") return;
      const output = isRecommendation ? evidence : preferenceEvidence;
      pending.push((async () => {
        try {
          output.push({ method: response.request().method(), path: url.pathname + url.search,
            status: response.status(), body: await response.json() });
        } catch {
          output.push({ path: url.pathname + url.search, status: response.status(), aborted: true });
        }
      })());
    });
    const seed = await control(request, "scenario/ranked");
    expect(seed).toMatchObject({ activeMovies: 13, finitePopularity: 12 });
    const ready = await (await request.get(`${controls}/ready`)).json();
    await info.attach("database-fixture.json", { body: JSON.stringify({ ready, seed }, null, 2), contentType: "application/json" });
    await use();
    await control(request, "release-gates");
    await Promise.all(pending);
    await info.attach("recommendations-api.json", {
      body: JSON.stringify(evidence, null, 2), contentType: "application/json",
    });
    await info.attach("preferences-api.json", {
      body: JSON.stringify(preferenceEvidence, null, 2), contentType: "application/json",
    });
    await info.attach("browser-version.txt", { body: browser.version(), contentType: "text/plain" });
    await screenshot(page, info, "browser.png");
  }, { auto: true }],
});

async function signIn(page: Page, request: APIRequestContext) {
  const credentials = { email: `s04-${crypto.randomUUID()}@example.test`, password: "Synthetic-s04-password" };
  expect((await request.post("/api/auth/register", { data: credentials })).status()).toBe(201);
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(credentials.email);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/");
  const response = recommendationResponse(page);
  await page.getByRole("link", { name: "My recommendations", exact: true }).click();
  await expect(page).toHaveURL(/\/recommendations$/);
  const result = await response;
  const preferences = await page.request.get("/api/me/preferences");
  expect(preferences.status()).toBe(200);
  expect((await preferences.json()).data.genres).toEqual([]);
  const cookie = (await page.context().cookies()).find((item) => item.name === "ams_session");
  expect(cookie?.httpOnly).toBe(true);
  return result;
}

async function assertResult(response: Response, titles: string[], personalised = false, noMatch = false) {
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.data).toMatchObject({ mode: personalised ? "personalised" : "popular", personalised, noMatch });
  expect(body.data.movies.map((movie: { title: string }) => movie.title)).toEqual(titles);
  const ids = body.data.movies.map((movie: { id: string }) => movie.id);
  expect(new Set(ids).size).toBe(titles.length);
  expect(titles.length).toBeLessThanOrEqual(10);
  for (const movie of body.data.movies) {
    const row = fixture.movies.find((candidate: { id: string }) => candidate.id === movie.id);
    expect(movie.title).toBe(row.title);
    expect(movie.popularityScore).toBe(row.popularity);
    expect(movie.reason.matchedGenres).toEqual(personalised ? [{ id: 8101, name: "Action" }] : []);
    expect(movie.genres.map((genre: { id: number }) => genre.id)).toEqual(row.genreIds);
  }
  expect(body.meta).toMatchObject({ count: titles.length, limit: 10 });
  expect([fixture.revision, "s04-empty"]).toContain(body.meta.catalogueRevision);
}

async function assertCards(page: Page, titles: string[], personalised = false) {
  await expect(cards(page).locator("h2")).toHaveText(titles);
  const hrefs = await cards(page).getByRole("link").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(hrefs).toEqual(titles.map((title) => `/movies/${fixture.movies.find((row: { title: string }) => row.title === title).id}`));
  expect(new Set(hrefs).size).toBe(titles.length);
  const reasons = page.locator(".movie-reason");
  await expect(reasons).toHaveCount(personalised ? titles.length * 2 : 0);
  if (personalised) {
    await expect(reasons.filter({ hasText: "No effective rating adjustment." })).toHaveCount(titles.length);
    await expect(reasons.filter({ hasText: "Matches your genres: Action" })).toHaveCount(titles.length);
    await expect(cards(page).getByText("Personal adjusted score")).toHaveCount(titles.length);
  }
}

async function saveGenre(page: Page, genre: string) {
  await page.getByRole("checkbox", { name: genre, exact: true }).check();
  const saved = page.waitForResponse((response) => response.url().endsWith("/api/me/preferences") && response.request().method() === "PUT");
  const refreshed = recommendationResponse(page);
  await page.getByRole("button", { name: "Save preferences", exact: true }).click();
  expect((await saved).status()).toBe(200);
  await expect(page).toHaveURL(/\/recommendations$/);
  return refreshed;
}

test("AC1/AC2/AC4: real sign-in, A90 B80 C80 top ten, Enter preferences and fresh matches", async ({ page, request }, info) => {
  await assertResult(await signIn(page, request), topTen);
  await assertCards(page, topTen);
  // T18 covers field-by-field rendering in React tests. Reuse this migrated
  // synthetic fixture to verify the missing-field seam in a real browser/API.
  const detailResponse = page.waitForResponse(r => new URL(r.url()).pathname === `/api/movies/${fixture.movies[0].id}`);
  await cards(page).getByRole("link").first().click();
  const detail = (await (await detailResponse).json()).data.movie;
  expect(detail.releaseYear).toBeNull();
  expect(detail.overview).toBeNull();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("A");
  await expect(page.getByText("Information unavailable", { exact: true })).toHaveCount(2);
  await expect(page.locator(".movie-detail__facts")).toContainText("Action");
  await screenshot(page, info, "missing-detail-fields.png");
  await page.getByRole("link", { name: "Back to recommendations", exact: true }).click();
  await assertCards(page, topTen);
  await expect(page.getByText("Not personalised", { exact: true })).toBeVisible();
  await screenshot(page, info, "cold-start.png");
  await page.getByRole("link", { name: "Enter preferences" }).click();
  await expect(page).toHaveURL(/\/preferences$/);
  await expect(page.getByRole("checkbox", { name: "Action", exact: true })).not.toBeChecked();
  await screenshot(page, info, "preferences.png");
  await assertResult(await saveGenre(page, "Action"), matched, true);
  await assertCards(page, matched, true);
  await expect(page.getByRole("heading", { name: "Recommended for you" })).toBeVisible();
  await expect(page.getByText("Not personalised", { exact: true })).toHaveCount(0);
  expect((await (await page.request.get("/api/me/preferences")).json()).data.genres).toEqual([{ id: 8101, name: "Action" }]);
});

test("AC4: saved genres with no match show true popular alternatives and edit/retry", async ({ page, request }) => {
  await signIn(page, request);
  await page.getByRole("link", { name: "Enter preferences" }).click();
  await expect(page.getByRole("checkbox", { name: "Archive", exact: true })).toBeVisible();
  await control(request, "scenario/no-match");
  await assertResult(await saveGenre(page, "Archive"), topTen, false, true);
  await assertCards(page, topTen);
  await expect(page.getByRole("heading", { name: "No movies matched your favourite genres." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Popular alternatives", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit preferences", exact: true })).toHaveAttribute("href", "/preferences");
  const retried = recommendationResponse(page);
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await assertResult(await retried, topTen, false, true);
  await assertCards(page, topTen);
});

for (const scenario of ["empty", "no-popularity"]) {
  test(`AC3: successful ${scenario} shows guidance and zero cards`, async ({ page, request }) => {
    const state = await control(request, `scenario/${scenario}`);
    expect(state).toMatchObject({ activeMovies: scenario === "empty" ? 0 : 13, finitePopularity: 0 });
    await test.info().attach("empty-fixture.json", { body: JSON.stringify(state, null, 2), contentType: "application/json" });
    await assertResult(await signIn(page, request), []);
    await expect(page.getByRole("heading", { name: "No recommendations available yet." })).toBeVisible();
    await expect(cards(page)).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Enter preferences" })).toHaveAttribute("href", "/preferences");
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Retry" })).toHaveCount(0);
  });
}

test("AC4: no-match without usable popular alternatives still has edit/retry and zero cards", async ({ page, request }) => {
  await signIn(page, request);
  await page.getByRole("link", { name: "Enter preferences" }).click();
  await expect(page.getByRole("checkbox", { name: "Archive", exact: true })).toBeVisible();
  await control(request, "scenario/no-match-no-popularity");
  await assertResult(await saveGenre(page, "Archive"), [], false, true);
  await expect(page.getByRole("heading", { name: "No movies matched your favourite genres." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit preferences", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
  await expect(cards(page)).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("real SQL failure is Error/Retry, preserves genres and recovers", async ({ page, request }) => {
  await signIn(page, request);
  await page.getByRole("link", { name: "Enter preferences" }).click();
  await saveGenre(page, "Action");
  const before = await control(request, "scenario/db-failure");
  const failed = recommendationResponse(page);
  await page.reload();
  const response = await failed;
  expect(response.status()).toBe(503);
  expect((await response.json()).error.code).toBe("SERVICE_UNAVAILABLE");
  await expect(page.getByRole("heading", { name: "Recommendations are unavailable" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Service is temporarily unavailable Choose Retry to load your recommendations again.");
  await test.info().attach("actual-error-message.txt", {
    body: await page.getByRole("alert").innerText(), contentType: "text/plain",
  });
  await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
  await expect(cards(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "No recommendations available yet." })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "No movies matched your favourite genres." })).toHaveCount(0);
  await screenshot(page, test.info(), "db-failure.png");
  const after = await control(request, "scenario/ranked");
  expect(after.preferences).toEqual(before.preferences);
  await test.info().attach("db-failure-fixture.json", { body: JSON.stringify({ before, after }, null, 2), contentType: "application/json" });
  const retried = recommendationResponse(page);
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await assertResult(await retried, matched, true);
  await assertCards(page, matched, true);
});

test("delayed real cold-start response cannot replace results after a real genre save", async ({ page, request }, info) => {
  await signIn(page, request);
  await assertCards(page, topTen);
  await page.getByRole("link", { name: "Enter preferences" }).click();
  await expect(page.getByRole("checkbox", { name: "Action", exact: true })).toBeVisible();
  await control(request, "gates/old/arm");
  await page.getByRole("link", { name: "Back to recommendations", exact: true }).click();
  await expect.poll(async () => (await (await request.get(`${controls}/gates/old`)).json()).responses.length).toBeGreaterThan(0);
  await expect(cards(page)).toHaveCount(0);
  await page.getByRole("link", { name: "Change my genres", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Action", exact: true })).toBeVisible();
  await control(request, "gates/old/seal");
  await control(request, "gates/fresh/arm");
  await page.getByRole("checkbox", { name: "Action", exact: true }).check();
  const committed = page.waitForResponse((response) => response.url().endsWith("/api/me/preferences") && response.request().method() === "PUT");
  await page.getByRole("button", { name: "Save preferences", exact: true }).click();
  expect((await committed).status()).toBe(200);
  await expect(page).toHaveURL(/\/recommendations$/);
  await expect.poll(async () => (await (await request.get(`${controls}/gates/fresh`)).json()).responses.length).toBeGreaterThan(0);
  await expect(cards(page)).toHaveCount(0);
  await expect(page.getByText("Loading recommendations...", { exact: true })).toBeVisible();
  await expect(page.getByText("Not personalised", { exact: true })).toHaveCount(0);
  await screenshot(page, info, "fresh-loading.png");
  await control(request, "gates/fresh/seal");
  const refreshed = recommendationResponse(page);
  await control(request, "gates/fresh/release");
  await assertResult(await refreshed, matched, true);
  await assertCards(page, matched, true);
  await control(request, "gates/old/release");
  await expect.poll(async () => {
    const gate = await (await request.get(`${controls}/gates/old`)).json();
    return gate.completed === gate.responses.length;
  }).toBe(true);
  const old = await (await request.get(`${controls}/gates/old`)).json();
  const fresh = await (await request.get(`${controls}/gates/fresh`)).json();
  for (const response of old.responses) {
    expect(response.status).toBe(200);
    expect(response.body.data.personalised).toBe(false);
    expect(response.body.data.movies.map((movie: { title: string }) => movie.title)).toEqual(topTen);
  }
  for (const response of fresh.responses) expect(response.body.data.personalised).toBe(true);
  // Allow Chromium to process the released network activity and paint.
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await assertCards(page, matched, true);
  await expect(page.getByText("Not personalised", { exact: true })).toHaveCount(0);
  await info.attach("delayed-real-api.json", { body: JSON.stringify({ old, fresh }, null, 2), contentType: "application/json" });
});
