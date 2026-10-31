import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: /s4-t20\.trailer\.ts/,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5182", browserName: "chromium",
    launchOptions: { executablePath: process.env.T20_BROWSER
      ?? (process.platform === "win32"
        ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : undefined) },
  },
});
