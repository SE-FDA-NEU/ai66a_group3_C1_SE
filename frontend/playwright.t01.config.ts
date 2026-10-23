import { defineConfig } from "@playwright/test";
import baseline from "./playwright.s04.config.ts";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// Fixture mode owns isolated servers; live mode only reads an already running
// preview. Never attach to or stop a developer's unrelated server implicitly.
const live = process.env.T01_LIVE_URL;
export default defineConfig({
  ...baseline,
  testMatch: /t01\.visual\.ts/,
  outputDir: live ? "test-results/t01-live" : "test-results/t01",
  reporter: [["list"], ["json", { outputFile: live ? "test-results/t01-live-results.json" : "test-results/t01-results.json" }]],
  metadata: { ...baseline.metadata, t01Mode: live ? "imported-db-preview" : "isolated-fixture",
    t01SourceSha256: Object.fromEntries(["playwright.t01.config.ts", "e2e/t01.visual.ts"].map(file =>
      [file, createHash("sha256").update(readFileSync(new URL(file, import.meta.url))).digest("hex")])) },
  webServer: live ? undefined : baseline.webServer,
  use: { ...baseline.use, baseURL: live ?? "http://127.0.0.1:5174", trace: "off" },
});
