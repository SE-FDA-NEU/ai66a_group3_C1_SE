/** Capture the real local TMDb smoke catalogue through Vite and the backend. */
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(path.join(process.cwd(), "node_modules", "@playwright", "test"));

const root = path.resolve(process.cwd(), "..");
const output = path.join(root, "docs", "evidence", "s4-t19", "screenshots");
const browserPath = process.env.S4_T19_BROWSER
  || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const base = process.env.S4_T19_BASE_URL || "http://127.0.0.1:5175";
const presentId = process.env.S4_T19_PRESENT_ID || "476240e9-f707-4f24-a617-a8f29e8918f7";
const absentId = process.env.S4_T19_ABSENT_ID || "1190a698-1a0d-4941-8e14-48bb2b26a140";
const expectedUrl = process.env.S4_T19_EXPECTED_URL
  || "https://www.youtube.com/watch?v=ZFPRskeOTQ0";

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: browserPath, headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.route("https://www.youtube.com/**", route =>
      route.fulfill({ status: 200, contentType: "text/html", body: "smoke target" }));
    const page = await context.newPage();
    let tmdbBrowserRequests = 0;
    page.on("request", request => {
      if (request.url().includes("api.themoviedb.org")) tmdbBrowserRequests += 1;
    });

    await page.goto(`${base}/movies/${presentId}`);
    await page.getByRole("heading", { name: "Blue Sky Jo" }).waitFor();
    await page.getByText("Loading similar movies...").waitFor({ state: "hidden" });
    const link = page.getByRole("link", { name: /Watch trailer/ });
    await link.waitFor();
    assert.equal(await link.getAttribute("href"), expectedUrl);
    assert.equal(await link.getAttribute("target"), "_blank");
    const presentFile = path.join(output, "live-trailer-present.png");
    await page.screenshot({ path: presentFile, fullPage: true });
    const popupPromise = page.waitForEvent("popup");
    await link.click();
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");
    assert.equal(popup.url(), expectedUrl);
    await popup.close();

    await page.goto(`${base}/movies/${absentId}`);
    await page.getByRole("heading", { name: "Mulan" }).waitFor();
    await page.getByText("Loading similar movies...").waitFor({ state: "hidden" });
    assert.equal(await page.getByRole("link", { name: /Watch trailer/ }).count(), 0);
    const absentFile = path.join(output, "live-trailer-absent.png");
    await page.screenshot({ path: absentFile, fullPage: true });
    assert.equal(tmdbBrowserRequests, 0);
    console.log(`present_movie_id=${presentId}`);
    console.log(`absent_movie_id=${absentId}`);
    console.log(`opened_youtube_url=${expectedUrl}`);
    console.log("null_trailer_link_absent=true");
    console.log("tmdb_browser_requests=0");
    console.log(`present_screenshot_sha256=${sha256(presentFile)}`);
    console.log(`absent_screenshot_sha256=${sha256(absentFile)}`);
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
