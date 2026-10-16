// Run with node --test; keep this filename outside Vitest's *.test.* discovery.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { runS04 } from "./run-s04-e2e.mjs";

for (const exitCode of [0, 7]) {
  test(`cleans only this run after forced backend termination and Playwright exit ${exitCode}`, async () => {
    const otherRun = await mkdtemp(path.join(tmpdir(), "s04-browser-"));
    const otherDatabase = path.join(otherRun, "acceptance.db");
    await writeFile(otherDatabase, "another run's database");
    const cli = path.join(otherRun, "fake-playwright.mjs");
    const record = path.join(otherRun, "owned-directory.txt");
    await writeFile(cli, `
      import { spawn } from "node:child_process";
      import { once } from "node:events";
      import { writeFileSync } from "node:fs";
      import path from "node:path";
      const directory = process.env.S04_DATABASE_DIR;
      writeFileSync(${JSON.stringify(record)}, directory);
      const database = path.join(directory, "acceptance.db");
      // Hold the file open in a backend process, then stop it without cleanup.
      const backend = spawn(process.execPath, ["-e", \`
        require("node:fs").openSync(process.argv[1], "w");
        process.send("ready");
        setInterval(() => {}, 1000);
      \`, database], { stdio: ["ignore", "ignore", "inherit", "ipc"] });
      await once(backend, "message");
      const stopped = once(backend, "close");
      backend.kill("SIGKILL");
      await stopped;
      process.exit(${exitCode});
    `);
    let owned;
    try {
      assert.equal(await runS04([], cli), exitCode);
      owned = await readFile(record, "utf8");
      assert.notEqual(owned, otherRun);
      await assert.rejects(stat(owned), { code: "ENOENT" });
      assert.equal(await readFile(otherDatabase, "utf8"), "another run's database");
    } finally {
      if (owned) await rm(owned, { recursive: true, force: true });
      await rm(otherRun, { recursive: true, force: true });
    }
  });
}

test("cleans the owned directory when Playwright fails during startup", async () => {
  const fixture = await mkdtemp(path.join(tmpdir(), "s04-runner-test-"));
  const cli = path.join(fixture, "startup-failure.mjs");
  const record = path.join(fixture, "owned-directory.txt");
  await writeFile(cli, `
    import { writeFileSync } from "node:fs";
    writeFileSync(${JSON.stringify(record)}, process.env.S04_DATABASE_DIR);
    process.exit(2);
  `);
  let owned;
  try {
    assert.equal(await runS04([], cli), 2);
    owned = await readFile(record, "utf8");
    await assert.rejects(stat(owned), { code: "ENOENT" });
  } finally {
    if (owned) await rm(owned, { recursive: true, force: true });
    await rm(fixture, { recursive: true, force: true });
  }
});
