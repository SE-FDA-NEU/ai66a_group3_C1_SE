/** Final-candidate seams only. Reuse T12/T14/T22/T23 for exhaustive cases.
 * node frontend/scripts/verify-m3-handoff.mjs <accepted.db> <evidence-directory>
 * Copies the accepted TMDb snapshot with SQLite backup; never imports or seeds.
 */
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir, platform, release, arch } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";

const root = fileURLToPath(new URL("../..", import.meta.url));
const [source, destination] = process.argv.slice(2);
assert(source && destination, "Provide accepted database and evidence directory");
const output = path.resolve(destination);
const localPython = path.join(root, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const python = process.env.M3_PYTHON ?? (existsSync(localPython) ? localPython : "python");
const ui = "http://127.0.0.1:5173";
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const py = (code, ...args) => execFileSync(python, ["-c", code, ...args], { cwd: root, encoding: "utf8" }).trim();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const children = [];
const report = {
  testedCommit: git("rev-parse", "HEAD"), workingTree: git("status", "--short"),
  testedAt: new Date().toISOString(), mode: "live-tmdb-existing-snapshot-copy",
  os: `${platform()} ${release()} ${arch()}`, node: process.version,
  python: execFileSync(python, ["--version"], { encoding: "utf8" }).trim(),
  result: "FAIL", checks: [], messages: {}, requests: [],
};
const check = name => report.checks.push({ name, result: "PASS" });
let temporary, browser, activePage;

function start(command, args, env) {
  const child = spawn(command, args, { cwd: root, env, stdio: "ignore" });
  child.on("error", () => {});
  children.push(child);
  return child;
}
async function ready(url, child) {
  for (let i = 0; i < 120; i++) {
    assert.equal(child.exitCode, null, "Acceptance server exited before readiness");
    try { if ((await fetch(url)).ok) return; } catch { /* startup */ }
    await sleep(250);
  }
  throw new Error("Acceptance server readiness timed out");
}
async function freePort(port) {
  await new Promise((resolve, reject) => {
    const socket = createServer();
    socket.once("error", reject);
    socket.listen(port, "127.0.0.1", () => socket.close(resolve));
  });
}
const provenance = database => JSON.parse(py(`import sqlite3,json,sys
with sqlite3.connect('file:'+sys.argv[1]+'?mode=ro',uri=True) as c:
 c.row_factory=sqlite3.Row
 queries={
 'revision': '''SELECT r.id,r.provider,r.created_at,r.inserted_movie_count,r.updated_movie_count,r.rejected_movie_count FROM catalogue_state s JOIN catalogue_revisions r ON r.id=s.active_revision_id WHERE s.id=1''',
 'counts': '''SELECT COUNT(*) movies,COUNT(DISTINCT m.source_id) distinct_source_ids,SUM(CASE WHEN m.source<>'tmdb' THEN 1 ELSE 0 END) non_tmdb,SUM(CASE WHEN abs(m.popularity_score)<=1.7976931348623157e308 THEN 1 ELSE 0 END) finite_popularity,COUNT(m.source_fetched_at) fetch_timestamps,MIN(m.source_fetched_at) first_fetched_at,MAX(m.source_fetched_at) last_fetched_at,SUM(m.release_year IS NULL) missing_year,SUM(m.overview IS NULL) missing_overview FROM catalog_movies m JOIN catalogue_state s ON s.active_revision_id=m.catalogue_revision_id''',
 'associated_genres': '''SELECT COUNT(DISTINCT mg.genre_id) count FROM movie_genres mg JOIN catalog_movies m ON m.id=mg.movie_id JOIN catalogue_state s ON s.active_revision_id=m.catalogue_revision_id''',
 'samples': '''SELECT m.id,m.source,m.source_id,m.source_fetched_at FROM catalog_movies m JOIN catalogue_state s ON s.active_revision_id=m.catalogue_revision_id ORDER BY m.source_id LIMIT 3''',
 'migration': 'SELECT version_num FROM alembic_version'}
 print(json.dumps({k:[dict(r) for r in c.execute(q)] for k,q in queries.items()}))`, database));

try {
  await mkdir(output, { recursive: true });
  // Identify application files against the exact committed candidate. The only
  // added executable is this verifier; its hash is recorded independently.
  const application = git("ls-files", "backend/app", "backend/alembic", "frontend/src").split("\n");
  for (const file of application) {
    assert.equal(Buffer.compare(await readFile(path.join(root, file)), execFileSync("git", ["show", `HEAD:${file}`], { cwd: root })), 0, `Uncommitted application file: ${file}`);
  }
  report.verifierSha256 = createHash("sha256").update(await readFile(fileURLToPath(import.meta.url))).digest("hex");
  await freePort(8000); await freePort(5173);
  const sourcePath = path.resolve(source);
  report.sourceProvenance = provenance(sourcePath);
  assert.equal(report.sourceProvenance.revision[0].provider, "tmdb");
  assert.equal(report.sourceProvenance.counts[0].non_tmdb, 0);
  assert(report.sourceProvenance.counts[0].finite_popularity >= 10);
  temporary = await mkdtemp(path.join(tmpdir(), "m3-handoff-"));
  const database = path.join(temporary, "acceptance.db");
  py(`import sqlite3,sys
with sqlite3.connect('file:'+sys.argv[1]+'?mode=ro',uri=True) as s, sqlite3.connect(sys.argv[2]) as d: s.backup(d)`, sourcePath, database);
  const env = { ...process.env, DATABASE_URL: `sqlite:///${database.replaceAll("\\", "/")}`, TMDB_READ_ACCESS_TOKEN: "", SESSION_COOKIE_SECURE: "false" };
  execFileSync(python, ["-m", "alembic", "-c", "backend/alembic.ini", "upgrade", "head"], { cwd: root, env, stdio: "pipe" });
  report.acceptanceProvenance = provenance(database);
  assert.deepEqual(report.acceptanceProvenance.revision, report.sourceProvenance.revision);
  const api = start(python, ["-m", "uvicorn", "app.main:app", "--app-dir", "backend", "--host", "127.0.0.1", "--port", "8000"], env);
  const vite = start(process.execPath, ["frontend/node_modules/vite/bin/vite.js", "frontend", "--host", "127.0.0.1", "--port", "5173", "--strictPort"], env);
  await ready("http://127.0.0.1:8000/health", api); await ready(ui, vite);
  browser = await chromium.launch();
  report.browser = browser.version();
  const context = await browser.newContext({ baseURL: ui, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  activePage = page;
  page.on("request", r => {
    const url = new URL(r.url());
    if (url.pathname.startsWith("/api/")) report.requests.push({ method: r.method(), path: url.pathname });
  });
  page.on("response", r => {
    const url = new URL(r.url());
    if (url.pathname.startsWith("/api/")) report.requests.push({ status: r.status(), path: url.pathname });
  });
  const response = (route, method = "GET") => page.waitForResponse(r => new URL(r.url()).pathname === route && r.request().method() === method);
  const cards = () => page.locator("article.movie-card");
  const json = async route => { const r = await page.request.get(route); assert.equal(r.status(), 200); return r.json(); };
  const userCount = () => Number(py("import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); print(c.execute('SELECT COUNT(*) FROM users').fetchone()[0])", database));
  const noOverflow = async () => assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.goto(ui);
  await expect(cards()).toHaveCount(10);
  await page.screenshot({ path: path.join(output, "live-first-screen.png"), fullPage: true });
  await page.getByRole("link", { name: "Popular movies", exact: true }).click();
  const popular = await json("/api/movies/popular?limit=10");
  assert.equal(popular.meta.catalogueRevision, report.acceptanceProvenance.revision[0].id);
  assert.equal(popular.data.movies.length, 10);
  await expect(cards().locator("h2")).toHaveText(popular.data.movies.map(m => m.title));
  assert.equal(new Set(popular.data.movies.map(m => m.id)).size, 10);
  assert(popular.data.movies.every(m => Number.isFinite(m.popularityScore)));
  const oracle = JSON.parse(py(`import sqlite3,json,sys
c=sqlite3.connect(sys.argv[1]); print(json.dumps([r[0] for r in c.execute('SELECT m.id FROM catalog_movies m JOIN catalogue_state s ON s.active_revision_id=m.catalogue_revision_id WHERE abs(m.popularity_score)<=1.7976931348623157e308 ORDER BY m.popularity_score DESC,m.title,m.id LIMIT 10')]))`, database));
  assert.deepEqual(popular.data.movies.map(m => m.id), oracle);
  await cards().getByRole("link").first().click();
  const detailId = new URL(page.url()).pathname.split("/").at(-1);
  const detail = (await json(`/api/movies/${detailId}`)).data.movie;
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(detail.title);
  await expect(page.locator(".movie-detail__facts")).toContainText(String(detail.releaseYear));
  await expect(page.locator(".movie-detail__body")).toContainText(detail.overview);
  await expect(page.getByRole("link", { name: "Back to popular movies" })).toBeVisible();
  assert.equal(report.requests.filter(r => r.path.startsWith("/api/me/")).length, 0);
  await page.getByRole("link", { name: "Sign in to rate this movie" }).click();
  await expect(page).toHaveURL(`${ui}/login`);
  assert.equal(report.requests.filter(r => r.path.startsWith("/api/me/")).length, 0);
  check("Guest first-screen → popular top ten → real public detail → rating login; zero private requests");

  await page.getByRole("link", { name: "Create an account", exact: true }).click();
  await expect(page).toHaveURL(`${ui}/register`);
  await expect(page.locator("#register-email")).toBeVisible();
  const email = `m3-${randomUUID()}@example.test`, password = randomUUID();
  const before = userCount();
  await page.getByLabel("Email", { exact: true }).fill("invalid");
  await page.getByLabel("Password", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  for (const message of ["Enter a valid email address", "Password must be at least 8 characters"]) {
    await expect(page.getByText(message, { exact: true })).toBeVisible(); report.messages[message] = message;
  }
  assert.equal(userCount(), before);
  await page.getByLabel("Password", { exact: true }).fill("");
  await page.screenshot({ path: path.join(output, "live-registration-validation.png"), fullPage: true });
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  report.stage = "valid registration";
  const registered = response("/api/auth/register", "POST");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  const registration = await registered;
  assert.equal(registration.status(), 201);
  const registrationBody = await registration.json();
  assert.deepEqual(Object.keys(registrationBody.data.user).sort(), ["email", "id"]);
  await expect(page).toHaveURL(`${ui}/login`);
  assert.equal(userCount(), before + 1);
  report.passwordHashOnly = py(`import sqlite3,sys
c=sqlite3.connect(sys.argv[1]); r=c.execute('SELECT password_hash FROM users WHERE email_normalized=?',(sys.argv[2],)).fetchone(); print(bool(r and r[0].startswith('$argon2id$')))`, database, email) === "True";
  assert(report.passwordHashOnly);
  await page.getByRole("link", { name: "Create an account", exact: true }).click();
  await expect(page).toHaveURL(`${ui}/register`);
  await expect(page.locator("#register-email")).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill(email.toUpperCase());
  await page.getByLabel("Password", { exact: true }).fill(password);
  report.stage = "duplicate registration";
  const duplicate = response("/api/auth/register", "POST");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  report.duplicateValidation = await page.locator(".form-error").allTextContents();
  assert.equal((await duplicate).status(), 409);
  await expect(page.getByRole("alert")).toHaveText("This email is already registered");
  report.messages.duplicate = await page.getByRole("alert").innerText();
  assert.equal(userCount(), before + 1);
  check("S12 all four AC: visible registration, invalid fields/no write, case duplicate, Argon2id/public DTO");
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(`${ui}/login`);
  await expect(page.locator("#email")).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  report.stage = "cold-start sign in";
  const coldResponse = response("/api/me/recommendations");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const cold = await (await coldResponse).json();
  assert.equal(cold.data.personalised, false); assert.equal(cold.data.noMatch, false);
  assert.deepEqual(cold.data.movies.map(m => m.id), oracle);
  await expect(page.getByText("Not personalised", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Enter preferences" }).click();
  await expect(page.getByRole("checkbox").first()).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await noOverflow();
  await page.getByRole("button", { name: "Save preferences", exact: true }).click();
  const corrective = "Select at least one genre (up to 5), then choose Save preferences.";
  await expect(page.getByRole("alert")).toHaveText(corrective); report.messages.zeroGenres = corrective;
  assert.deepEqual((await json("/api/me/preferences")).data.genres, []);
  await page.screenshot({ path: path.join(output, "live-mobile-corrective-message.png"), fullPage: true });
  const checkbox = page.getByRole("checkbox").first();
  await page.getByRole("link", { name: "Browse the catalogue", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(checkbox).toBeFocused();
  await page.keyboard.press("Space"); await expect(checkbox).toBeChecked();
  report.keyboardFocus = await checkbox.evaluate(el => ({ active: el === document.activeElement, outlineWidth: getComputedStyle(el).outlineWidth }));
  assert(report.keyboardFocus.active); assert.notEqual(report.keyboardFocus.outlineWidth, "0px");
  report.stage = "keyboard save";
  const saved = response("/api/me/preferences", "PUT"), fresh = response("/api/me/recommendations");
  const saveButton = page.getByRole("button", { name: "Save preferences", exact: true });
  for (let tabs = 0; tabs < 30; tabs++) {
    if (await saveButton.evaluate(el => el === document.activeElement)) break;
    await page.keyboard.press("Tab");
  }
  await expect(saveButton).toBeFocused();
  await page.keyboard.press("Enter");
  assert.equal((await saved).status(), 200);
  const personalised = await (await fresh).json();
  assert(personalised.data.personalised || personalised.data.noMatch);
  const genres = (await json("/api/me/preferences")).data.genres;
  assert.equal(genres.length, 1);
  assert(personalised.data.movies.length <= 10);
  assert.equal(new Set(personalised.data.movies.map(m => m.id)).size, personalised.data.movies.length);
  if (personalised.data.personalised) for (const m of personalised.data.movies) {
    assert(m.genres.some(g => genres.some(saved => saved.id === g.id)));
    assert(m.reason.matchedGenres.some(g => genres.some(saved => saved.id === g.id)));
  }
  await expect(cards().locator("h2")).toHaveText(personalised.data.movies.map(m => m.title));
  await noOverflow();
  await page.screenshot({ path: path.join(output, "live-personalised-mobile.png"), fullPage: true, mask: [page.locator(".session-actions .muted")] });
  await cards().getByRole("link").first().click();
  await expect(page.locator(".movie-detail")).toBeVisible(); await noOverflow();
  await page.getByRole("link", { name: "Back to recommendations", exact: true }).click();
  assert.deepEqual((await json("/api/me/preferences")).data.genres, genres);
  await page.getByRole("link", { name: "Change my genres", exact: true }).click();
  await expect(checkbox).toBeChecked();
  check("Cold-start → Enter preferences → corrective BR1 message → keyboard save → fresh current-account result → details → return; 375px no overflow");
  // S01's Start-from-home seam; exhaustive 0/1/5/6 remains in T22.
  await page.getByRole("link", { name: "Browse the catalogue", exact: true }).click();
  await page.getByRole("link", { name: "Start", exact: true }).click();
  await expect(page).toHaveURL(`${ui}/preferences`); await expect(checkbox).toBeChecked();
  check("Signed-in first-screen Start reaches restored genre picker");
  assert.deepEqual(provenance(sourcePath), report.sourceProvenance);
  check("Accepted source database provenance unchanged; all account writes confined to disposable copy");
  report.liveMissingFieldCoverage = "Not exercised: source has no missing year/overview; reuse synthetic T18 evidence";
  report.result = "PASS";
} catch (error) {
  // Do not retain arbitrary error objects, request/response headers or auth data.
  report.failure = { type: error.name, message: String(error.message).replace(/m3-[\w-]+@example\.test/gi, "[test account]") };
  if (activePage) report.visibleErrors = await activePage.locator(".form-error").allTextContents();
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  for (const child of children.reverse()) {
    if (child.exitCode !== null) continue;
    const closed = new Promise(resolve => child.once("close", resolve));
    child.kill("SIGTERM"); await Promise.race([closed, sleep(2000)]);
    if (child.exitCode === null) { child.kill("SIGKILL"); await closed; }
  }
  if (temporary) await rm(temporary, { recursive: true, force: true });
  await writeFile(path.join(output, "results.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ result: report.result, checks: report.checks, failure: report.failure }));
}
