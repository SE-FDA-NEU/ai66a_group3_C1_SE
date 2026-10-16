import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dedicated acceptance ports; normal development services are never reused.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": { target: "http://127.0.0.1:8014", changeOrigin: true } },
  },
});
