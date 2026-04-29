import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const rawPort = process.env.PORT || "5173";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const rawBasePath = process.env.BASE_PATH ?? '/';

const basePath = rawBasePath.startsWith('/') ? rawBasePath : `/${rawBasePath}`;
const apiTarget = process.env.VITE_API_URL?.trim()
  ? (/^https?:\/\//i.test(process.env.VITE_API_URL)
      ? process.env.VITE_API_URL
      : /^(localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?$/i.test(process.env.VITE_API_URL)
        ? `http://${process.env.VITE_API_URL}`
        : `https://${process.env.VITE_API_URL}`)
  : 'http://127.0.0.1:18083';
const wsTarget = apiTarget.replace(/^http/i, 'ws');

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: "dist/public",
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: { strict: true },
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true },
      "/ws": { target: wsTarget, ws: true, changeOrigin: true },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
