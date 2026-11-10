import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    // Generated/ignored review checkouts are not a second copy of source tests.
    // Real-DB integration and Playwright retain their dedicated npm scripts.
    include: ["src/tests/**/*.test.{ts,tsx}"],
    maxWorkers: 2,
  },
});
