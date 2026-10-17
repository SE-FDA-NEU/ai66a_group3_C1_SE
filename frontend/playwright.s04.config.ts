import { defineConfig } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const localPython = path.join(root, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const python = process.env.S04_PYTHON ?? (existsSync(localPython) ? localPython : "python");
const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const supportFiles = [
  "frontend/package.json", "frontend/package-lock.json", "frontend/playwright.s04.config.ts",
  "frontend/vite.s04.config.ts", "frontend/e2e/s04.acceptance.ts",
  "frontend/e2e/s13.acceptance.ts", "backend/tests/test_auth_acceptance.py",
  "frontend/scripts/run-s04-e2e.mjs", "frontend/scripts/run-s04-e2e.node-test.mjs",
  "backend/requirements.lock.txt", "backend/pyproject.toml", "backend/alembic.ini",
  "backend/scripts/s04_acceptance_server.py", "backend/scripts/collect_s04_evidence.py",
  "backend/scripts/verify_s09_popular_ui.py",
  "backend/tests/fixtures/s04_browser_acceptance.json", ".github/workflows/s04-e2e.yml",
];
const sourceFiles = git("ls-files", "--cached", "--others", "--exclude-standard", "-z").split("\0")
  .filter((file) => /^(backend\/(app|alembic)\/|frontend\/src\/)/.test(file) || supportFiles.includes(file)).sort();

export default defineConfig({
  testDir: "./e2e",
  testMatch: /s(04|13)\.acceptance\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  outputDir: "test-results/s04",
  reporter: [["list"], ["json", { outputFile: "test-results/s04-results.json" }]],
  metadata: {
    testedCommit: git("rev-parse", "HEAD"),
    workingTree: git("status", "--short"),
    node: process.version,
    python: execFileSync(python, ["--version"], { encoding: "utf8" }).trim(),
    sourceSha256: Object.fromEntries(sourceFiles.map((file) => [
      file, createHash("sha256").update(readFileSync(path.join(root, file))).digest("hex"),
    ])),
  },
  use: {
    baseURL: "http://127.0.0.1:5174",
    browserName: "chromium",
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
    // Do not persist auth cookies, passwords or session tokens in traces/HARs.
    trace: "off",
  },
  webServer: [
    {
      command: `"${python}" backend/scripts/s04_acceptance_server.py`,
      cwd: root,
      url: "http://127.0.0.1:8014/__acceptance/ready",
      reuseExistingServer: false,
    },
    {
      command: "node node_modules/vite/bin/vite.js --config vite.s04.config.ts --host 127.0.0.1 --port 5174 --strictPort",
      url: "http://127.0.0.1:5174",
      reuseExistingServer: false,
    },
  ],
});
