/** Controlled S5-T07 public UI account journey. Creates two synthetic accounts. */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const base = process.env.S5_T07_PUBLIC_URL ?? "https://cineai-o9tf.onrender.com";
const origin = new URL(base).origin;
if (process.env.S5_T07_ALLOW_PUBLIC_WRITES !== "1" ||
    !["https://cineai-o9tf.onrender.com", "http://127.0.0.1:8507"].includes(origin)) {
  throw new Error("This probe requires an explicit write opt-in for the intended public origin");
}
const label = origin.startsWith("http://127.") ? "local" : "public";
const output = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../docs/evidence/s5-t07");
await mkdir(output, { recursive: true });
const suffix = randomBytes(6).toString("hex");
const accounts = ["a", "b"].map(label => ({
  label, email: `s5-t07-${suffix}-${label}@example.invalid`,
  password: `S5T07-${randomBytes(18).toString("hex")}`,
}));
const result = { checkedAt: new Date().toISOString(), target: base,
  accounts: "two unique synthetic accounts; credentials kept only in process memory",
  device: "Microsoft Edge headless on this machine, desktop viewport; no physical phone",
  registrationStatuses: [] };

const browser = await chromium.launch({ channel: "msedge", headless: true });
async function newPage() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  return { context, page: await context.newPage() };
}
async function register(page, account) {
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "Create account" }).first().click();
  await page.getByRole("heading", { name: "Create your account" }).waitFor();
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/login", { timeout: 20000 });
}
async function login(page, account) {
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("button", { name: "Sign out" }).waitFor({ timeout: 20000 });
}
async function selectGenre(page, name) {
  await page.getByRole("link", { name: "Preferences" }).first().click();
  await page.getByRole("heading", { name: "Movie Preferences" }).waitFor();
  await page.getByRole("checkbox", { name }).check();
  await page.getByRole("button", { name: /save preferences/i }).click();
  await page.waitForURL("**/recommendations", { timeout: 20000 });
}
async function openFirstMovie(page) {
  await page.getByRole("link", { name: "Home" }).first().click();
  const movie = page.locator('a[href^="/movies/"]').first();
  await movie.waitFor({ timeout: 20000 });
  const href = await movie.getAttribute("href");
  await movie.click();
  await page.locator("main h1").first().waitFor();
  return href;
}

try {
  const a = await newPage();
  a.page.on("response", response => {
    if (response.url().includes("/api/auth/register") && response.request().method() === "POST")
      result.registrationStatuses.push(response.status());
  });
  await register(a.page, accounts[0]);
  result.aRegistered = true;
  await a.page.getByRole("link", { name: "Create an account" }).click();
  await a.page.getByRole("heading", { name: "Create your account" }).waitFor();
  await a.page.waitForTimeout(500);
  await a.page.getByLabel("Email").pressSequentially(accounts[0].email.toUpperCase());
  await a.page.getByLabel("Password").pressSequentially(accounts[0].password);
  assert.equal(await a.page.getByLabel("Email").inputValue(), accounts[0].email.toUpperCase());
  await a.page.getByRole("button", { name: "Create account" }).click();
  await a.page.waitForTimeout(2500);
  result.duplicatePage = a.page.url();
  result.duplicateVisibleErrors = await a.page.locator('[role="alert"], .form-error').allTextContents();
  result.duplicateEmailValid = await a.page.locator("#register-email").evaluate(input => input.checkValidity());
  try {
    await a.page.getByText("This email is already registered", { exact: true }).waitFor({ timeout: 6000 });
    result.duplicateRegistration = "UI displayed duplicate-email refusal";
  } catch {
    result.duplicateRegistration = "UI did not display the expected message";
    throw new Error(`Duplicate registration responses ${result.registrationStatuses.join(",")}; expected UI message absent`);
  }
  await a.page.getByRole("link", { name: "Sign in" }).last().click();
  await login(a.page, accounts[0]);
  await selectGenre(a.page, "Action");
  result.aGenreSaved = "Action";
  const movieHref = await openFirstMovie(a.page);
  result.movieHref = movieHref;
  await a.page.getByRole("button", { name: "Add to watchlist" }).click();
  await a.page.getByText("Saved to your watchlist", { exact: true }).waitFor();
  await a.page.getByRole("radio", { name: "4.5 stars" }).check();
  await a.page.getByRole("button", { name: "Save rating" }).click();
  await a.page.getByText("Your saved rating: 4.5/5").waitFor();
  result.aSaved = { watchlist: true, rating: 4.5 };
  await a.page.reload();
  await a.page.getByText("Your saved rating: 4.5/5").waitFor();
  await a.page.getByText("Saved to your watchlist", { exact: true }).waitFor();
  result.aReloadPersisted = true;
  await a.page.getByRole("button", { name: "Sign out" }).click();
  await a.page.getByRole("link", { name: "Sign in" }).first().click();
  await login(a.page, accounts[0]);
  await a.page.goto(`${base}${movieHref}`, { waitUntil: "domcontentloaded" });
  await a.page.getByText("Your saved rating: 4.5/5").waitFor();
  await a.page.getByText("Saved to your watchlist", { exact: true }).waitFor();
  result.aLaterLoginPersisted = true;

  const b = await newPage();
  await register(b.page, accounts[1]);
  await login(b.page, accounts[1]);
  await selectGenre(b.page, "Drama");
  await b.page.goto(`${base}${movieHref}`, { waitUntil: "domcontentloaded" });
  await b.page.getByText("Not in your watchlist", { exact: true }).waitFor();
  await b.page.getByText("Not rated yet", { exact: true }).waitFor();
  result.bIsolated = { genre: "Drama", watchlist: false, rating: null };
  await b.context.close();
  await a.context.close();
} catch (error) {
  result.failure = String(error.message).slice(0, 300);
  process.exitCode = 1;
} finally {
  await browser.close();
  await writeFile(path.join(output, `${label}-accounts.json`), `${JSON.stringify(result, null, 2)}\n`);
}
console.log(JSON.stringify(result, null, 2));
