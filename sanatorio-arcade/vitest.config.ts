import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Config separada da do app (vite.config.ts): testes de unidade não precisam
 * do plugin do TanStack Start, do nitro nem do build da Cloudflare — só do
 * alias @/* e de um DOM para os módulos que leem localStorage.
 */
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    // Um só jsdom para todos os arquivos: nenhum teste aqui depende de globals
    // isolados entre arquivos, e recriar o DOM por arquivo é o que mais pesa
    // numa suíte pequena como esta.
    isolate: false,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
