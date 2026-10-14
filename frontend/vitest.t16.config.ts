import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["integration/t16-filter.acceptance.tsx"],
    environment: "jsdom",
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
