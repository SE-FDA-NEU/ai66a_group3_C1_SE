import { expect, test, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { releaseResponseGate, waitForResponseGate } from "./support/responseGates.ts";

const controls = "http://127.0.0.1:8014/__acceptance";
const trailerUrl = "https://www.youtube.com/watch?v=AbCdEf123_-";
const labels = ["both", "backdrop", "trailer", "neither", "broken", "next"] as const;
type Label = typeof labels[number];
const idOf = (label: Label) => "20000000-0000-0000-0000-" +
  String(labels.indexOf(label) + 1).padStart(12, "0");
const detailPath = (label: Label) => "/api/movies/" + idOf(label);
const pagePath = (label: Label) => "/movies/" + idOf(label);
const screenshotDirectory = process.env.T20_SCREENSHOT_DIR ?? path.resolve("test-results/t20/screenshots");
type Observations = { pageErrors: string[]; metadataRequests: string[] };
const observations = new WeakMap<Page, Observations>();

async function capture(page: Page, name: string) {
  await mkdir(screenshotDirectory, { recursive: true });
  await page.screenshot({ path: path.join(screenshotDirectory, name + ".png"), fullPage: true });
}

async function record(info: TestInfo, name: string, value: unknown) {
  const body = JSON.stringify(value, null, 2) + "\n";
  await writeFile(info.outputPath(name + ".json"), body);
  await info.attach(name, { body: Buffer.from(body), contentType: "application/json" });
}

test.beforeEach(async ({ page, request }) => {
  const state = { pageErrors: [], metadataRequests: [] } as Observations;
  observations.set(page, state);
  page.on("pageerror", error => state.pageErrors.push(error.message));
  page.on("request", request => {
    if (new URL(request.url()).hostname === "api.themoviedb.org")
      state.metadataRequests.push(new URL(request.url()).pathname);
  });
  // The API and SQLite are real. Only external artwork and the external
  // navigation destination are controlled; no API response is fulfilled here.
  const artwork = await readFile(new URL("./fixtures/t20-backdrop.svg", import.meta.url));
  await page.route("https://image.tmdb.org/**", route => {
    const broken = new URL(route.request().url()).pathname.endsWith("/t20-broken.jpg");
    return route.fulfill(broken
      ? { status: 404, body: "" }
      : { contentType: "image/svg+xml", body: artwork });
  });
  await page.route("https://api.themoviedb.org/**", route => route.abort());
  await page.route("https://www.youtube.com/embed/**", route => route.fulfill({
    contentType: "text/html",
    body: '<html><head><title>Offline player fixture</title></head><body><button>Play fixture</button></body></html>',
  }));
  const prepared = await request.post(controls + "/scenario/trailer-media");
  expect(prepared.status()).toBe(200);
});

test.afterEach(async ({ page, request }, info) => {
  const response = await request.post(controls + "/release-gates");
  expect(response.status()).toBe(200);
  expect((await response.json()).pending).toBe(0);
  const state = observations.get(page)!;
  await record(info, "browser-observations", state);
  expect(state.pageErrors).toEqual([]);
  expect(state.metadataRequests).toEqual([]);
  expect(await page.locator("iframe").count()).toBe(0);
});

test("real API/SQLite: four media combinations in both themes and responsive widths",
  async ({ page, request }, info) => {
    test.setTimeout(90_000);
    const details: Record<string, unknown> = {};
    for (const label of labels.slice(0, 4)) {
      const response = await request.get(detailPath(label));
      expect(response.status()).toBe(200);
      const payload = await response.json();
      const movie = payload.data.movie;
      expect(movie.id).toBe(idOf(label));
      expect(movie.title).toBe("Fixture " + label);
      expect(Boolean(movie.backdropUrl)).toBe(label === "both" || label === "backdrop");
      expect(Boolean(movie.trailer)).toBe(label === "both" || label === "trailer");
      if (movie.trailer) {
        expect(movie.trailer).toMatchObject({
          site: "YouTube", type: "Trailer", official: true, key: "AbCdEf123_-", url: trailerUrl,
        });
      }
      details[label] = payload;
    }
    await record(info, "production-details", details);
    const matrix: object[] = [];
    await page.goto(pagePath("neither"));
    for (const theme of ["dark", "light"] as const) {
      await page.evaluate(value => localStorage.setItem("cineai-theme", value), theme);
      for (const width of [375, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        for (const label of ["both", "backdrop", "trailer", "neither"] as const) {
          await test.step(theme + "/" + width + "/" + label, async () => {
            await page.goto(pagePath(label));
            await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
            await expect(page.getByRole("heading", { name: "Fixture " + label, exact: true })).toBeVisible();
            const hero = page.locator(".movie-detail__hero-image");
            const hasBackdrop = label === "both" || label === "backdrop";
            let naturalWidth = 0;
            if (hasBackdrop) {
              await expect(hero).toHaveCount(1);
              await expect(hero).toHaveClass(/--loaded/);
              await expect(hero).toBeVisible();
              naturalWidth = await hero.evaluate(image => (image as HTMLImageElement).naturalWidth);
              expect(naturalWidth).toBeGreaterThan(0);
            } else await expect(hero).toHaveCount(0);
            const link = page.getByRole("button", { name: "Watch trailer" });
            const hasTrailer = label === "both" || label === "trailer";
            await expect(page.locator(".movie-trailer")).toBeVisible();
            await expect(link).toHaveCount(hasTrailer ? 1 : 0);
            if (hasTrailer) {
              await expect(link).toHaveAttribute("aria-haspopup", "dialog");
              const poster = await page.locator(".movie-detail__poster .movie-poster").boundingBox();
              const control = await link.boundingBox();
              expect(control!.y).toBeGreaterThanOrEqual(poster!.y + poster!.height);
            } else await expect(page.getByText("Trailer unavailable", { exact: true })).toBeVisible();
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
            expect(overflow).toBe(false);
            matrix.push({ theme, width, label, backdropLoaded: hasBackdrop, naturalWidth,
              trailerButton: hasTrailer, overflow });
            if ((theme === "dark" && width === 1440)
              || (theme === "light" && width === 375 && label === "neither")
              || (theme === "light" && width === 768 && label === "both"))
              await capture(page, theme + "-" + width + "-" + label);
          });
        }
      }
    }
    expect(matrix).toHaveLength(24);
    await record(info, "media-matrix", matrix);
  });

async function holdDetail(page: Page, request: APIRequestContext, name: string, label: Label) {
  const apiPath = detailPath(label);
  const requestTag = "t20-" + crypto.randomUUID();
  await page.route(url => url.pathname === apiPath, route => route.continue({
    headers: { ...route.request().headers(), "x-s04-gate": requestTag },
  }));
  const response = await request.post(controls + "/gates/" + name + "/arm", {
    data: { method: "GET", path: apiPath, requestTag },
  });
  expect(response.status()).toBe(200);
  return apiPath;
}

test("broken-image fallback and SPA movie change remove the former trailer",
  async ({ page, request }) => {
    await page.goto(pagePath("broken"));
    await expect(page.getByRole("heading", { name: "Fixture broken", exact: true })).toBeVisible();
    await expect(page.locator(".movie-detail__hero-image")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Watch trailer/ })).toHaveCount(1);
    const endpoint = await holdDetail(page, request, "trailer-next", "next");
    await page.getByRole("link", { name: "View details for Fixture next", exact: true }).click();
    await waitForResponseGate(request, controls, "trailer-next", endpoint);
    await expect(page.getByText("Loading movie...", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Watch trailer/ })).toHaveCount(0);
    await releaseResponseGate(request, controls, "trailer-next");
    await expect(page.getByRole("heading", { name: "Fixture next", exact: true })).toBeVisible();
    await expect(page.getByText("Trailer unavailable", { exact: true })).toBeVisible();
  });

