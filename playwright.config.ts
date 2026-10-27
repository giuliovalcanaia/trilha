import { defineConfig, devices } from "@playwright/test"

const PORT = Number(process.env.E2E_PORT ?? 3310)
// `localhost` (e não `127.0.0.1`) porque o Next 16 bloqueia os chunks de dev
// servidos para outra origem; com o host trocado a página não hidrata.
const baseURL = `http://localhost:${PORT}`

/**
 * E2E do fluxo principal. Roda contra o Supabase local e o app na porta 3310
 * (para não brigar com o `npm run dev` do dia a dia).
 *
 * O projeto `setup` reseta o banco antes da suíte; o projeto `chromium` depende
 * dele. Um único fluxo, um worker: nada aqui é paralelo, porque todos os passos
 * compartilham o mesmo banco.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /global\.setup\.ts/,
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: process.env.CI
      ? `npm run build && npm run start -- -p ${PORT}`
      : `npm run dev -- -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
