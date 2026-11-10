/** Capture actual browser rendering with synthetic, intercepted local API data. */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require(path.join(process.cwd(), "node_modules", "@playwright", "test"));

const root = path.resolve(process.cwd(), "..");
const output = path.join(root, "docs", "evidence", "s4-t19", "screenshots");
const browserPath = process.env.S4_T19_BROWSER
  || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const base = process.env.S4_T19_BASE_URL || "http://127.0.0.1:5175";

function movie(id, trailer) {
  return {
    id, title: id === "synthetic-a" ? "Synthetic Trailer Alpha" : "Synthetic Trailer Beta",
    releaseYear: 2026, genres: [{ id: 28, name: "Action" }],
    overview: "Synthetic browser evidence for optional trailer rendering.",
    popularityScore: 10, voteAverage: null, voteCount: null,
    backdropUrl: null, posterUrl: null, trailer,
  };
}

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: browserPath, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const externalApiRequests = [];
    page.on("request", request => {
      if (request.url().includes("api.themoviedb.org")) externalApiRequests.push(request.url());
    });
    await page.route("**/api/**", async route => {
      const pathname = new URL(route.request().url()).pathname;
      if (!pathname.startsWith("/api/")) return route.continue();
      if (pathname === "/api/auth/me")
        return route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
      if (pathname === "/api/movies/synthetic-a" || pathname === "/api/movies/synthetic-b") {
        const id = pathname.endsWith("synthetic-a") ? "synthetic-a" : "synthetic-b";
        const trailer = id === "synthetic-a" ? {
          site: "YouTube", key: "AbCdEf123_-", name: "Synthetic official trailer",
          type: "Trailer", official: true, language: "en",
          publishedAt: "2026-10-20T10:00:00Z",
          url: "https://www.youtube.com/watch?v=AbCdEf123_-",
        } : null;
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ data: { movie: movie(id, trailer) }, meta: { catalogueRevision: "synthetic" } }) });
      }
      if (pathname.endsWith("/similar"))
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ data: { movies: [] } }) });
      throw new Error(`Unexpected local API request: ${pathname}`);
    });

    await page.goto(`${base}/movies/synthetic-a`);
    await page.getByRole("heading", { name: "Synthetic Trailer Alpha" }).waitFor();
    const link = page.getByRole("link", { name: /Watch trailer/ });
    await link.waitFor();
    assert.equal(await link.getAttribute("href"), "https://www.youtube.com/watch?v=AbCdEf123_-");
    await page.screenshot({ path: path.join(output, "trailer-present.png"), fullPage: true });

    await page.goto(`${base}/movies/synthetic-b`);
    await page.getByRole("heading", { name: "Synthetic Trailer Beta" }).waitFor();
    assert.equal(await page.getByRole("link", { name: /Watch trailer/ }).count(), 0);
    await page.screenshot({ path: path.join(output, "trailer-absent.png"), fullPage: true });
    assert.deepEqual(externalApiRequests, []);
    console.log("browser_screenshots=2");
    console.log("trailer_link_validated=true");
    console.log("null_trailer_link_absent=true");
    console.log("tmdb_runtime_requests=0");
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
