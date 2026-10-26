import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  base: process.env.VITE_BASE_URL ?? "/app/data",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 4200,
    strictPort: true,
    proxy: {
      "/api": {
        target: process.env.TDB_PROXY_TARGET ?? "http://localhost:7373",
        changeOrigin: true,
      },
    },
  },
  worker: {
    format: "es",
  },
  build: {
    outDir: "../terminusdb/app/data/dist",
    emptyOutDir: true,
    target: "es2022",
  },
  test: {
    environment: "jsdom",
    env: {
      VITE_TDB_URL: "http://localhost:7373",
      VITE_TDB_USER: "admin",
    },
    exclude: ['**/node_modules/**'],
  },
});
