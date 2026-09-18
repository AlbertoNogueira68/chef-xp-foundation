import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],

  /**
   * `PROD` e `DEV` vêm do modo da build, e não do `NODE_ENV`.
   *
   * Isto não é preferência: é a correção de uma armadilha real. O Vite lê o
   * mesmo `.env` que o servidor Express usa, e lá dentro está
   * `NODE_ENV=development` — que o servidor precisa. O Vite herdava-o e, num
   * `vite build`, punha `import.meta.env.PROD` a `false`. Tudo o que estivesse
   * atrás de `if (import.meta.env.PROD)` desaparecia do bundle como código
   * morto, sem um aviso em lado nenhum. Foi assim que o registo do service
   * worker deixou de existir na build: o ficheiro estava lá, o código que o
   * registava não.
   *
   * O `mode` é o que a linha de comandos diz — "production" num `vite build`,
   * "development" no `vite` — e é essa a verdade que interessa ao código do
   * browser.
   */
  define: {
    "import.meta.env.PROD": JSON.stringify(mode === "production"),
    "import.meta.env.DEV": JSON.stringify(mode !== "production"),
  },
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
