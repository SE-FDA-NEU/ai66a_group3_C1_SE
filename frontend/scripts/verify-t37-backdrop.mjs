/** Capture the public movie-detail backdrop against the running local API/UI.
 *
 * Run from the repository root after importing a real TMDb catalogue:
 *   node frontend/scripts/verify-t37-backdrop.mjs
 *
 * This manual smoke uses a real public CDN image. Automated Vitest cases stub
 * image completion and do not use the provider, its CDN, or a private token.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";

const ROOT = process.cwd();
const EVIDENCE_DIR = path.join(ROOT, "docs/evidence/s3-t37-backdrop-ui");
const API_ORIGIN = "http://127.0.0.1:8000";
const UI_ORIGIN = "http://127.0.0.1:5173";
const SOURCE_FILES = [
  "frontend/src/api/movies.ts",
  "frontend/src/components/backdropUrl.ts",
  "frontend/src/components/MovieBackdropHero.tsx",
  "frontend/src/pages/MovieDetailPage.tsx",
  "frontend/src/index.css",
  "frontend/src/tests/movie-backdrop.test.tsx",
  "frontend/scripts/verify-t37-backdrop.mjs",
];

function git(...args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

async function sourceDigest() {
  const hash = createHash("sha256");
  for (const file of SOURCE_FILES) {
    hash.update(file);
    hash.update("\0");
    hash.update(await readFile(path.join(ROOT, file)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GET ${new URL(url).pathname}: ${response.status}`);
  return response.json();
}

function browserPath() {
  const candidates = [
    process.env.T37_BROWSER,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ];
  const found = candidates.find((candidate) => candidate && existsSync(candidate));
  if (!found) throw new Error("Set T37_BROWSER to an installed Chrome, Chromium, or Edge executable");
  return found;
}

async function pageMetrics(page) {
  return page.evaluate(() => {
    const image = document.querySelector(".movie-detail__hero-image");
    const hero = document.querySelector(".movie-detail__hero");
    const title = hero?.querySelector("h1");
    const returnLink = document.querySelector(".movie-detail__return");
    const imageStyle = image ? getComputedStyle(image) : null;
    return {
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      title: title?.textContent,
      titleVisible: Boolean(title && title.getBoundingClientRect().width > 0),
      returnHref: returnLink?.getAttribute("href"),
      imageSrc: image?.getAttribute("src") ?? null,
      imageNaturalWidth: image instanceof HTMLImageElement ? image.naturalWidth : 0,
      imageOpacity: imageStyle?.opacity ?? null,
      gradient: hero ? getComputedStyle(hero).backgroundImage : null,
      overlay: hero ? getComputedStyle(hero, "::after").backgroundImage : null,
    };
  });
}

async function syntheticCase(browser, movie, name, viewport) {
  const page = await browser.newPage({ viewport });
  try {
    if (name === "null" || name === "omitted") {
      const syntheticMovie = { ...movie };
      if (name === "null") syntheticMovie.backdropUrl = null;
      else delete syntheticMovie.backdropUrl;
      await page.route(`**/api/movies/${movie.id}`, (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { movie: syntheticMovie } }),
        }),
      );
    } else {
      await page.route("https://image.tmdb.org/**", (route) => {
        if (name === "broken") return route.abort("failed");
        const fill = name === "bright" ? "#ffffff" : "#050505";
        return route.fulfill({
          status: 200,
          contentType: "image/svg+xml",
          body: `<svg xmlns="http://www.w3.org/2000/svg" width="780" height="440"><rect width="780" height="440" fill="${fill}"/></svg>`,
        });
      });
    }

    await page.goto(`${UI_ORIGIN}/movies/${encodeURIComponent(movie.id)}`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: movie.title }).waitFor();
    if (name === "bright" || name === "dark") {
      await page.locator(".movie-detail__hero-image--loaded").waitFor();
    } else {
      await page.waitForFunction(() => !document.querySelector(".movie-detail__hero-image"));
    }
    const metrics = await pageMetrics(page);
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, `t37-synthetic-${name}-${viewport.width}.png`),
      fullPage: true,
    });
    const expectsImage = name === "bright" || name === "dark";
    return {
      ...metrics,
      result: metrics.documentWidth <= metrics.viewportWidth &&
        metrics.titleVisible &&
        Boolean(metrics.gradient) &&
        Boolean(metrics.overlay) &&
        (expectsImage
          ? metrics.imageSrc === movie.backdropUrl && metrics.imageNaturalWidth > 0 && metrics.imageOpacity === "1"
          : metrics.imageSrc === null)
        ? "PASS"
        : "FAIL",
    };
  } finally {
    await page.close();
  }
}

async function main() {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  const list = await getJson(`${API_ORIGIN}/api/movies?limit=10`);
  let movie;
  for (const summary of list.data.movies) {
    const detail = await getJson(`${API_ORIGIN}/api/movies/${encodeURIComponent(summary.id)}`);
    if (detail.data.movie.backdropUrl) {
      movie = detail.data.movie;
      break;
    }
  }
  if (!movie) throw new Error("No API-listed movie has a backdropUrl; import/enrich backdrops first");

  const requests = [];
  const cdnResponses = [];
  let cdnCredentialHeaderSeen = false;
  let cdnQuerySeen = false;
  const browser = await chromium.launch({
    executablePath: browserPath(),
    headless: true,
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on("request", (request) => {
      const url = new URL(request.url());
      requests.push({ host: url.host, path: url.pathname });
      if (url.hostname === "image.tmdb.org") {
        const headers = request.headers();
        cdnCredentialHeaderSeen ||= Boolean(
          headers.authorization || headers["x-api-key"] || headers.cookie,
        );
        cdnQuerySeen ||= Boolean(url.search);
      }
    });
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (url.hostname === "image.tmdb.org") cdnResponses.push(response.status());
    });

    await page.goto(`${UI_ORIGIN}/movies/${encodeURIComponent(movie.id)}`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: movie.title }).waitFor();
    await page.locator(".movie-detail__hero-image--loaded").waitFor({ timeout: 20000 });
    await page.evaluate(() => document.fonts.ready);
    const desktop = await pageMetrics(page);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, "t37-desktop.png"), fullPage: true });

    await page.keyboard.press("Tab");
    const keyboardFocus = await page.evaluate(() => {
      const link = document.querySelector(".movie-detail__return");
      return {
        returnLinkFocused: document.activeElement === link,
        outlineWidth: link ? getComputedStyle(link).outlineWidth : null,
      };
    });
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });

    await page.setViewportSize({ width: 375, height: 812 });
    const mobile = await pageMetrics(page);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, "t37-mobile-375.png"), fullPage: true });

    const synthetic = {
      brightDesktop: await syntheticCase(browser, movie, "bright", { width: 1280, height: 900 }),
      darkMobile: await syntheticCase(browser, movie, "dark", { width: 375, height: 812 }),
      brokenMobile: await syntheticCase(browser, movie, "broken", { width: 375, height: 812 }),
      nullDesktop: await syntheticCase(browser, movie, "null", { width: 1280, height: 900 }),
      omittedMobile: await syntheticCase(browser, movie, "omitted", { width: 375, height: 812 }),
    };

    const unexpectedHosts = [...new Set(
      requests.map((request) => request.host).filter((host) =>
        !["127.0.0.1:5173", "image.tmdb.org"].includes(host)),
    )];
    const result = {
      result: "PASS",
      testedAt: new Date().toISOString(),
      baseCommit: git("rev-parse", "HEAD"),
      workingTree: git("status", "--porcelain") ? "modified" : "clean",
      sourceSha256: await sourceDigest(),
      browser: browser.version(),
      api: {
        catalogueRevision: list.meta.catalogueRevision,
        movieId: movie.id,
        title: movie.title,
        backdropUrl: movie.backdropUrl,
      },
      desktop,
      mobile,
      keyboardFocus,
      synthetic,
      cdnResponseStatuses: cdnResponses,
      cdnCredentialHeaderSeen,
      cdnQuerySeen,
      unexpectedRequestHosts: unexpectedHosts,
    };
    if (
      desktop.imageSrc !== movie.backdropUrl ||
      mobile.imageSrc !== movie.backdropUrl ||
      desktop.imageNaturalWidth <= 0 ||
      mobile.imageNaturalWidth <= 0 ||
      desktop.imageOpacity !== "1" ||
      mobile.imageOpacity !== "1" ||
      desktop.documentWidth > desktop.viewportWidth ||
      mobile.documentWidth > mobile.viewportWidth ||
      !desktop.titleVisible ||
      !mobile.titleVisible ||
      !desktop.overlay ||
      !mobile.overlay ||
      !keyboardFocus.returnLinkFocused ||
      keyboardFocus.outlineWidth !== "3px" ||
      Object.values(synthetic).some((caseResult) => caseResult.result !== "PASS") ||
      cdnCredentialHeaderSeen ||
      cdnQuerySeen ||
      unexpectedHosts.length > 0
    ) {
      result.result = "FAIL";
    }

    await writeFile(
      path.join(EVIDENCE_DIR, "t37-browser-evidence.json"),
      `${JSON.stringify(result, null, 2)}\n`,
    );
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.result !== "PASS") process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
