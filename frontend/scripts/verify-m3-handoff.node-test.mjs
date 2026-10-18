// Run with node --test, outside Vitest's *.test.* discovery.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { applicationFilesEqual, finishVerification, stopServer } from "./verify-m3-support.mjs";

test("clean CRLF checkout matches Git LF content, including Unicode and mixed newlines", () => {
  const committed = Buffer.from("# Tiếng Việt\nfirst = 1\nsecond = 2\n");
  for (const local of [
    Buffer.from("# Tiếng Việt\r\nfirst = 1\r\nsecond = 2\r\n"),
    Buffer.from("# Tiếng Việt\r\nfirst = 1\nsecond = 2\r\n"),
    committed,
  ]) {
    assert(applicationFilesEqual(local, committed));
    assert(applicationFilesEqual(committed, local));
  }
});

test("newline normalization still detects content, whitespace, final newline and byte changes", () => {
  const committed = Buffer.from("value = 1\n");
  for (const local of ["value = 2\r\n", "value = 1 \r\n", "value = 1", "value = 1\r", "value = 1\r\r\n"]) {
    assert.equal(applicationFilesEqual(Buffer.from(local), committed), false, local);
  }
  assert.equal(applicationFilesEqual(Buffer.from([0xff, 13, 10]), Buffer.from([0xfe, 10])), false);
});

test("Windows stops the entire tree and waits for server close before returning", async () => {
  let resolveClose;
  const closed = new Promise(resolve => { resolveClose = resolve; });
  let stopped = false;
  const stopping = stopServer({ child: { pid: 123, exitCode: null, signalCode: null }, closed }, {
    platform: "win32",
    run: async (command, args, options) => {
      assert.equal(command, "taskkill");
      assert.deepEqual(args, ["/PID", "123", "/T", "/F"]);
      assert(options.timeout > 0);
    },
  }).then(() => { stopped = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(stopped, false);
  resolveClose();
  await stopping;
  assert.equal(stopped, true);
});

test("Windows server close timeout is bounded and reported", async () => {
  await assert.rejects(stopServer({
    child: { pid: 123, exitCode: null, signalCode: null }, closed: new Promise(() => {}),
  }, { platform: "win32", run: async () => {}, timeout: 10 }), /did not close/);
});

test("stops a real server and its child holding the database before removal", { timeout: 20000 }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "m3-process-test-"));
  const database = path.join(directory, "acceptance.db");
  const descendant = path.join(directory, "database-holder.cjs");
  const server = path.join(directory, "server.cjs");
  await writeFile(descendant, `
    require("node:fs").openSync(process.argv[2], "w");
    process.on("SIGTERM", () => {});
    process.send("ready");
    setInterval(() => {}, 1000);
  `);
  await writeFile(server, `
    const child = require("node:child_process").spawn(process.execPath,
      [process.argv[2], process.argv[3]], { stdio: ["ignore", "ignore", "ignore", "ipc"] });
    child.once("message", () => process.send({ pid: child.pid }));
    process.on("SIGTERM", () => {});
    setInterval(() => {}, 1000);
  `);
  const child = spawn(process.execPath, [server, descendant, database], {
    detached: process.platform !== "win32", stdio: ["ignore", "ignore", "ignore", "ipc"],
  });
  const closed = new Promise(resolve => child.once("close", resolve));
  try {
    const [{ pid: descendantPid }] = await once(child, "message");
    await stopServer({ child, closed });
    assert(child.exitCode !== null || child.signalCode !== null);
    assert.throws(() => process.kill(descendantPid, 0), { code: "ESRCH" });
    await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    await assert.rejects(stat(directory), { code: "ENOENT" });
  } finally {
    await stopServer({ child, closed });
    await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});