test("late production detail response cannot restore another movie's trailer",
  async ({ page, request }, info) => {
    await page.goto(pagePath("neither"));
    await expect(page.getByText("Trailer unavailable", { exact: true })).toBeVisible();
    const endpoint = await holdDetail(page, request, "trailer-old", "both");
    await page.getByRole("link", { name: "View details for Fixture both", exact: true }).click();
    await waitForResponseGate(request, controls, "trailer-old", endpoint);
    await expect(page.getByText("Loading movie...", { exact: true })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("heading", { name: "Fixture neither", exact: true })).toBeVisible();
    await releaseResponseGate(request, controls, "trailer-old");
    await expect(page.getByRole("heading", { name: "Fixture neither", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Watch trailer/ })).toHaveCount(0);
    const gate = await request.get(controls + "/gates/trailer-old");
    await record(info, "released-old-response", await gate.json());
  });

test("keyboard opens the in-page player, contains focus across the iframe and restores the trigger",
  async ({ page }) => {
    await page.goto(pagePath("both"));
    const trigger = page.getByRole("button", { name: "Watch trailer" });
    await expect(trigger).toBeVisible();
    for (let step = 0; step < 40; step++) {
      await page.keyboard.press("Tab");
      if (await trigger.evaluate(node => node === document.activeElement)) break;
    }
    await expect(trigger).toBeFocused();
    const url = page.url();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Fixture both" });
    await expect(dialog).toBeVisible();
    const close = page.getByRole("button", { name: "Close trailer" });
    await expect(close).toBeFocused();
    const player = page.frameLocator(".trailer-dialog__frame").getByRole("button", { name: "Play fixture" });
    await expect(player).toBeVisible();
    await page.keyboard.press("Shift+Tab");
    const done = page.getByRole("button", { name: "Back to details" });
    await expect(done).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(player).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(done).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page.locator("iframe")).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(page.url()).toBe(url);
    expect(page.context().pages()).toHaveLength(1);
  });

