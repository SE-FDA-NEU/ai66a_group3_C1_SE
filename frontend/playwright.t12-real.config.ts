import { defineConfig } from "@playwright/test";
import baseline from "./playwright.s04.config.ts";

// The S04 harness copies an explicitly supplied, imported SQLite catalogue
// into its disposable database before this visual test creates an account.
export default defineConfig({
  ...baseline,
  testMatch: /t12\.real-catalogue\.ts/,
  timeout: 90_000,
  outputDir: "test-results/t12-real",
  reporter: [["list"], ["json", { outputFile: "test-results/t12-real-results.json" }]],
});
