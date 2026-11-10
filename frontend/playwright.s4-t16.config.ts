import { defineConfig } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import baseline from "./playwright.s04.config.ts";

export default defineConfig({
  ...baseline,
  testMatch: /s4-t16\.detail-boundaries\.ts/,
  timeout: 60_000,
  outputDir: "test-results/s4-t16/browser",
  reporter: [["list"], ["json", { outputFile: "test-results/s4-t16/browser-results.json" }]],
  metadata: { ...baseline.metadata, fixture: "synthetic migrated SQLite; real API/index",
    t16SourceSha256: Object.fromEntries([
      "playwright.s4-t16.config.ts", "e2e/s4-t16.detail-boundaries.ts",
      "e2e/support/responseGates.ts",
    ].map(file => [file, createHash("sha256").update(readFileSync(new URL(file, import.meta.url))).digest("hex")])) },
});
