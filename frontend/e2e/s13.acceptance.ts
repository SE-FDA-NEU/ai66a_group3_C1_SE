import { test as base, expect, type Page, type APIRequestContext } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const controls = "http://127.0.0.1:8014/__acceptance";
const movie = "20000000-0000-0000-0000-000000000001";
const live = process.env.S13_TMDB_SMOKE === "1";
const password = "s13-synthetic-password";
const titles = (page: Page) => page.locator("article.movie-card h2");
const actionTitles = ["A", "B", "D", "F", "H", "J", "L"];
const comedyTitles = ["C", "E", "G", "I", "K"];

// Fresh SQLite connections inspect committed rows, including guest no-write checks.
function databaseRows() {
  const localPython = path.resolve("../.venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  const python = process.env.S04_PYTHON ?? (existsSync(localPython) ? localPython : "python");
  const code = `import sqlite3,json,sys
with sqlite3.connect(sys.argv[1]) as c:
 print(json.dumps({t:c.execute('SELECT * FROM '+t+' ORDER BY 1,2').fetchall() for t in ['user_genre_preferences','user_movie_ratings']}))`;
  return JSON.parse(execFileSync(python, ["-c", code, path.join(process.env.S04_DATABASE_DIR!, "acceptance.db")], { encoding: "utf8" }));
}

const test = base.extend<{ audit: void }>({
  audit: [async ({ page, request, browser }, use, info) => {
    const observations: object[] = [];
    const pending: Promise<void>[] = [];
    page.on("response", response => {
      const url = new URL(response.url());
      if (!url.pathname.startsWith("/api/")) return;
      pending.push((async () => {
        const record: Record<string, unknown> = { method: response.request().method(), path: url.pathname, status: response.status() };
        // Never retain credentials, cookies, session digests or auth payloads.
        if (url.pathname.startsWith("/api/me/")) {
          try { record.body = await response.json(); } catch { record.aborted = true; }
        }
        observations.push(record);
      })());
    });
    if (!live) expect((await request.post(`${controls}/scenario/ranked`)).ok()).toBe(true);
    const ready = await (await request.get(`${controls}/ready`)).json();
    await info.attach("catalogue-provenance.json", { body: JSON.stringify(ready), contentType: "application/json" });
    await use();
    await request.post(`${controls}/release-gates`);
    await Promise.all(pending);
    await info.attach("s13-api-db.json", { body: JSON.stringify({ browser: browser.version(), finalPage: await page.evaluate(() => ({
      path: location.pathname, headings: [...document.querySelectorAll("h1,h2")].map(n => n.textContent),
      alerts: [...document.querySelectorAll('[role="alert"]')].map(n => n.textContent),
      savedRating: document.querySelector(".rating-committed")?.textContent,
    })), observations, committedRows: databaseRows() }, null, 2), contentType: "application/json" });
    // Failed login screenshots must not retain a filled password field.
    if (await page.locator('input[type="password"]').count()) await page.locator('input[type="password"]').fill("");
    const screenshot = info.outputPath("s13-browser.png");
    await page.screenshot({ path: screenshot, fullPage: true });
    await info.attach("s13-browser.png", { path: screenshot, contentType: "image/png" });
  }, { auto: true }],
});

async function register(request: APIRequestContext) {
  const email = `s13-${crypto.randomUUID()}@example.test`;
  expect((await request.post("/api/auth/register", { data: { email, password } })).status()).toBe(201);
  return email;
}

async function login(page: Page, email: string) {
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  const session = page.waitForResponse(r => r.url().endsWith("/api/auth/login"));
  const recommendations = page.waitForResponse(r => new URL(r.url()).pathname === "/api/me/recommendations");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  expect((await session).status()).toBe(200);
  expect((await recommendations).status()).toBe(200);
  await expect(page).toHaveURL(/\/recommendations$/);
  await expect(page.getByText(email, { exact: false })).toBeVisible();
  expect((await page.request.get("/api/auth/me")).status()).toBe(200);
}

async function saveGenre(page: Page, genre: string) {
  await page.getByRole("link", { name: "Change my genres", exact: true }).click();
  await page.getByRole("checkbox", { name: genre, exact: true }).check();
  await page.getByRole("button", { name: "Save preferences", exact: true }).click();
  await expect(page).toHaveURL(/\/recommendations$/);
}

async function signOut(page: Page) {
  const response = page.waitForResponse(r => r.url().endsWith("/api/auth/logout"));
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  expect((await response).status()).toBe(204);
  await expect(page).toHaveURL("/");
}

test("S13 AC2: unknown email and incorrect password have the exact same visible message", async ({ page, request }) => {
  test.skip(live, "Synthetic acceptance runs separately from TMDb smoke");
  const email = await register(request);
  await page.goto("/");
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  for (const credentials of [{ email: "unknown-s13@example.test", password }, { email, password: "wrong-password" }]) {
    await page.getByLabel("Email", { exact: true }).fill(credentials.email);
    await page.getByLabel("Password", { exact: true }).fill(credentials.password);
    const response = page.waitForResponse(r => r.url().endsWith("/api/auth/login"));
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    expect((await response).status()).toBe(401);
    await expect(page.getByRole("alert")).toHaveText("Email or password is incorrect");
    await expect(page).toHaveURL(/\/login$/);
    expect((await page.context().cookies()).some(c => c.name === "ams_session")).toBe(false);
  }
});

test("S13 AC3: guest routes and rating CTA reach login without private requests or writes", async ({ page }) => {
  test.skip(live, "Synthetic acceptance runs separately from TMDb smoke");
  const before = databaseRows();
  const privateRequests: string[] = [];
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/me/")) privateRequests.push(`${request.method()} ${url.pathname}`);
  });
  for (const route of ["/preferences", "/recommendations", "/profile"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/);
  }
  // Separate negative detail URL check, not a required discovery journey.
  await page.goto("/movies/m3-nonexistent-movie");
  await expect(page.getByRole("heading", { name: "Movie not found", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Return to catalogue", exact: true }).click();
  await expect(page).toHaveURL("/");
  await page.goto(`/movies/${movie}`);
  await page.getByRole("link", { name: "Sign in to rate this movie", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(privateRequests).toEqual([]);
  expect(databaseRows()).toEqual(before);
});

test("S13 AC1/AC4/AC5: real login, save, logout/replay, switch, delayed A response and relogin", async ({ page, request, playwright }, info) => {
  test.skip(live, "Synthetic acceptance runs separately from TMDb smoke");
  const a = await register(request);
  const b = await register(request);
  await page.goto("/");
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await login(page, a);
  await saveGenre(page, "Action");
  await expect(titles(page)).toHaveText(actionTitles);
  await page.locator(`a[href="/movies/${movie}"]`).click();
  await page.getByLabel("Your rating (1 to 5)").selectOption("5");
  await page.getByRole("button", { name: "Save rating", exact: true }).click();
  await expect(page.getByText("Your saved rating: 5/5", { exact: true })).toBeVisible();
  const savedA = databaseRows();
  await page.getByRole("link", { name: "Back to recommendations", exact: true }).click();
  await expect(titles(page)).toHaveText(actionTitles);
  await page.getByRole("link", { name: "Change my genres", exact: true }).click();
  expect((await request.post(`${controls}/gates/s13-old/arm`)).ok()).toBe(true);
  await page.getByRole("link", { name: "Back to recommendations", exact: true }).click();
  await expect.poll(async () => (await (await request.get(`${controls}/gates/s13-old`)).json()).responses.length).toBeGreaterThan(0);
  expect((await request.post(`${controls}/gates/s13-old/seal`)).ok()).toBe(true);
  const cookies = await page.context().cookies();
  await signOut(page);
  expect(databaseRows()).toEqual(savedA);
  expect((await page.context().cookies()).some(c => c.name === "ams_session")).toBe(false);
  // Replay in an independent client, without persisting the secret to artifacts.
  const replay = await playwright.request.newContext({ baseURL: "http://127.0.0.1:5174", storageState: { cookies, origins: [] } });
  try { expect((await replay.get("/api/me/preferences")).status()).toBe(401); }
  finally { await replay.dispose(); }
  const afterLogout: string[] = [];
  const track = (r: import("@playwright/test").Request) => {
    if (new URL(r.url()).pathname.startsWith("/api/me/")) afterLogout.push(r.url());
  };
  page.on("request", track);
  await page.getByRole("link", { name: "Start", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  page.off("request", track);
  expect(afterLogout).toEqual([]);
  await login(page, b);
  await page.getByRole("link", { name: "Change my genres", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Action", exact: true })).not.toBeChecked();
  await page.getByRole("checkbox", { name: "Comedy", exact: true }).check();
  await page.getByRole("button", { name: "Save preferences", exact: true }).click();
  await expect(titles(page)).toHaveText(comedyTitles);
  expect((await request.post(`${controls}/gates/s13-old/release`)).ok()).toBe(true);
  await expect.poll(async () => {
    const state = await (await request.get(`${controls}/gates/s13-old`)).json();
    return state.completed === state.responses.length;
  }).toBe(true);
  const delayed = await (await request.get(`${controls}/gates/s13-old`)).json();
  for (const response of delayed.responses) {
    expect(response.status).toBe(200);
    expect(response.body.data.movies.map((m: { title: string }) => m.title)).toEqual(actionTitles);
  }
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(titles(page)).toHaveText(comedyTitles);
  await expect(page.getByText(a, { exact: false })).toHaveCount(0);
  expect(await page.locator(`a[href="/movies/${movie}"]`).count()).toBe(0);
  await page.goto(`/movies/${movie}`);
  await expect(page.getByText("Not rated yet", { exact: true })).toBeVisible();
  await page.getByLabel("Your rating (1 to 5)").selectOption("2");
  await page.getByRole("button", { name: "Save rating", exact: true }).click();
  await expect(page.getByText("Your saved rating: 2/5", { exact: true })).toBeVisible();
  await page.goto("/recommendations");
  await expect(titles(page)).toHaveText(comedyTitles);
  await signOut(page);
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await login(page, a);
  await expect(titles(page)).toHaveText(actionTitles);
  await page.getByRole("link", { name: "Change my genres", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Action", exact: true })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Comedy", exact: true })).not.toBeChecked();
  await page.getByRole("link", { name: "Back to recommendations", exact: true }).click();
  await page.locator(`a[href="/movies/${movie}"]`).click();
  await expect(page.getByText("Your saved rating: 5/5", { exact: true })).toBeVisible();
  await info.attach("delayed-account-a.json", { body: JSON.stringify(delayed, null, 2), contentType: "application/json" });
});

test("S13 live TMDb environment smoke (separate from synthetic acceptance)", async ({ page, request }) => {
  test.skip(!live, "Opt in with S13_TMDB_SMOKE=1; use accepted DB or server-only TMDb token");
  const ready = await (await request.get(`${controls}/ready`)).json();
  expect(ready.catalogue[0]).toBe("tmdb");
  expect(ready.catalogue[2]).toBeGreaterThan(0);
  const a = await register(request);
  const b = await register(request);
  // Pick a genre of the top public movie so the same movie can later be
  // reached by B through visible public catalogue navigation.
  const catalogue = await (await request.get("/api/movies?limit=10")).json();
  const publicMovie = catalogue.data.movies.find((movie: { genres: unknown[] }) => movie.genres.length > 0);
  expect(publicMovie).toBeTruthy();
  await page.goto("/");
  await page.getByRole("link", { name: "Start", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, a);
  await page.getByRole("link", { name: "Change my genres", exact: true }).click();
  await page.getByRole("checkbox", { name: publicMovie.genres[0].name, exact: true }).check();
  await page.getByRole("button", { name: "Save preferences", exact: true }).click();
  await expect(page).toHaveURL(/\/recommendations$/);
  await expect(titles(page).first()).toBeVisible();
  const preferences = await (await page.request.get("/api/me/preferences")).json();
  const ranked = await (await page.request.get("/api/me/recommendations")).json();
  const detail = page.locator(`article.movie-card a[href="/movies/${publicMovie.id}"]`);
  const href = (await detail.getAttribute("href"))!;
  await detail.click();
  await page.getByLabel("Your rating (1 to 5)").selectOption("4");
  await page.getByRole("button", { name: "Save rating", exact: true }).click();
  await expect(page.getByText("Your saved rating: 4/5", { exact: true })).toBeVisible();
  expect(await (await page.request.get("/api/me/recommendations")).json()).toEqual(ranked);
  await page.getByRole("link", { name: "Back to recommendations", exact: true }).click();
  await signOut(page);
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await login(page, b);
  expect((await (await page.request.get("/api/me/preferences")).json()).data.genres).toEqual([]);
  await page.getByRole("link", { name: "Browse the catalogue", exact: true }).click();
  await page.locator(`article.movie-card a[href="${href}"]`).click();
  await expect(page.getByText("Not rated yet", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Return to catalogue", exact: true }).click();
  await page.getByRole("link", { name: "My recommendations", exact: true }).click();
  await signOut(page);
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await login(page, a);
  expect(await (await page.request.get("/api/me/preferences")).json()).toEqual(preferences);
  await page.getByRole("link", { name: "Browse the catalogue", exact: true }).click();
  await page.locator(`article.movie-card a[href="${href}"]`).click();
  await expect(page.getByText("Your saved rating: 4/5", { exact: true })).toBeVisible();
});
