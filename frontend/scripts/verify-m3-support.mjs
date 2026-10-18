import { execFile } from "node:child_process";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Work on bytes so decoding cannot hide invalid UTF-8 or other content changes.
export function normalizeNewlines(bytes) {
  return Buffer.from(bytes.filter((byte, i) => byte !== 13 || bytes[i + 1] !== 10));
}

export function applicationFilesEqual(local, committed) {
  return normalizeNewlines(local).equals(normalizeNewlines(committed));
}

export function describeError(error) {
  return {
    type: error.name,
    ...(error.code === undefined ? {} : { code: error.code }),
    message: String(error.message).replace(/m3-[\w-]+@example\.test/gi, "[test account]"),
  };
}

async function within(promise, milliseconds) {
  let timer;
  try {
    return await Promise.race([
      promise.then(() => true),
      new Promise(resolve => { timer = setTimeout(() => resolve(false), milliseconds); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function stopServer({ child, closed }, {
  platform = process.platform, run = execute, signal = process.kill,
  timeout = 2000,
} = {}) {
  if (!child.pid) return; // A failed spawn has no process to stop.
  if (platform === "win32") {
    if (child.exitCode === null && child.signalCode === null) {
      // Terminate descendants before their parent disappears from the tree.
      await run("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        windowsHide: true, timeout: 5000,
      });
    }
  } else {
    // Servers are spawned in their own groups, including Vite's esbuild child.
    const killGroup = value => {
      try { signal(-child.pid, value); }
      catch (error) { if (error.code !== "ESRCH") throw error; }
    };
    const groupExists = () => {
      try { signal(-child.pid, 0); return true; }
      catch (error) { if (error.code === "ESRCH") return false; throw error; }
    };
    const waitForGroup = async () => {
      const deadline = Date.now() + timeout;
      while (groupExists()) {
        if (Date.now() >= deadline) return false;
        await sleep(50);
      }
      return true;
    };
    killGroup("SIGTERM");
    if (!await waitForGroup()) {
      killGroup("SIGKILL");
      if (!await waitForGroup()) throw new Error(`Server process group ${child.pid} did not stop`);
    }
  }
  if (!await within(closed, timeout)) throw new Error(`Server process ${child.pid} did not close`);
}

export async function finishVerification(report, { output, browser, children, temporary }, {
  stop = stopServer, remove = rm, write = writeFile,
} = {}) {
  const errors = [];
  const attempt = async (stage, action) => {
    try { await action(); }
    catch (error) { errors.push({ stage, ...describeError(error) }); }
  };
  if (browser) await attempt("browser", () => browser.close());
  for (const server of [...children].reverse()) {
    await attempt(`server:${server.child.pid ?? "spawn-failed"}`, () => stop(server));
  }
  if (temporary) {
    // Node retries EBUSY, EPERM and related transient errors with linear backoff.
    await attempt("temporary-directory", () => remove(temporary, {
      recursive: true, force: true, maxRetries: 10, retryDelay: 100,
    }));
  }
  report.cleanup = { result: errors.length ? "FAIL" : "PASS", errors };
  if (errors.length) report.result = "FAIL";
  // All cleanup attempts are isolated so none can prevent writing the report.
  await write(path.join(output, "results.json"), JSON.stringify(report, null, 2) + "\n");
  return report.result === "PASS" ? 0 : 1;
}
