import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontend = fileURLToPath(new URL("..", import.meta.url));
const defaultCli = path.join(frontend, "node_modules/@playwright/test/cli.js");

export async function runS04(args = [], playwrightCli = defaultCli) {
  // Only this parent owns the directory. Backend shutdown may be forced on Windows.
  const directory = await mkdtemp(path.join(tmpdir(), "s04-browser-"));
  let child;
  let stopping;
  let interrupted;
  const stop = (signal) => {
    interrupted ??= signal;
    if (!child?.pid || stopping) return;
    if (process.platform === "win32") {
      // Killing only the Playwright process would leave its servers behind.
      stopping = new Promise((resolve, reject) => {
        const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"]);
        killer.once("error", reject);
        killer.once("close", resolve);
      });
    } else {
      child.kill(signal);
    }
  };
  const onInterrupt = () => stop("SIGINT");
  const onTerminate = () => stop("SIGTERM");
  process.on("SIGINT", onInterrupt);
  process.on("SIGTERM", onTerminate);
  try {
    child = spawn(process.execPath, [playwrightCli, "test", "--config", "playwright.s04.config.ts", ...args], {
      cwd: frontend,
      stdio: "inherit",
      env: { ...process.env, S04_DATABASE_DIR: directory },
    });
    const code = await new Promise((resolve, reject) => {
      child.once("error", reject);
      // Playwright waits for webServer teardown before exiting.
      child.once("close", (exitCode) => resolve(exitCode ?? 1));
    });
    return interrupted ? (interrupted === "SIGINT" ? 130 : 143) : code;
  } finally {
    try {
      // On Windows, also wait for taskkill to finish stopping the process tree.
      await stopping;
      await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
      console.log("s04_temporary_database_removed=true");
    } finally {
      process.off("SIGINT", onInterrupt);
      process.off("SIGTERM", onTerminate);
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runS04(process.argv.slice(2));
}
