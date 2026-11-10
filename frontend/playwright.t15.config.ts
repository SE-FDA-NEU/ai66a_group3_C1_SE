import { defineConfig } from "@playwright/test";
import baseline from "./playwright.s04.config.ts";

export default defineConfig({
  ...baseline,
  testMatch: /t15\.reset-acceptance\.ts/,
  outputDir: "test-results/t15",
  reporter: [["list"], ["json", { outputFile: "test-results/t15-results.json" }]],
});
