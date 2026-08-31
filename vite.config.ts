import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3010",
        changeOrigin: true,
      },
      // As imagens carregadas são servidas pelo Express em /uploads. Sem isto
      // o Vite responde com o index.html e todas as fotos aparecem partidas.
      "/uploads": {
        target: "http://localhost:3010",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: mode !== "production",
    esbuild: {
      drop: mode === "production" ? ["console", "debugger"] : [],
    },
  },
}));
