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
    rollupOptions: {
      output: {
        /**
         * As bibliotecas mudam muito menos do que o código da aplicação. Em
         * ficheiros próprios, ficam na cache do browser entre deploys em vez
         * de serem descarregadas outra vez a cada correção de texto.
         */
        manualChunks: {
          // `react-dom/client` e `react/jsx-runtime` são entradas próprias: sem
          // as nomear, o react-dom inteiro ficava no pedaço principal e a
          // separação não servia de nada.
          react: [
            "react",
            "react/jsx-runtime",
            "react-dom",
            "react-dom/client",
            "react-router-dom",
          ],
          query: ["@tanstack/react-query"],
          forms: ["react-hook-form", "@hookform/resolvers", "zod"],
        },
      },
    },
    esbuild: {
      drop: mode === "production" ? ["console", "debugger"] : [],
    },
  },
}));
