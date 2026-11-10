// Run with Node from any directory. Uses installed Playwright and owned servers.
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn, execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
let root = __dirname;
while (!fs.existsSync(path.join(root, 'frontend/package.json'))) root = path.dirname(root);
const { chromium, expect } = require(path.join(root, 'frontend/node_modules/@playwright/test'));
const [database, index, provenanceFile, output] = process.argv.slice(2).map(p => path.resolve(p));
const provenance = JSON.parse(fs.readFileSync(provenanceFile));
const baseURL = 'http://127.0.0.1:5174';
const python = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const env = { ...process.env, DATABASE_URL: `sqlite:///${database}`, NLP_INDEX_PATH: index,
  PYTHONPATH: path.join(root, 'backend'), TMDB_READ_ACCESS_TOKEN: '', TMDB_NETWORK_DISABLED: '1',
  SESSION_COOKIE_SECURE: 'false' };
const result = { runner: 'Codex author verification', date: new Date().toISOString(),
  testedCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  activeRevision: provenance.revision.id, activeCount: provenance.activeCount,
  browserVersion: null, checks: [], screenshots: [], pageErrors: [], metadataRequests: [] };
fs.mkdirSync(output, { recursive: true });
const serverLog = fs.openSync(path.join(output, 'resumed-live-servers.log'), 'w');
let backend, frontend, browser;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function assertPortFree(port) {
  const occupied = await new Promise(resolve => {
    const socket = net.connect({ host: '127.0.0.1', port });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
  });
  assert.equal(occupied, false, `Refusing to reuse existing server on ${port}`);
}
function launchBackend() {
  return spawn(python, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8014'],
    { cwd: root, env, stdio: ['ignore', serverLog, serverLog] });
}
async function ready(url, process) {
  for (let attempt = 0; attempt < 100; attempt++) {
    assert.equal(process.exitCode, null, `Owned server exited: ${url}`);
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return; } catch {}
    await pause(200);
  }
  throw new Error(`Server did not become ready: ${url}`);
}
async function stop(process) {
  if (process && process.exitCode === null) {
    const closed = new Promise(resolve => process.once('close', resolve));
    process.kill('SIGTERM');
    await closed;
  }
}
async function json(context, route) {
  const response = await context.request.get(`${baseURL}${route}`);
  assert.equal(response.status(), 200, route);
  return response.json();
}
function observe(page) {
  page.on('pageerror', error => result.pageErrors.push(error.message));
  page.on('request', request => {
    if (request.url().startsWith('https://api.themoviedb.org/')) result.metadataRequests.push(request.url());
  });
}
async function capture(page, name, fullPage = false) {
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage });
  result.screenshots.push(`${name}.png`);
}
async function layout(page) {
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Horizontal overflow');
}
async function login(page, email) {
  await page.goto(`${baseURL}/login`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Synthetic-t18-browser-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(`${baseURL}/`);
}
(async () => {
  try {
    await assertPortFree(8014); await assertPortFree(5174);
    backend = launchBackend();
    frontend = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--config', 'vite.s04.config.ts',
      '--host', '127.0.0.1', '--port', '5174', '--strictPort'],
      { cwd: path.join(root, 'frontend'), env, stdio: ['ignore', serverLog, serverLog] });
    await ready('http://127.0.0.1:8014/health', backend); await ready(baseURL, frontend);
    browser = await chromium.launch(); result.browserVersion = browser.version();
    const a = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await a.newPage(); observe(page);
    const publicList = await json(a, '/api/movies?limit=10');
    assert.equal(publicList.meta.total, provenance.activeCount);
    assert.equal(publicList.meta.catalogueRevision, provenance.revision.id);
    await page.goto(baseURL);
    await expect(page.locator('article.movie-card')).toHaveCount(10);
    await expect.poll(() => page.locator('article.movie-card img').first()
      .evaluate(img => img.naturalWidth), { timeout: 30000 }).toBeGreaterThan(0);
    await capture(page, 'live-home-1440-dark');
    await page.getByRole('button', { name: 'Switch to light theme' }).click();
    await page.setViewportSize({ width: 375, height: 900 }); await layout(page);
    await capture(page, 'live-home-375-light');
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page).toHaveURL(/page=2/); await expect(page.locator('article.movie-card')).toHaveCount(10);
    const nextIds = (await json(a, '/api/movies?page=2&limit=10')).data.movies.map(m => m.id);
    assert(!nextIds.some(id => publicList.data.movies.some(m => m.id === id)));
    result.checks.push('Home SQL/API total, active revision, pagination and real poster');
    await page.goto(`${baseURL}/popular`);
    const popular = await json(a, '/api/movies/popular?limit=10');
    const movie = popular.data.movies[0];
    const spotlight = page.getByRole('region', { name: 'Popular movie spotlight' });
    await expect(spotlight.getByRole('heading', { level: 2 })).toHaveText(movie.title);
    if (movie.backdropUrl) await expect.poll(() => spotlight.locator('img').first()
      .evaluate(img => img.naturalWidth), { timeout: 30000 }).toBeGreaterThan(0);
    await capture(page, 'live-popular-375-light');
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    const second = await json(a, '/api/movies/popular?page=2&limit=10');
    await expect(spotlight.getByRole('heading', { level: 2 })).toHaveText(second.data.movies[0].title);
    result.checks.push('Popular pages 1/2, current carousel, real backdrop');
    await page.goto(`${baseURL}/search`);
    await page.getByLabel('Title or description').fill(provenance.descriptionQuery);
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.locator('article.movie-card').first()).toBeVisible();
    const searchURL = page.url();
    await page.locator('article.movie-card a[href^="/movies/"]').first().click();
    await page.getByRole('link', { name: 'Back to search', exact: true }).click();
    await expect(page).toHaveURL(searchURL);
    await capture(page, 'live-description-search-375-light');
    result.checks.push('Description Search via submit, non-title query, detail return');
    await page.setViewportSize({ width: 768, height: 1000 });
    await page.goto(`${baseURL}/movies/${movie.id}`);
    await expect(page.getByRole('heading', { name: movie.title, exact: true })).toBeVisible();
    await expect(page.locator('.similar-movies article.movie-card').first()).toBeVisible();
    await expect.poll(() => page.locator('.movie-detail__poster img').evaluate(img => img.naturalWidth),
      { timeout: 30000 }).toBeGreaterThan(0);
    await layout(page); await capture(page, 'live-detail-similar-768-light', true);
    result.checks.push('Detail and local-index Similar on tablet');
    for (const email of ['t18-ui-a@example.test', 't18-ui-b@example.test']) {
      const registered = await a.request.post(`${baseURL}/api/auth/register`, { headers: { Origin: baseURL },
        data: { email, password: 'Synthetic-t18-browser-password' } });
      assert.equal(registered.status(), 201);
    }
    await login(page, 't18-ui-a@example.test');
    assert.equal((await json(a, '/api/me/recommendations')).data.mode, 'popular');
    await page.goto(`${baseURL}/preferences`);
    await page.getByRole('checkbox', { name: movie.genres[0].name, exact: true }).check();
    await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
    await expect(page).toHaveURL(`${baseURL}/recommendations`);
    await expect(page.locator('article.movie-card').first()).toBeVisible();
    const preferences = await json(a, '/api/me/preferences');
    assert.equal((await json(a, '/api/me/recommendations')).data.mode, 'personalised');
    await page.goto(`${baseURL}/movies/${movie.id}`);
    await page.getByRole('radio', { name: '4.5 stars', exact: true }).check();
    await page.getByRole('button', { name: 'Save rating', exact: true }).click();
    await expect(page.getByText('Your saved rating: 4.5/5', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Add to watchlist', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Remove from watchlist', exact: true })).toBeVisible();
    await page.goto(`${baseURL}/watchlist`);
    await expect(page.locator('article.watchlist-card')).toHaveCount(1);
    await expect.poll(() => page.locator('article.watchlist-card img').first().evaluate(img => img.naturalWidth),
      { timeout: 30000 }).toBeGreaterThan(0);
    await capture(page, 'live-watchlist-768-light');
    result.checks.push('A: real UI cold-start, saved genre, personalised ranking, 4.5 stars, watchlist');
    const b = await browser.newContext(); const other = await b.newPage(); observe(other);
    await login(other, 't18-ui-b@example.test');
    assert.deepEqual((await json(b, '/api/me/preferences')).data.genres, []);
    assert.equal((await json(b, `/api/me/ratings/${movie.id}`)).data.rating, null);
    assert.equal((await json(b, '/api/me/watchlist')).meta.total, 0);
    await other.goto(`${baseURL}/movies/${movie.id}`);
    await expect(other.getByText('Not rated yet', { exact: true })).toBeVisible();
    result.checks.push('B: independent session sees no A genres/ratings/watchlist');
    await stop(backend); backend = launchBackend(); await ready('http://127.0.0.1:8014/health', backend);
    await page.reload(); await expect(page.locator('article.watchlist-card')).toHaveCount(1);
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await login(page, 't18-ui-a@example.test');
    assert.deepEqual(await json(a, '/api/me/preferences'), preferences);
    assert.equal((await json(a, `/api/me/ratings/${movie.id}`)).data.rating, 4.5);
    assert.equal((await json(a, '/api/me/watchlist')).meta.total, 1);
    result.checks.push('Backend restart and logout/login preserve A session-owned data');
    await page.goto(`${baseURL}/profile`);
    await page.getByRole('button', { name: 'Reset personalisation', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Reset personalisation', exact: true }).click();
    await expect.poll(async () => (await json(a, '/api/me/preferences')).data.genres).toEqual([]);
    assert.equal((await json(a, `/api/me/ratings/${movie.id}`)).data.rating, null);
    assert.equal((await json(a, '/api/me/watchlist')).meta.total, 1);
    assert.equal((await json(a, '/api/me/recommendations')).data.mode, 'popular');
    await capture(page, 'live-profile-after-reset-768-light');
    result.checks.push('Confirmed Profile reset clears A genres/ratings, preserves watchlist and returns popular');
    assert.deepEqual(result.pageErrors, []); assert.deepEqual(result.metadataRequests, []);
    result.status = 'PASS';
  } catch (error) { result.status = 'FAIL'; result.failure = String(error.stack); throw error; }
  finally {
    await browser?.close(); await stop(frontend); await stop(backend); fs.closeSync(serverLog);
    fs.writeFileSync(path.join(output, 'resumed-live-browser.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
  }
})().catch(() => { process.exitCode = 1; });