test("embedded player fits both themes and all three widths without navigation or autoplay",
  async ({ page }) => {
    await page.goto(pagePath("both"));
    for (const theme of ["dark", "light"]) {
      await page.evaluate(value => localStorage.setItem("cineai-theme", value), theme);
      for (const width of [375, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(pagePath("both"));
        const url = page.url();
        const trigger = page.getByRole("button", { name: "Watch trailer" });
        await trigger.click();
        const dialog = page.getByRole("dialog", { name: "Fixture both" });
        await expect(dialog).toBeVisible();
        const frame = dialog.locator("iframe");
        await expect(frame).toHaveAttribute("src", "https://www.youtube.com/embed/AbCdEf123_-?autoplay=0&playsinline=1&rel=0");
        await expect(frame).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");
        const box = (await frame.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(200);
        expect(box.height).toBeGreaterThanOrEqual(200);
        const modal = (await dialog.boundingBox())!;
        expect(modal.x).toBeGreaterThanOrEqual(0);
        expect(modal.x + modal.width).toBeLessThanOrEqual(width);
        expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
        await capture(page, "player-" + theme + "-" + width);
        expect(page.url()).toBe(url);
        expect(page.context().pages()).toHaveLength(1);
        if (width === 1440) await page.mouse.click(3, 3);
        else await page.getByRole("button", { name: "Close trailer" }).click();
        await expect(dialog).toHaveCount(0);
        await expect(page.locator("iframe")).toHaveCount(0);
        await expect(trigger).toBeFocused();
        expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
      }
    }
  });

test("Back while the trailer is open removes the old movie and player",
  async ({ page }) => {
    await page.goto(pagePath("neither"));
    await page.getByRole("link", { name: "View details for Fixture both", exact: true }).click();
    await page.getByRole("button", { name: "Watch trailer" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("heading", { name: "Fixture neither", exact: true })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator("iframe")).toHaveCount(0);
    await expect(page.getByText("Trailer unavailable", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  });
