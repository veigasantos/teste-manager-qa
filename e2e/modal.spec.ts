import { test, expect } from "@playwright/test";
import { login } from "./helpers";

// Regressão: o drawer de "Novo teste" não fechava com Esc (só com clique
// no X ou no fundo). Ver AGENTS.md / histórico de auditoria.
test("Esc fecha o modal de novo teste", async ({ page }) => {
  await login(page);
  await page.locator('button[title="Testes"]').click();
  await page.getByText("Novo teste", { exact: false }).first().click();
  await expect(page.locator(".drawerBack")).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(page.locator(".drawerBack")).toHaveCount(0);
});
