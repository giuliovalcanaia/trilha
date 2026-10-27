import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

/**
 * Testes das funções puras de `lib/`. Ambiente `node`, sem jsdom: nada aqui
 * renderiza componente. A cobertura fica restrita aos módulos que estes testes
 * exercitam — o resto de `lib/` é I/O com Supabase, coberto por pgTAP
 * (`supabase/tests/`) e pelo E2E.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "coverage",
      include: [
        "lib/dominio/links.ts",
        "lib/dominio/nota.ts",
        "lib/dominio/pastas.ts",
        "lib/dominio/selecao.ts",
        "lib/format.ts",
        "lib/link-preview.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
})
