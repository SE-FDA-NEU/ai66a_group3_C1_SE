import "@testing-library/jest-dom/vitest";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import App from "../src/App.tsx";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const expected = ["Action Z", "Comedy C", "Action A", "Comedy A", "Comedy B"];

async function startBridge() {
  const localPython = resolve(root, process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python");
  const python = process.env.T16_PYTHON ?? (existsSync(localPython) ? localPython : "python");
  const child = spawn(python, [resolve(root, "backend/tests/support/t16_acceptance_bridge.py")], {
    cwd: root, env: { ...process.env, PYTHONUTF8: "1", TMDB_READ_ACCESS_TOKEN: "" },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let nextId = 0;
  let stderr = "";
  let closing = false;
  let hasExited = false;
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  let readyResolve!: () => void;
  let readyReject!: (error: Error) => void;
  const ready = new Promise<void>((done, fail) => { readyResolve = done; readyReject = fail; });
  let exitedResolve!: () => void;
  const exited = new Promise<void>((done) => { exitedResolve = done; });
  child.stderr.on("data", (chunk) => { stderr = (stderr + String(chunk)).slice(-5000); });
  const lines = createInterface({ input: child.stdout });
  const fail = (error: Error) => {
    readyReject(error);
    pending.forEach((request) => request.reject(error)); pending.clear();
    if (!hasExited) child.kill();
  };
  lines.on("line", (line) => {
    try {
      const message = JSON.parse(line) as { ready?: boolean; id?: number; result?: unknown };
      if (message.ready) readyResolve();
      if (message.id !== undefined) {
        pending.get(message.id)?.resolve(message.result); pending.delete(message.id);
      }
    } catch {
      fail(new Error("T16 bridge returned invalid JSON"));
    }
  });
  child.on("error", fail);
  child.on("exit", (code) => {
    hasExited = true; exitedResolve();
    if (!closing || code !== 0) fail(new Error(`T16 bridge exited ${code}: ${stderr}`));
  });
  const startupTimer = setTimeout(() => fail(new Error(`T16 bridge startup timed out: ${stderr}`)), 30_000);
  try { await ready; } finally { clearTimeout(startupTimer); }
  function call(op: string, data: Record<string, unknown> = {}) {
    if (hasExited) return Promise.reject(new Error("T16 bridge is not running"));
    const id = ++nextId;
    return new Promise<unknown>((done, failRequest) => {
      const timer = setTimeout(() => fail(new Error(`T16 bridge operation timed out: ${op}`)), 10_000);
      pending.set(id, {
        resolve: (value) => { clearTimeout(timer); done(value); },
        reject: (error) => { clearTimeout(timer); failRequest(error); },
      });
      child.stdin.write(JSON.stringify({ id, op, ...data }) + "\n", (error) => {
        if (error) fail(error);
      });
    });
  }
  return {
    call,
    close: async () => {
      if (hasExited) { lines.close(); return; }
      closing = true;
      try { await call("close"); } finally {
        child.stdin.end();
        const shutdownTimer = setTimeout(() => child.kill(), 5_000);
        await exited; clearTimeout(shutdownTimer); lines.close();
      }
    },
  };
}

let bridge: Awaited<ReturnType<typeof startBridge>>;
beforeAll(async () => { bridge = await startBridge(); });
afterAll(async () => {
  cleanup(); vi.restoreAllMocks(); window.history.replaceState({}, "", "/");
  if (bridge) await bridge.close();
});

it("real React actions preserve committed SQLite preferences for both accounts", async () => {
  const before = await bridge.call("preferences") as [string, number][];
  expect(before).toHaveLength(3);
  const calls: { url: string; method: string }[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, options) => {
    const url = String(input); const method = options?.method ?? "GET";
    expect(options?.credentials).toBe("include");
    calls.push({ url, method });
    // Substitute only transport: response bodies come from the real API/DB.
    const request = { url, method, ...(typeof options?.body === "string" ? { body: JSON.parse(options.body) } : {}) };
    const result = await bridge.call("request", request) as { status: number; body: unknown };
    // Exercise asynchronously loaded options after every filter remount. The
    // UI must be ready before a real user could select the next genre.
    if (url === "/api/genres") await new Promise(done => setTimeout(done, 100));
    return new Response(JSON.stringify(result.body), { status: result.status, headers: { "Content-Type": "application/json" } });
  });
  window.history.pushState({}, "", "/recommendations"); render(<App />);
  const select = await screen.findByRole("combobox", { name: "Filter by genre" });
  await waitFor(() => expect(select).toBeEnabled());
  const filterSelect = () => screen.getByRole("combobox", { name: "Filter by genre" });
  async function chooseGenre(value: string) {
    // A new result mounts a new filter and reloads its genre options. Wait for
    // the live control each time; firing change on a disabled/empty select can
    // turn the intended value into "" and accidentally clear the filter.
    await waitFor(() => {
      const control = filterSelect() as HTMLSelectElement;
      expect(control).toBeEnabled();
      expect([...control.options].map(option => option.value)).toContain(value);
    });
    fireEvent.change(filterSelect(), { target: { value } });
  }
  const titles = () => [...document.querySelectorAll(".movie-card h2")].map((node) => node.textContent);
  expect(titles()).toEqual(expected);
  const baseline = [...calls];
  const unchanged = async () => expect(await bridge.call("preferences")).toEqual(before);
  await unchanged();
  await chooseGenre("28");
  await waitFor(() => expect(titles()).toEqual(["Action Z", "Action A"])); await unchanged();
  fireEvent.click(screen.getByRole("button", { name: "Clear filter" }));
  await waitFor(() => expect(titles()).toEqual(expected)); await unchanged();
  await chooseGenre("35");
  await waitFor(() => expect(titles()).toEqual(["Comedy C", "Comedy A", "Comedy B"])); await unchanged();
  await chooseGenre("27");
  await screen.findByText("No movies match this filter.");
  expect(titles()).toEqual([]); await unchanged();
  fireEvent.click(screen.getByRole("button", { name: "Show all movies" }));
  await waitFor(() => expect(titles()).toEqual(expected)); expect(filterSelect()).toHaveValue(""); await unchanged();
  const filterCalls = calls.slice(baseline.length);
  expect(filterCalls.some(({ url }) => url.includes("genreId=28"))).toBe(true);
  expect(filterCalls.some(({ url }) => url.includes("genreId=35"))).toBe(true);
  expect(filterCalls.some(({ url }) => url.includes("genreId=27"))).toBe(true);
  expect(filterCalls.every(({ url }) => url.startsWith("/api/me/recommendations") || url === "/api/genres")).toBe(true);
  expect(calls.every(({ method }) => method === "GET")).toBe(true);
});
