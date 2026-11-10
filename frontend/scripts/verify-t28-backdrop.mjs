/** Independent T28: actual Chromium + React + FastAPI + disposable SQLite.
 * Default mode is synthetic and denies all external image/provider networking.
 * --live-database copies an accepted imported SQLite DB read-only; no import,
 * account writes, real token, provider payload fixture or database upload.
 */
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const UI = "http://127.0.0.1:5173";
const API = "http://127.0.0.1:8000";
const ids = { a: "t28-movie-a", b: "t28-movie-b", c: "t28-movie-c" };
const title = { a: "Backdrop Alpha", b: "Backdrop Beta", c: "Backdrop Gamma" };
const args = process.argv.slice(2);
function option(name, fallback) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`Missing ${name} value`);
  return args[index + 1];
}
for (let i = 0; i < args.length; i += 2) {
  if (!["--evidence-dir", "--live-database"].includes(args[i])) throw new Error("Unknown T28 option");
}
const source = option("--live-database", null);
const live = source !== null;
const evidence = path.resolve(ROOT, option("--evidence-dir", `frontend/test-results/t28-${live ? "live" : "synthetic"}`));
const git = (...values) => execFileSync("git", values, { cwd: ROOT, encoding: "utf8" }).trim();
const hash = (value) => createHash("sha256").update(value).digest("hex");
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const children = [];
let temporary, browser;
const report = { mode: live ? "manual-tmdb-copy" : "synthetic-offline", result: "FAIL", cases: [] };

async function identity() {
  const files = git("ls-files", "--cached", "--others", "--exclude-standard", "-z").split("\0")
    .filter((file) => /^(backend\/(app|alembic|tests)\/|frontend\/src\/)/.test(file) || [
      "backend/scripts/t28_backdrop_server.py", "backend/tests/support/backdrop_acceptance.py",
      "backend/tests/test_backdrop_acceptance.py", "frontend/scripts/verify-t28-backdrop.mjs",
      "frontend/package.json", "backend/requirements.lock.txt", "frontend/package-lock.json",
      ".github/workflows/backdrop-acceptance.yml",
    ].includes(file)).sort();
  const digest = createHash("sha256");
  for (const file of files) {
    digest.update(file + "\0");
    digest.update((await readFile(path.join(ROOT, file), "utf8")).replace(/\r\n/g, "\n"));
    digest.update("\0");
  }
  return { testedCommit: git("rev-parse", "HEAD"), workingTree: git("status", "--short") ? "modified" : "clean",
    sourceSha256Lf: digest.digest("hex"), sourceFiles: files, testedAt: new Date().toISOString(), node: process.version };
}

async function freePort(port) {
  await new Promise((done, fail) => {
    const server = createServer();
    server.once("error", () => fail(new Error(`Port ${port} is occupied; no existing server was stopped`)));
    server.listen(port, "127.0.0.1", () => server.close(done));
  });
}

function start(command, values, cwd, env) {
  const child = spawn(command, values, { cwd, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let error;
  child.on("error", (reason) => { error = reason; });
  // Do not capture auth headers/cookies or upload unfiltered server logs.
  child.stdout.on("data", () => {});
  child.stderr.on("data", () => {});
  children.push(child);
  return () => { if (error) throw error; if (child.exitCode !== null) throw new Error("Temporary server exited early"); };
}

async function stopChildren() {
  for (const child of children.reverse()) {
    if (!child.pid || child.exitCode !== null || child.signalCode !== null) continue;
    if (process.platform === "win32") {
      const code = await new Promise((done, fail) => {
        const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
          windowsHide: true, stdio: "ignore",
        });
        killer.once("error", fail);
        killer.once("close", done);
      });
      if (code !== 0 && child.exitCode === null && child.signalCode === null) {
        child.kill("SIGTERM");
      }
      if (child.exitCode === null && child.signalCode === null) {
        await Promise.race([new Promise((done) => child.once("close", done)), sleep(5000)]);
      }
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
        await Promise.race([new Promise((done) => child.once("close", done)), sleep(5000)]);
      }
      if (child.exitCode === null && child.signalCode === null) {
        throw new Error(`Temporary server ${child.pid} did not stop`);
      }
    } else {
      child.kill("SIGTERM");
      await Promise.race([new Promise((done) => child.once("close", done)), sleep(2000)]);
      if (child.exitCode === null) child.kill("SIGKILL");
    }
  }
}

