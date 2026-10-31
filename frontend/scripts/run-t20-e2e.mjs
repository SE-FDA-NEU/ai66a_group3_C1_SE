import { spawn } from "node:child_process";
import { connect } from "node:net";
import { setTimeout as delay } from "node:timers/promises";

const port = 5182;
async function portInUse() {
  return new Promise(resolve => {
    const socket = connect({ host: "127.0.0.1", port });
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", () => resolve(false));
  });
}

async function stopOwned(child) {
  if (!child.pid || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise(resolve => child.once("close", resolve)),
    delay(3000),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

if (await portInUse()) throw new Error(`Port ${port} is already in use`);
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host",
  "127.0.0.1", "--port", String(port), "--strictPort"],
{ cwd: process.cwd(), windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
let output = "";
for (const stream of [server.stdout, server.stderr])
  stream.on("data", chunk => { output = (output + chunk.toString()).slice(-4000); });
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error(`Vite exited early: ${output}`);
    try { ready = (await fetch(`http://127.0.0.1:${port}/`)).ok; } catch { /* starting */ }
    if (ready) break;
    await delay(250);
  }
  if (!ready) throw new Error(`Vite did not start: ${output}`);
  const test = spawn(process.execPath, ["node_modules/@playwright/test/cli.js", "test",
    "--config", "playwright.t20.config.ts"], { cwd: process.cwd(), stdio: "inherit" });
  const code = await new Promise((resolve, reject) => {
    test.once("error", reject);
    test.once("close", resolve);
  });
  process.exitCode = code ?? 1;
} finally {
  await stopOwned(server);
}
