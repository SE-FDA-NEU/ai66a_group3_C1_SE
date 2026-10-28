import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Dedicated acceptance ports; normal development services are never reused.
export default defineConfig({
  plugins: [react()],
  // Worktrees may share node_modules with a live dev server. Keep each owned
  // acceptance run's optimizer artifacts with its own temporary resources.
  cacheDir: process.env.S04_DATABASE_DIR
    ? path.join(process.env.S04_DATABASE_DIR, "vite-cache")
    : "node_modules/.vite-s04",
  server: {
    proxy: { "/api": { target: "http://127.0.0.1:8014", changeOrigin: true } },
  },
});