async function api(route, payload) {
  const response = await fetch(API + route, payload === undefined ? {} : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  assert.equal(response.status, 200, `Control ${route}: ${response.status}`);
  return response.json();
}

async function caseRun(name, expected, action) {
  try {
    const actual = await action();
    report.cases.push({ name, expected, actual: actual ?? "Assertions passed", result: "PASS" });
    console.log(`PASS ${name}`);
  } catch (error) {
    report.cases.push({ name, expected, result: "FAIL", error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

async function metrics(page) {
  return page.evaluate(() => {
    const hero = document.querySelector(".movie-detail__hero");
    const image = hero?.querySelector("img");
    const heading = hero?.querySelector("h1");
    return { viewport: innerWidth, documentWidth: document.documentElement.scrollWidth,
      title: heading?.textContent, imageSrc: image?.getAttribute("src") ?? null,
      imageNaturalWidth: image?.naturalWidth ?? 0, imageOpacity: image ? getComputedStyle(image).opacity : null,
      gradient: hero ? getComputedStyle(hero).backgroundImage : null,
      overlay: hero ? getComputedStyle(hero, "::after").backgroundImage : null };
  });
}

async function assertHero(page, expectedTitle, image) {
  // A catalogue card has the same title in an h2. In a fast headless run it
  // can still be visible just after click; only the detail hero h1 proves
  // that navigation and the real detail request have completed.
  await expect(page.locator(".movie-detail__hero h1")).toHaveText(expectedTitle);
  await expect(page.locator(".movie-detail__hero h1")).toBeVisible();
  if (image) {
    await expect(page.locator(".movie-detail__hero-image--loaded")).toBeVisible();
    await expect(page.locator(".movie-detail__hero-image--loaded")).toHaveCSS("opacity", "1");
    await expect.poll(() => page.locator(".movie-detail__hero-image").evaluate((el) => el.naturalWidth)).toBeGreaterThan(0);
  }
  else await expect(page.locator(".movie-detail__hero-image")).toHaveCount(0);
  // Sample one coherent ready hero rather than assuming an absent image
  // (also true on the catalogue/loading page) proves a null-media detail.
  let value;
  await expect.poll(async () => {
    value = await metrics(page);
    report.lastHeroSnapshot = value;
    return value.title === expectedTitle &&
      typeof value.gradient === "string" && typeof value.overlay === "string";
  }, { message: `Ready hero snapshot for ${expectedTitle}` }).toBe(true);
  delete report.lastHeroSnapshot;
  assert(value.documentWidth <= value.viewport, "Horizontal overflow");
  assert(value.gradient.includes("linear-gradient") && value.overlay.includes("linear-gradient"));
  if (image) assert(value.imageNaturalWidth > 0 && value.imageOpacity === "1");
  return value;
}

async function imageContext({ width = 1280, mode = "normal" } = {}) {
  const context = await browser.newContext({ viewport: { width, height: width === 375 ? 812 : 900 } });
  const state = { mode, release: null, requested: [], unexpected: [], credentialsSeen: false };
  await context.route("**/*", async (route) => {
    const request = route.request(); const url = new URL(request.url());
    if (url.origin === UI || url.origin === API) return route.continue();
    if (url.hostname !== "image.tmdb.org" || live) {
      state.unexpected.push(url.host); return route.abort();
    }
    state.requested.push(url.pathname);
    const headers = await request.allHeaders();
    state.credentialsSeen ||= Boolean(headers.authorization || headers.cookie || headers["x-api-key"] || url.search);
    if (state.mode === "broken") return route.abort("failed");
    if (state.mode === "hold-alpha" && url.pathname.endsWith("/t28-alpha.jpg")) {
      await new Promise((done) => { state.release = done; });
    }
    try {
      await route.fulfill({ status: 200, contentType: "image/svg+xml", body:
        `<svg xmlns="http://www.w3.org/2000/svg" width="780" height="440"><rect width="780" height="440" fill="${state.mode === "dark" ? "#050505" : "#ffffff"}"/></svg>` });
    } catch (error) {
      if (!/closed|cancel|handled|intercept/i.test(String(error))) throw error;
    }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  return { page, state, close: async () => {
    state.release?.();
    await context.close();
    assert.deepEqual(state.unexpected, [], "Unexpected external/provider request");
    assert.equal(state.credentialsSeen, false, "Credential in CDN request");
  } };
}

async function catalogue(page) {
  await page.goto(UI);
  await expect(page.getByRole("link", { name: "View details for Backdrop Alpha", exact: true })).toBeVisible();
}
async function recommendationTitles(page, expected) {
  // Home has the same number of cards. Its count is not evidence that the
  // protected route/request has finished; reading during unmount can yield [].
  await expect(page).toHaveURL(UI + "/recommendations");
  await expect(page.getByRole("heading", { name: "Recommendations", exact: true })).toBeVisible();
  const titles = page.locator("article.movie-card h2");
  await expect(titles).toHaveText(expected);
  return titles.allTextContents();
}
async function open(page, key) {
  await page.getByRole("link", { name: `View details for ${title[key]}`, exact: true }).click();
}
async function gateCaptured(pathname) {
  await expect.poll(async () => (await api("/__t28/gate"))[pathname]?.captured).toBe(true);
}

async function synthetic() {
  for (const [name, key, width, mode, image] of [
    ["bright-desktop", "a", 1280, "normal", true], ["bright-mobile", "a", 375, "normal", true],
    ["dark-mobile", "c", 375, "dark", true], ["null-mobile", "b", 375, "normal", false],
    ["broken-mobile", "a", 375, "broken", false],
  ]) {
    await caseRun(name, "Correct movie, readable gradient/overlay, no overflow", async () => {
      const run = await imageContext({ width, mode });
      try {
        await catalogue(run.page); await open(run.page, key);
        const actual = await assertHero(run.page, title[key], image);
        if (image) assert(actual.imageSrc.endsWith(key === "a" ? "/t28-alpha.jpg" : "/t28-gamma.jpg"));
        await run.page.keyboard.press("Tab");
        await expect(run.page.locator(".movie-detail__return")).toBeFocused();
        assert.equal(await run.page.locator(".movie-detail__return").evaluate((el) => getComputedStyle(el).outlineWidth), "3px");
        await run.page.screenshot({ path: path.join(evidence, `synthetic-${name}.png`), fullPage: true });
        await run.page.getByRole("link", { name: "Return to catalogue", exact: true }).click();
        await expect(run.page.getByRole("link", { name: `View details for ${title[key]}`, exact: true })).toBeVisible();
        return actual;
      } finally { await run.close(); }
    });
  }
  await caseRun("delayed-real-details-A-to-B", "Delayed SQL/API response A cannot replace B", async () => {
    const run = await imageContext();
    try {
      await catalogue(run.page);
      await api("/__t28/hold", { path: `/api/movies/${ids.a}` });
      await open(run.page, "a"); await gateCaptured(`/api/movies/${ids.a}`);
      await expect(run.page.getByText("Loading movie...", { exact: true })).toBeVisible();
      await run.page.goBack(); await open(run.page, "b");
      await assertHero(run.page, title.b, false);
      await api("/__t28/release", {});
      await expect.poll(async () => Object.keys(await api("/__t28/gate")).length).toBe(0);
      return await assertHero(run.page, title.b, false);
    } finally { await api("/__t28/release", {}); await run.close(); }
  });
  await caseRun("delayed-image-events-A-to-C", "Old image load/error cannot change the new movie", async () => {
    const run = await imageContext({ mode: "hold-alpha" });
    try {
      await catalogue(run.page); await open(run.page, "a");
      await expect(run.page.getByRole("heading", { name: title.a, exact: true })).toBeVisible();
      await expect.poll(() => Boolean(run.state.release)).toBe(true);
      await run.page.evaluate(() => { window.__t28OldImage = document.querySelector(".movie-detail__hero-image"); });
      await run.page.getByRole("link", { name: "Return to catalogue", exact: true }).click();
      await open(run.page, "c"); await assertHero(run.page, title.c, true);
      run.state.release();
      await run.page.evaluate(() => {
        window.__t28OldImage.dispatchEvent(new Event("error"));
        window.__t28OldImage.dispatchEvent(new Event("load"));
      });
      return await assertHero(run.page, title.c, true);
    } finally { await run.close(); }
  });
  await caseRun("broken-A-does-not-poison-C", "A failed image state resets for another movie", async () => {
    const run = await imageContext({ mode: "broken" });
    try {
      await catalogue(run.page); await open(run.page, "a"); await assertHero(run.page, title.a, false);
      run.state.mode = "normal";
      await run.page.getByRole("link", { name: "Return to catalogue", exact: true }).click();
      await open(run.page, "c"); return await assertHero(run.page, title.c, true);
    } finally { await run.close(); }
  });
  await caseRun("account-rating-and-delayed-old-account", "A rating 5 cannot replace B rating 2", async () => {
    const run = await imageContext();
    async function login(user) {
      await run.page.getByLabel("Email", { exact: true }).fill(`t28-${user}@example.test`);
      await run.page.getByLabel("Password", { exact: true }).fill("t28-synthetic-password");
      await run.page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(run.page).toHaveURL(UI + "/");
      await run.page.getByRole("link", { name: "My recommendations", exact: true }).click();
      await expect(run.page.getByRole("heading", { name: "Recommendations", exact: true })).toBeVisible();
    }
    try {
      await run.page.goto(UI + "/login"); await login("a");
      await api("/__t28/hold", { path: `/api/me/ratings/${ids.a}` });
      await open(run.page, "a"); await assertHero(run.page, title.a, true);
      await gateCaptured(`/api/me/ratings/${ids.a}`);
      await run.page.getByRole("link", { name: "Back to recommendations", exact: true }).click();
      await run.page.getByRole("button", { name: "Sign out", exact: true }).click();
      await run.page.getByRole("link", { name: "Sign in", exact: true }).click();
      await login("b");
      await run.page.getByRole("link", { name: "Browse the catalogue", exact: true }).click();
      await open(run.page, "a");
      await expect(run.page.getByText("Your saved rating: 2/5", { exact: true })).toBeVisible();
      await api("/__t28/release", {});
      await expect.poll(async () => Object.keys(await api("/__t28/gate")).length).toBe(0);
      await expect(run.page.getByText("Your saved rating: 5/5", { exact: true })).toHaveCount(0);
      await expect(run.page.getByText("Your saved rating: 2/5", { exact: true })).toBeVisible();
      return "Real login/logout, delayed A rating discarded; B=2/5";
    } finally { await api("/__t28/release", {}); await run.close(); }
  });
  await caseRun("delayed-rating-movie-A-to-B", "A saved rating cannot reappear on unrated movie B", async () => {
    const run = await imageContext();
    try {
      await run.page.goto(UI + "/login");
      await run.page.getByLabel("Email", { exact: true }).fill("t28-a@example.test");
      await run.page.getByLabel("Password", { exact: true }).fill("t28-synthetic-password");
      await run.page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(run.page).toHaveURL(UI + "/");
      await run.page.getByRole("link", { name: "My recommendations", exact: true }).click();
      await expect(run.page.getByRole("heading", { name: "Recommendations", exact: true })).toBeVisible();
      await api("/__t28/hold", { path: `/api/me/ratings/${ids.a}` });
      await open(run.page, "a"); await gateCaptured(`/api/me/ratings/${ids.a}`);
      await run.page.getByRole("link", { name: "Back to recommendations", exact: true }).click();
      await open(run.page, "b");
      await expect(run.page.getByText("Not rated yet", { exact: true })).toBeVisible();
      await api("/__t28/release", {});
      await expect.poll(async () => Object.keys(await api("/__t28/gate")).length).toBe(0);
      await expect(run.page.getByText("Not rated yet", { exact: true })).toBeVisible();
      await expect(run.page.getByText("Your saved rating: 5/5", { exact: true })).toHaveCount(0);
      return await assertHero(run.page, title.b, false);
    } finally { await api("/__t28/release", {}); await run.close(); }
  });
  await caseRun("UI-ranking-after-media-only-update", "A90/B80/C80 and saved genres stay identical after enrichment", async () => {
    const run = await imageContext();
    try {
      await run.page.goto(UI + "/login");
      await run.page.getByLabel("Email", { exact: true }).fill("t28-a@example.test");
      await run.page.getByLabel("Password", { exact: true }).fill("t28-synthetic-password");
      await run.page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(run.page).toHaveURL(UI + "/");
      // Force the real recommendation response to remain pending. Empty
      // destination cards must not be mistaken for completed ranked results.
      await api("/__t28/hold", { path: "/api/me/recommendations" });
      await run.page.getByRole("link", { name: "My recommendations", exact: true }).click();
      await gateCaptured("/api/me/recommendations");
      await expect(run.page.getByRole("heading", { name: "Recommendations", exact: true })).toBeVisible();
      await expect(run.page.locator("article.movie-card")).toHaveCount(0);
      await api("/__t28/release", {});
      const before = await recommendationTitles(run.page, [title.a, title.b, title.c]);
      assert.deepEqual(before, [title.a, title.b, title.c]);
      const preferences = await (await run.page.context().request.get(UI + "/api/me/preferences")).json();
      const audit = await api("/__t28/enrich/valid", {});
      assert(audit.rankingPreserved && audit.nonMediaRowsPreserved);
      await run.page.reload();
      assert.deepEqual(await recommendationTitles(run.page, before), before);
      assert.deepEqual(await (await run.page.context().request.get(UI + "/api/me/preferences")).json(), preferences);
      await open(run.page, "a");
      const actual = await assertHero(run.page, title.a, true);
      assert(actual.imageSrc.endsWith("/t28-enriched-101.jpg"));
      await expect(run.page.getByText("Your saved rating: 5/5", { exact: true })).toBeVisible();
      await run.page.getByRole("link", { name: "Back to recommendations", exact: true }).click();
      assert.deepEqual(await recommendationTitles(run.page, before), before);
      return { before, after: before, unchangedPreferences: true, ownRating: 5, newMediaVisible: true };
    } finally { await api("/__t28/release", {}); await run.close(); }
  });
  for (const scenario of ["valid", "valid", "missing", "invalid", "failure", "clear"]) {
    await caseRun(`media-audit-${scenario}-${report.cases.length}`, "All non-media rows and account ranking preserved", async () => {
      const result = await api(`/__t28/enrich/${scenario}`, {});
      assert.equal(result.result, "PASS");
      if (scenario === "valid" && result.counts.updated_movie_count === 0) assert.equal(result.counts.unchanged_movie_count, 3);
      return result;
    });
  }
  await caseRun("actual-API-null-and-unknown", "200/null after clear, unknown 404", async () => {
    const response = await fetch(API + `/api/movies/${ids.a}`); const body = await response.json();
    assert.equal(response.status, 200); assert.equal(body.data.movie.backdropUrl, null);
    const unknown = await fetch(API + "/api/movies/t28-unknown");
    const unknownBody = await unknown.json();
    assert.equal(unknown.status, 404); assert.equal(unknownBody.error.code, "MOVIE_NOT_FOUND");
    return { noMedia: body, unknown: unknownBody };
  });
}

async function manual(provenance) {
  assert.equal(provenance.provider, "tmdb");
  const selected = provenance.movies.find((movie) => movie.backdropUrl);
  assert(selected, "Live-image acceptance blocked: no actual imported backdrop");
  report.provenance = { ...provenance, movies: undefined,
    sample: { id: selected.id, sourceId: selected.sourceId, title: selected.title, sourceFetchedAt: selected.sourceFetchedAt } };
  const context = await browser.newContext();
  const page = await context.newPage(); const unexpected = []; let credentials = false;
  const statuses = [];
  await context.route("**/*", async (route) => {
    const request = route.request(); const url = new URL(request.url());
    if (![UI, API, "https://image.tmdb.org"].includes(url.origin)) { unexpected.push(url.host); return route.abort(); }
    if (url.hostname === "image.tmdb.org") {
      const headers = await request.allHeaders();
      credentials ||= Boolean(headers.authorization || headers.cookie || headers["x-api-key"] || url.search);
    }
    return route.continue();
  });
  page.on("response", (response) => { if (new URL(response.url()).hostname === "image.tmdb.org") statuses.push(response.status()); });
  try {
    for (const width of [1280, 375]) {
      await caseRun(`manual-real-image-${width}`, "Imported own image loads from public CDN; no overflow", async () => {
        await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
        await page.goto(UI + "/movies/" + encodeURIComponent(selected.id));
        const actual = await assertHero(page, selected.title, true);
        assert.equal(actual.imageSrc, selected.backdropUrl);
        await page.screenshot({ path: path.join(evidence, `live-${width}.png`), fullPage: true });
        return actual;
      });
    }
    const missing = provenance.movies.find((movie) => movie.backdropUrl === null);
    if (missing) {
      await page.goto(UI + "/movies/" + encodeURIComponent(missing.id));
      await assertHero(page, missing.title, false);
      await page.screenshot({ path: path.join(evidence, "live-null-375.png"), fullPage: true });
      report.liveNullMovie = { id: missing.id, title: missing.title, result: "PASS" };
    }
    assert.deepEqual(unexpected, []); assert.equal(credentials, false);
    assert(statuses.some((status) => status === 200));
    report.cdn = { statuses, unexpectedHosts: unexpected, credentialsSeen: credentials };
  } finally { await context.close(); }
}

async function main() {
  Object.assign(report, await identity());
  await mkdir(evidence, { recursive: true });
  await freePort(8000); await freePort(5173);
  temporary = await mkdtemp(path.join(tmpdir(), "t28-backdrop-"));
  const python = process.env.T28_PYTHON ?? (existsSync(path.join(ROOT, ".venv"))
    ? path.join(ROOT, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python") : "python");
  report.python = execFileSync(python, ["--version"], { encoding: "utf8" }).trim();
  const env = { ...process.env, PYTHONUTF8: "1", PYTHONPATH: path.join(ROOT, "backend"),
    TMDB_READ_ACCESS_TOKEN: "", T28_TEMP_DIR: temporary, T28_DATABASE_PATH: path.join(temporary, "acceptance.db"), T28_LIVE: live ? "1" : "0" };
  const setupArgs = ["backend/scripts/t28_backdrop_server.py", "--prepare", ...(live ? ["--copy-from", path.resolve(ROOT, source)] : [])];
  const provenance = JSON.parse(execFileSync(python, setupArgs, { cwd: ROOT, env, encoding: "utf8" }));
  const sourceHash = live ? hash(await readFile(path.resolve(ROOT, source))) : null;
  const apiAlive = start(python, ["backend/scripts/t28_backdrop_server.py"], ROOT, env);
  const uiAlive = start(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5173", "--strictPort"], path.join(ROOT, "frontend"), env);
  let ready = false;
  for (let i = 0; i < 80; i++) {
    apiAlive(); uiAlive();
    try { if ((await fetch(API + "/__t28/ready")).ok && (await fetch(UI)).ok) { ready = true; break; } } catch { /* readiness polling */ }
    await sleep(200);
  }
  assert(ready, "Temporary API/UI startup timed out");
  const executablePath = process.env.T28_BROWSER ?? [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].find((candidate) => existsSync(candidate));
  browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), headless: true });
  report.browser = browser.version();
  if (live) {
    await manual(provenance);
    assert.equal(hash(await readFile(path.resolve(ROOT, source))), sourceHash, "Original live database changed");
    report.originalDatabaseUnchanged = true;
  } else await synthetic();
  report.result = "PASS";
}

async function cleanup() {
  await browser?.close(); await stopChildren();
  if (temporary) {
    assert.equal(path.dirname(path.resolve(temporary)), path.resolve(tmpdir()), "Unsafe cleanup root");
    assert(path.basename(temporary).startsWith("t28-backdrop-"), "Unsafe cleanup target");
    await rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}
process.on("SIGINT", () => { void cleanup().finally(() => process.exit(130)); });
process.on("SIGTERM", () => { void cleanup().finally(() => process.exit(143)); });
try {
  await main();
} catch (error) {
  report.error = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
} finally {
  await cleanup();
  report.temporaryDatabaseRemoved = temporary ? !existsSync(temporary) : true;
  await mkdir(evidence, { recursive: true });
  const output = JSON.stringify(report, null, 2) + "\n";
  assert(!/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|ghp_[A-Za-z0-9]{36}/.test(output), "Credential-shaped value in evidence");
  await writeFile(path.join(evidence, "results.json"), output);
  const passed = report.cases.filter(item => item.result === "PASS").length;
  const failed = report.cases.filter(item => item.result === "FAIL").length;
  console.log(`T28 ${report.mode}: ${report.result}; ${passed} passed cases; ${failed} failed cases; temporary_database_removed=${report.temporaryDatabaseRemoved}`);
  if (report.error) console.error(report.error);
}
