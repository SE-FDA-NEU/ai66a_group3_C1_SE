import { defineConfig } from "@playwright/test";
import baseline from "./playwright.s04.config.ts";

export default defineConfig({
  ...baseline,
  testMatch: /t13\.profile\.ts/,
  outputDir: "test-results/t13",
  reporter: [["list"], ["json", { outputFile: "test-results/t13-results.json" }]],
});
