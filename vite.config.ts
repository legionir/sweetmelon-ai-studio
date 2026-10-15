import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  // Sources live in app/, the Sweetmelon build reads the finished app from www/.
  root: path.resolve(__dirname, "app"),
  // Relative URLs: the WebView serves the app from a local asset server.
  base: "./",
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "app/src"),
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    // The preview environment proxies the dev server through its own host.
    allowedHosts: true,
  },
  preview: { host: true, allowedHosts: true },
  build: {
    // index.html, JS, CSS and the cover art end up in one self-contained file.
    outDir: path.resolve(__dirname, "www"),
    emptyOutDir: true,
    target: "es2020",
  },
});
