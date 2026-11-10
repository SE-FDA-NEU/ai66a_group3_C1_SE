import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

export async function startRatingBridge(
  script = "backend/tests/support/t33_rating_bridge.py",
) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const localPython = resolve(
    root,
    process.platform === "win32"
      ? ".venv/Scripts/python.exe"
      : ".venv/bin/python",
  );
  const python =
    process.env.T33_PYTHON ??
    (existsSync(localPython) ? localPython : "python");
  const child = spawn(
    python,
    [resolve(root, script)],
    {
      cwd: root,
      env: { ...process.env, PYTHONUTF8: "1", TMDB_READ_ACCESS_TOKEN: "" },
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  let nextId = 0;
  let closing = false;
  let hasExited = false;
  let stderr = "";
  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  let readyResolve!: (metadata: { movieId: string; title: string }) => void;
  let readyReject!: (error: Error) => void;
  const ready = new Promise<{ movieId: string; title: string }>(
    (done, fail) => {
      readyResolve = done;
      readyReject = fail;
    },
  );
  let exitedResolve!: () => void;
  const exited = new Promise<void>((done) => {
    exitedResolve = done;
  });
  const fail = (error: Error) => {
    readyReject(error);
    pending.forEach((request) => request.reject(error));
    pending.clear();
    if (!hasExited) child.kill();
  };
  child.stderr.on("data", (chunk) => {
    stderr = (stderr + String(chunk)).slice(-5000);
  });
  const lines = createInterface({ input: child.stdout });
  lines.on("line", (line) => {
    try {
      const message = JSON.parse(line);
      if (message.ready) readyResolve(message.metadata);
      if (message.id !== undefined) {
        pending.get(message.id)?.resolve(message.result);
        pending.delete(message.id);
      }
    } catch {
      fail(new Error("Invalid T33 bridge JSON"));
    }
  });
  child.on("error", fail);
  child.on("exit", (code) => {
    hasExited = true;
    exitedResolve();
    if (!closing || code !== 0)
      fail(new Error(`T33 bridge exited ${code}: ${stderr}`));
  });
  const startupTimer = setTimeout(
    () => fail(new Error(`T33 bridge startup timed out: ${stderr}`)),
    30_000,
  );
  let metadata: { movieId: string; title: string };
  try {
    metadata = await ready;
  } finally {
    clearTimeout(startupTimer);
  }
  function call(op: string, data: Record<string, unknown> = {}) {
    if (hasExited)
      return Promise.reject(new Error("T33 bridge is not running"));
    const id = ++nextId;
    return new Promise<unknown>((done, failRequest) => {
      const timer = setTimeout(
        () => fail(new Error(`T33 bridge operation timed out: ${op}`)),
        10_000,
      );
      pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          done(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          failRequest(error);
        },
      });
      child.stdin.write(JSON.stringify({ id, op, ...data }) + "\n", (error) => {
        if (error) fail(error);
      });
    });
  }
  return {
    metadata,
    call,
    close: async () => {
      if (hasExited) {
        lines.close();
        return;
      }
      closing = true;
      try {
        await call("close");
      } finally {
        child.stdin.end();
        const timer = setTimeout(() => child.kill(), 5_000);
        await exited;
        clearTimeout(timer);
        lines.close();
      }
    },
  };
}
