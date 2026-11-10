import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const frontend = fileURLToPath(new URL("..", import.meta.url));
const root = path.resolve(frontend, "..");
const defaultCli = path.join(frontend, "node_modules/@playwright/test/cli.js");

async function portInUse(port) {
  return new Promise(resolve => {
    const socket = connect({ host: "127.0.0.1", port });
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", () => resolve(false));
    socket.setTimeout(1000, () => { socket.destroy(); resolve(false); });
  });
}

function launchServer(command, args, cwd, env) {
  const server = spawn(command, args, {
    cwd, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  });
  server.output = "";
  server.on("error", error => { server.launchError = error; });
  for (const stream of [server.stdout, server.stderr])
    stream.on("data", chunk => { server.output = (server.output + chunk.toString()).slice(-20_000); });
  return server;
}

async function waitForServers(servers) {
  const urls = ["http://127.0.0.1:8014/__acceptance/ready", "http://127.0.0.1:5174/"];
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (servers.some(server => server.launchError || server.exitCode !== null || server.signalCode !== null))
      throw new Error(`An S04 server exited before becoming ready:\n${servers.map(server => server.output).join("\n")}`);
    const ready = await Promise.all(urls.map(async url => {
      try { return (await fetch(url, { signal: AbortSignal.timeout(1500) })).ok; }
      catch { return false; }
    }));
    if (ready.every(Boolean)) return;
    await delay(250);
  }
  throw new Error(`S04 servers did not become ready within 30 seconds:\n${servers.map(server => server.output).join("\n")}`);
}

async function stopServer(server) {
  if (!server?.pid || server.exitCode !== null || server.signalCode !== null) return;
  if (process.platform === "win32") {
    await new Promise((resolve, reject) => {
      const killer = spawn("taskkill", ["/PID", String(server.pid), "/T", "/F"], {
        windowsHide: true, stdio: "ignore",
      });
      killer.once("error", reject);
      killer.once("close", code => code === 0 ? resolve() : reject(new Error(`taskkill exited ${code}`)));
    });
  } else {
    server.kill("SIGTERM");
  }
}

async function removeOwnedDirectory(directory) {
  const resolved = path.resolve(directory);
  if (path.dirname(resolved) !== path.resolve(tmpdir()) ||
      !path.basename(resolved).startsWith("s04-browser-"))
    throw new Error("Refusing to remove an unexpected S04 database path");
  for (let attempt = 0; attempt <= 30; attempt++) {
    try {
      await rm(resolved, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 30 || !["EBUSY", "EPERM", "ENOTEMPTY"].includes(error.code)) throw error;
      await delay(500);
    }
  }
}

export async function runS04(args = [], playwrightCli = defaultCli) {
  // Only this parent owns the directory. Backend shutdown may be forced on Windows.
  const directory = await mkdtemp(path.join(tmpdir(), "s04-browser-"));
  const externalServers = process.platform === "win32" && playwrightCli === defaultCli;
  const servers = [];
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
    if (externalServers) {
      // Playwright's webServer teardown waits indefinitely on Windows for the
      // shell-launched server processes. Own direct child processes instead.
      if (await portInUse(8014) || await portInUse(5174))
        throw new Error("S04 acceptance ports 8014/5174 are already in use");
      const env = { ...process.env, S04_DATABASE_DIR: directory };
      const python = process.env.S04_PYTHON ?? path.join(root, ".venv", "Scripts", "python.exe");
      servers.push(launchServer(python, ["backend/scripts/s04_acceptance_server.py"], root, env));
      servers.push(launchServer(process.execPath, [
        "node_modules/vite/bin/vite.js", "--config", "vite.s04.config.ts",
        "--host", "127.0.0.1", "--port", "5174", "--strictPort",
      ], frontend, env));
      await waitForServers(servers);
      console.log("s04_managed_servers=true");
    }
    child = spawn(process.execPath, [playwrightCli, "test", "--config", "playwright.s04.config.ts", ...args], {
      cwd: frontend,
      stdio: "inherit",
      env: { ...process.env, S04_DATABASE_DIR: directory,
        S04_EXTERNAL_SERVERS: externalServers ? "1" : "0" },
    });
    const code = await new Promise((resolve, reject) => {
      child.once("error", reject);
      // Playwright waits for webServer teardown before exiting.
      child.once("close", (exitCode) => resolve(exitCode ?? 1));
    });
    if (code !== 0 && externalServers)
      for (const server of servers) console.error(`[WebServer] ${server.output.slice(-3000)}`);
    return interrupted ? (interrupted === "SIGINT" ? 130 : 143) : code;
  } finally {
    try {
      // On Windows, also wait for taskkill to finish stopping the process tree.
      await stopping;
      await Promise.all(servers.reverse().map(stopServer));
      if (externalServers) await delay(500);
    } finally {
      try {
        await removeOwnedDirectory(directory);
        console.log("s04_temporary_database_removed=true");
      } finally {
        process.off("SIGINT", onInterrupt);
        process.off("SIGTERM", onTerminate);
      }
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runS04(process.argv.slice(2));
}
