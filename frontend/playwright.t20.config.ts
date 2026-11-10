import { defineConfig } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import baseline from "./playwright.s04.config.ts";

export default defineConfig({
  ...baseline,
  testMatch: /s4-t20\.trailer\.ts/,
  outputDir: "test-results/t20",
  reporter: [["list"], ["json", { outputFile: "test-results/t20-results.json" }]],
  metadata: {
    ...baseline.metadata,
    t20SourceSha256: Object.fromEntries([
      "playwright.t20.config.ts", "e2e/s4-t20.trailer.ts",
      "e2e/fixtures/t20-backdrop.svg", "scripts/run-t20-e2e.mjs",
    ].map(file => [file, createHash("sha256").update(readFileSync(new URL(file, import.meta.url))).digest("hex")])),
  },
  use: {
    ...baseline.use,
    // SETUP installs Playwright Chromium. Chrome/Edge is opt-in via the shared
    // S04_BROWSER_CHANNEL or an explicit T20_BROWSER executable, on any OS.
    ...(process.env.T20_BROWSER ? {
      channel: undefined, launchOptions: { executablePath: process.env.T20_BROWSER },
    } : {}),
  },
});