for (const journeyResult of ["PASS", "FAIL"]) {
  test(`writes report after persistent EBUSY when journey is ${journeyResult}`, async () => {
    const output = await mkdtemp(path.join(tmpdir(), "m3-report-test-"));
    const report = {
      result: journeyResult, checks: [{ name: "completed journey check", result: "PASS" }],
      ...(journeyResult === "FAIL" ? { failure: { type: "Error", message: "journey failed" } } : {}),
    };
    const originalFailure = report.failure;
    const events = [];
    try {
      const exitCode = await finishVerification(report, {
        output, temporary: "owned-directory", children: [{ child: { pid: 1 } }, { child: { pid: 2 } }],
        browser: { close: async () => { events.push("browser"); } },
      }, {
        stop: async ({ child }) => { events.push(`stop:${child.pid}`); },
        remove: async (directory, options) => {
          events.push("remove");
          assert.equal(directory, "owned-directory");
          assert.deepEqual(options, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
          throw Object.assign(new Error("database locked"), { code: "EBUSY" });
        },
      });
      assert.equal(exitCode, 1);
      assert.deepEqual(events, ["browser", "stop:2", "stop:1", "remove"]);
      const saved = JSON.parse(await readFile(path.join(output, "results.json"), "utf8"));
      assert.equal(saved.result, "FAIL");
      assert.deepEqual(saved.failure, originalFailure);
      assert.deepEqual(saved.checks, report.checks);
      assert.deepEqual(saved.cleanup, {
        result: "FAIL", errors: [{ stage: "temporary-directory", type: "Error", code: "EBUSY", message: "database locked" }],
      });
    } finally {
      await rm(output, { recursive: true, force: true });
    }
  });
}

test("browser and server shutdown failures do not skip remaining cleanup or report", async () => {
  const report = { result: "PASS", checks: [] };
  const events = [];
  const exitCode = await finishVerification(report, {
    output: "evidence", temporary: "owned-directory",
    browser: { close: async () => { throw new Error("browser close failed"); } },
    children: [{ child: { pid: 1 } }, { child: { pid: 2 } }],
  }, {
    stop: async ({ child }) => {
      events.push(`stop:${child.pid}`);
      if (child.pid === 2) throw new Error("taskkill failed");
    },
    remove: async () => { events.push("remove"); },
    write: async (file, contents) => {
      events.push("write");
      assert.equal(file, path.join("evidence", "results.json"));
      assert.deepEqual(JSON.parse(contents), report);
    },
  });
  assert.equal(exitCode, 1);
  assert.deepEqual(events, ["stop:2", "stop:1", "remove", "write"]);
  assert.deepEqual(report.cleanup.errors.map(error => error.stage), ["browser", "server:2"]);
});

test("transient Windows lock is retried before writing a successful report", { skip: process.platform !== "win32" }, async () => {
  const output = await mkdtemp(path.join(tmpdir(), "m3-lock-test-"));
  const temporary = await mkdtemp(path.join(tmpdir(), "m3-lock-db-"));
  // FileShare.None creates a real Windows deletion lock; Node's open() permits deletion.
  const holder = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `
    $file = [System.IO.File]::Open($env:M3_TEST_DATABASE,
      [System.IO.FileMode]::Create, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
    try {
      [Console]::WriteLine('locked')
      Start-Sleep -Milliseconds 750
    } finally { $file.Dispose() }
  `], {
    env: { ...process.env, M3_TEST_DATABASE: path.join(temporary, "acceptance.db") },
    stdio: ["ignore", "pipe", "inherit"],
  });
  const closed = new Promise(resolve => holder.once("close", resolve));
  try {
    const ready = new Promise((resolve, reject) => {
      holder.once("error", reject);
      holder.stdout.once("data", resolve);
      closed.then(() => reject(new Error("Lock holder exited before readiness")));
    });
    await ready;
    await assert.rejects(rm(temporary, { recursive: true, force: true, maxRetries: 0 }));
    const report = { result: "PASS", checks: [] };
    assert.equal(await finishVerification(report, { output, temporary, children: [] }), 0);
    assert.equal(JSON.parse(await readFile(path.join(output, "results.json"), "utf8")).cleanup.result, "PASS");
    await assert.rejects(stat(temporary), { code: "ENOENT" });
  } finally {
    await closed;
    await rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    await rm(output, { recursive: true, force: true });
  }
});

for (const result of ["PASS", "FAIL"]) {
  test(`successful cleanup preserves journey ${result} and its exit code`, async () => {
    const output = await mkdtemp(path.join(tmpdir(), "m3-success-test-"));
    const temporary = await mkdtemp(path.join(tmpdir(), "m3-success-db-"));
    try {
      const report = { result, checks: [] };
      assert.equal(await finishVerification(report, { output, temporary, children: [] }), result === "PASS" ? 0 : 1);
      const saved = JSON.parse(await readFile(path.join(output, "results.json"), "utf8"));
      assert.equal(saved.result, result);
      assert.deepEqual(saved.cleanup, { result: "PASS", errors: [] });
      await assert.rejects(stat(temporary), { code: "ENOENT" });
    } finally {
      await rm(temporary, { recursive: true, force: true });
      await rm(output, { recursive: true, force: true });
    }
  });
}
