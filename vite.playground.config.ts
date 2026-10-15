import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Same app, built with the simulated bridge from tool/playground so the
 * native code paths can be exercised in a browser (`npm run playground`).
 */
export default defineConfig({
  root: path.resolve(__dirname, "app"),
  base: "./",
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "app/src"),
    },
  },
  server: { host: true, allowedHosts: true },
  preview: { host: true, port: 4173, strictPort: false, allowedHosts: true },
  build: {
    outDir: path.resolve(__dirname, "playground"),
    emptyOutDir: true,
    target: "es2020",
  },
});
