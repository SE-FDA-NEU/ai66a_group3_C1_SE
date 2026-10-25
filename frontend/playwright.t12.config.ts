import { defineConfig } from "@playwright/test";
import baseline from "./playwright.s04.config.ts";

export default defineConfig({
  ...baseline,
  testMatch: /t12\.watchlist\.ts/,
  outputDir: "test-results/t12",
  reporter: [["list"], ["json", { outputFile: "test-results/t12-results.json" }]],
});
