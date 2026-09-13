import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Os testes de interface vivem aqui e não no `node --test` do servidor.
 *
 * A razão é prática: o runner do Node não transforma TSX, e o Vitest reutiliza
 * a configuração do Vite que a aplicação já usa — os mesmos aliases, o mesmo
 * plugin de React. O servidor continua no runner nativo, que não precisa de
 * transformação nenhuma e arranca em milissegundos.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    globals: true,
    restoreMocks: true,
  },
});
