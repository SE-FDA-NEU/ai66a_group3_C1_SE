import { defineConfig } from "@playwright/test";
import baseline from "./playwright.s04.config.ts";

export default defineConfig({
  ...baseline,
  testMatch: /mobile-navigation\.acceptance\.ts/,
  outputDir: "test-results/mobile-navigation",
  reporter: [["list"], ["json", { outputFile: "test-results/mobile-navigation-results.json" }]],
});
