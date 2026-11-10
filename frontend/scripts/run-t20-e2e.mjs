import { runS04 } from "./run-s04-e2e.mjs";

// Reuse the existing owner of temporary DBs, isolated Vite caches and servers.
// No user application server or database is reused.
process.exitCode = await runS04(["--config", "playwright.t20.config.ts", ...process.argv.slice(2)]);
