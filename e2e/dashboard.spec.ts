import { test, expect } from "@playwright/test";
import { login } from "./helpers";

// Cobre os cards de métrica adicionados a pedido do usuário (inspirados na
// planilha original): Bloqueados, Severidade Crítica e Severidade Alta.
test("dashboard mostra os cards de Bloqueados e Severidade", async ({ page }) => {
  await login(page);
  await expect(page.locator(".metric", { hasText: "Bloqueados" })).toBeVisible();
  await expect(
    page.locator(".metric", { hasText: "Severidade Crítica" }),
  ).toBeVisible();
  await expect(page.locator(".metric", { hasText: "Severidade Alta" })).toBeVisible();
});
