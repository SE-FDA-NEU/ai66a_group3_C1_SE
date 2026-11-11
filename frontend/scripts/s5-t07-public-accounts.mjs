/** Opt-in UI write probe, using two reusable app-only accounts in an ignored file. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const base = new URL(process.env.S5_T07_PUBLIC_URL ?? "https://cineai-o9tf.onrender.com").origin;
assert(process.env.S5_T07_ALLOW_PUBLIC_WRITES === "1", "Explicit UI-write opt-in is required");
assert(["https://cineai-o9tf.onrender.com", "http://127.0.0.1:8507"].includes(base), "Unapproved write target");
assert(process.env.S5_T07_ACCOUNTS_FILE, "Set a private, git-ignored reusable accounts file");
const accountFile = path.resolve(root, process.env.S5_T07_ACCOUNTS_FILE);
const relative = path.relative(root, accountFile);
assert(!relative.startsWith("..") && !path.isAbsolute(relative), "Keep probe credentials inside an ignored workspace directory");
execFileSync("git", ["check-ignore", "-q", relative], { cwd: root, stdio: "ignore" });
let accounts;
try { accounts = JSON.parse(await readFile(accountFile, "utf8")); }
catch (error) {
  if (error.code !== "ENOENT" || process.env.S5_T07_CREATE_ACCOUNTS !== "1") throw new Error("Private accounts file missing; explicit creation opt-in is required");
  const suffix = randomBytes(6).toString("hex");
  accounts = ["a", "b"].map(label => ({ label, email: `s5-t07-${suffix}-${label}@example.invalid`, password: `T07-${randomBytes(20).toString("hex")}` }));
  await mkdir(path.dirname(accountFile), { recursive: true });
  await writeFile(accountFile, JSON.stringify(accounts), { mode: 0o600, flag: "wx" });
}
assert.equal(accounts.length, 2, "Exactly two reusable probe accounts are required");
assert.notEqual(accounts[0].email.toLowerCase(), accounts[1].email.toLowerCase(), "A and B must be different accounts");
for (const account of accounts) assert(account.email.endsWith("@example.invalid") && account.password.length >= 8, "Use synthetic app-only probe accounts");
const secrets = accounts.flatMap(account => [account.email, account.email.toUpperCase(), account.password]);
const output = path.resolve(root, process.env.S5_T07_OUTPUT_DIR ?? ".venv/t07ops/results");
const label = base.startsWith("http://127.") ? "local" : "public";
await mkdir(output, { recursive: true });
const result = { checkedAt: new Date().toISOString(), target: base,
  sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  device: "fresh headless Edge desktop contexts; no physical phone", credentials: "reused from private git-ignored file; no credential values recorded", checks: [] };
const browser = await chromium.launch({ channel: "msedge", headless: true });
result.browser = browser.version();
const contexts = [];
async function pageInFreshContext() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  contexts.push(context);
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  return page;
}
async function check(name, action) {
  await action(); result.checks.push({ name, status: "pass" });
}
async function responseFor(page, endpoint, method, action) {
  const [response] = await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname === endpoint && response.request().method() === method), action(),
  ]);
  return response;
}
async function registrationForm(page, account) {
  await page.goto(base, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.getByRole("link", { name: "Create account", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Create your account", exact: true })).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByLabel("Password", { exact: true }).press("Tab");
}
async function register(page, account) {
  await registrationForm(page, account);
  const response = await responseFor(page, "/api/auth/register", "POST", () => page.getByRole("button", { name: "Create account", exact: true }).click());
  assert([201, 409].includes(response.status()), "Registration must create or identify the reusable account");
  if (response.status() === 201) await expect(page).toHaveURL(/\/login$/);
  else {
    await expect(page.getByText("This email is already registered", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Sign in", exact: true }).last().click();
  }
  return response.status();
}
async function login(page, account) {
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  const response = await responseFor(page, "/api/auth/login", "POST", () => page.getByRole("button", { name: "Sign in", exact: true }).click());
  assert.equal(response.status(), 200, "Login was not confirmed by the server");
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
  await expect(page).toHaveURL(`${base}/`);
}
async function nav(page, name) { await page.getByRole("link", { name, exact: true }).first().click(); }
async function selectGenre(page, name) {
  await nav(page, "Preferences");
  await expect(page.getByRole("heading", { name: "Movie Preferences", exact: true })).toBeVisible();
  const boxes = page.getByRole("checkbox");
  await expect(boxes.first()).toBeVisible();
  for (const box of await boxes.all()) if (await box.isChecked()) await box.uncheck();
  await page.getByRole("checkbox", { name, exact: true }).check();
  const response = await responseFor(page, "/api/me/preferences", "PUT", () => page.getByRole("button", { name: /save preferences/i }).click());
  assert.equal(response.status(), 200, "Preference save failed");
  await expect(page).toHaveURL(/\/recommendations(?:\?.*)?$/);
  await expect(page.locator('a[href^="/movies/"]').first()).toBeVisible();
}
async function openFirstMovie(page) {
  await nav(page, "Home");
  const movie = page.locator('a[href^="/movies/"]').first();
  await expect(movie).toBeVisible(); const href = await movie.getAttribute("href");
  await movie.click(); await expect(page.locator(".movie-detail h1")).toBeVisible();
  return href;
}
async function accountData(page, movieId) {
  const preferences = await page.request.get(`${base}/api/me/preferences`);
  const rating = await page.request.get(`${base}/api/me/ratings/${movieId}`);
  const watchlist = await page.request.get(`${base}/api/me/watchlist`);
  for (const response of [preferences, rating, watchlist]) assert.equal(response.status(), 200, "Authenticated confirmation read failed");
  return { genres: (await preferences.json()).data.genres.map(genre => genre.id), rating: (await rating.json()).data.rating,
    watched: (await watchlist.json()).data.movies.some(movie => movie.id === movieId) };
}
try {
  const health = await browser.newContext();
  try {
    const response = await health.request.get(`${base}/health`, { timeout: 90000 });
    result.health = { status: response.status(), body: await response.json() };
    assert.equal(response.status(), 200, "Account probe requires a healthy target");
  } finally { await health.close(); }
  const a = await pageInFreshContext();
  await check("A registration/reusable account and Home login", async () => {
    result.aRegistrationStatus = await register(a, accounts[0]); await login(a, accounts[0]);
  });
  await check("duplicate registration is a real HTTP 409 and actionable UI refusal", async () => {
    const duplicate = await pageInFreshContext();
    await registrationForm(duplicate, { ...accounts[0], email: accounts[0].email.toUpperCase() });
    const response = await responseFor(duplicate, "/api/auth/register", "POST", () => duplicate.getByRole("button", { name: "Create account", exact: true }).click());
    assert.equal(response.status(), 409, "Duplicate registration must reach the server and be refused");
    assert.equal((await response.json()).error.code, "EMAIL_ALREADY_REGISTERED");
    await expect(duplicate.getByText("This email is already registered", { exact: true })).toBeVisible();
    await expect(duplicate.getByRole("link", { name: "Sign in", exact: true }).last()).toBeVisible();
    result.duplicateStatus = response.status();
  });
  let movieHref; let movieId;
  await check("A genres, half-star rating, Watchlist and reload persistence", async () => {
    await selectGenre(a, "Action"); movieHref = await openFirstMovie(a); movieId = movieHref.split("/").at(-1);
    const add = a.getByRole("button", { name: "Add to watchlist", exact: true });
    await expect(a.getByRole("heading", { name: "Your watchlist", exact: true })).toBeVisible();
    await expect.poll(async () => await add.count() + await a.getByRole("button", { name: "Remove from watchlist", exact: true }).count()).toBe(1);
    if (await add.count()) await add.click();
    await expect(a.getByText("Saved to your watchlist", { exact: true })).toBeVisible();
    if ((await accountData(a, movieId)).rating !== 4.5) {
      await a.getByRole("radio", { name: "4.5 stars", exact: true }).check();
      const response = await responseFor(a, `/api/me/ratings/${movieId}`, "PUT", () => a.getByRole("button", { name: "Save rating", exact: true }).click());
      assert.equal(response.status(), 200, "Rating save failed"); result.ratingWrite = "HTTP 200";
    } else result.ratingWrite = "existing 4.5 value verified; no redundant write";
    await expect(a.getByText("Your saved rating: 4.5/5", { exact: true })).toBeVisible();
    await a.reload(); await expect(a.getByText("Your saved rating: 4.5/5", { exact: true })).toBeVisible();
    assert.deepEqual(await accountData(a, movieId), { genres: [28], rating: 4.5, watched: true });
    result.movieId = movieId;
  });
  await check("A sign out/later login preserves server state and session navigation", async () => {
    await a.getByRole("button", { name: "Sign out", exact: true }).click();
    await nav(a, "Sign in"); await login(a, accounts[0]);
    assert.equal(await openFirstMovie(a), movieHref, "Catalogue changed during the account comparison");
    await expect(a.getByText("Your saved rating: 4.5/5", { exact: true })).toBeVisible();
    assert.deepEqual(await accountData(a, movieId), { genres: [28], rating: 4.5, watched: true });
  });
  await check("personalised score metadata, full-set filtering/paging and Details return preserve preferences", async () => {
    const response = await responseFor(a, "/api/me/recommendations", "GET", () => nav(a, "My recommendations"));
    assert.equal(response.status(), 200, "Recommendations failed");
    const baseline = await response.json();
    assert.equal(baseline.data.personalised, true, "Saved genres must select personalised recommendations");
    assert(baseline.data.movies.every(movie => Number.isFinite(movie.adjustedScore) && typeof movie.basis === "string"), "Ranking metadata missing");
    await expect(a.getByText("Ranking score for you", { exact: true }).first()).toBeVisible();
    const filter = a.getByRole("combobox", { name: "Filter by genre", exact: true });
    await expect(filter).toBeEnabled();
    const filteredResponse = await responseFor(a, "/api/me/recommendations", "GET", () => filter.selectOption("35"));
    const filtered = await filteredResponse.json(); assert.equal(filteredResponse.status(), 200);
    assert.equal(filtered.meta.unfilteredTotal, baseline.meta.unfilteredTotal);
    assert(filtered.data.movies.every(movie => movie.genres.some(genre => genre.id === 35)), "Genre filter returned a non-matching movie");
    if (filtered.meta.totalPages > 1) {
      await responseFor(a, "/api/me/recommendations", "GET", () => a.getByRole("navigation", { name: "Movie pages", exact: true }).getByRole("button", { name: "Next", exact: true }).click());
      await expect(a).toHaveURL(url => url.searchParams.get("page") === "2" && url.searchParams.get("genreId") === "35");
    }
    const originalUrl = a.url();
    if (filtered.meta.total > 0) {
      await a.locator('.movie-grid a[href^="/movies/"]').first().click();
      await a.getByRole("link", { name: "Back to recommendations", exact: true }).click();
      await expect(a).toHaveURL(originalUrl); await expect(filter).toHaveValue("35");
    }
    await a.getByRole("button", { name: "Clear filter", exact: true }).click();
    await expect(filter).toHaveValue("");
    assert.deepEqual((await accountData(a, movieId)).genres, [28]);
    result.recommendations = { unfilteredTotal: baseline.meta.unfilteredTotal, comedyTotal: filtered.meta.total, pages: filtered.meta.totalPages, preferencesUnchanged: true };
  });
  const b = await pageInFreshContext();
  await check("B is isolated from A", async () => {
    result.bRegistrationStatus = await register(b, accounts[1]); await login(b, accounts[1]); await selectGenre(b, "Drama");
    assert.equal(await openFirstMovie(b), movieHref, "Catalogue changed during the account comparison");
    assert.deepEqual(await accountData(b, movieId), { genres: [18], rating: null, watched: false });
    await expect(b.getByText("Not rated yet", { exact: true })).toBeVisible();
    await expect(b.getByText("Not in your watchlist", { exact: true })).toBeVisible();
  });
  await check("reset cancellation preserves data; confirmation clears genres/ratings but keeps Watchlist and B", async () => {
    await nav(a, "Profile");
    const button = a.getByRole("button", { name: "Reset personalisation", exact: true }); await expect(button).toBeEnabled();
    await button.click(); const dialog = a.getByRole("dialog", { name: "Reset your personalisation?" });
    await expect(dialog).toBeVisible(); await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.deepEqual(await accountData(a, movieId), { genres: [28], rating: 4.5, watched: true });
    await button.click();
    const response = await responseFor(a, "/api/me/profile/reset", "POST", () => dialog.getByRole("button", { name: "Reset personalisation", exact: true }).click());
    assert.equal(response.status(), 200, "Reset was not confirmed by the server");
    await expect(a.getByTestId("profile-genres-count")).toHaveText("0");
    await expect(a.getByTestId("profile-ratings-count")).toHaveText("0");
    assert.deepEqual(await accountData(a, movieId), { genres: [], rating: null, watched: true });
    assert.deepEqual(await accountData(b, movieId), { genres: [18], rating: null, watched: false });
  });
  await check("Watchlist route/Details return and removal are server-confirmed", async () => {
    await nav(a, "My watchlist"); const previous = a.url();
    await a.locator(`a[href="${movieHref}"]`).first().click();
    await a.getByRole("link", { name: "Back to watchlist", exact: true }).click();
    await expect(a).toHaveURL(previous);
    await a.getByRole("button", { name: /remove.*watchlist/i }).first().click();
    await expect.poll(async () => (await accountData(a, movieId)).watched).toBe(false);
    // Keep both reusable probe accounts clean for the next run.
    assert.deepEqual(await accountData(b, movieId), { genres: [18], rating: null, watched: false });
  });
} catch (error) {
  let message = error.message;
  for (const value of secrets) message = message.split(value).join("<redacted>");
  result.failure = message.slice(0, 400); process.exitCode = 1;
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
  result.technicalPass = !result.failure && result.checks.length === 8;
  result.fullIssueAcceptance = false;
  await writeFile(path.join(output, `${label}-accounts.json`), `${JSON.stringify(result, null, 2)}\n`);
}
console.log(JSON.stringify(result, null, 2));
