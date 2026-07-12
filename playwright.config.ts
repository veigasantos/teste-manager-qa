import { defineConfig } from "@playwright/test";

// Esta máquina bloqueia (via política WDAC) o Chromium que o Playwright
// baixaria por padrão. Por isso usamos o Edge já instalado no sistema
// (assinado e aprovado) através da opção "channel", em vez do navegador
// que o Playwright gerenciaria sozinho. Veja AGENTS.md para mais contexto.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    channel: "msedge",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
