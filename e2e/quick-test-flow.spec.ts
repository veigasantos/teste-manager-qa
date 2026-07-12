import { test, expect } from "@playwright/test";
import { login } from "./helpers";

// Cobre o fluxo central do produto: caso + execução + bug no mesmo
// formulário (AGENTS.md), incluindo o link de evidência colado, e a
// atualização de status na tela de Bugs.
test("criar teste falho com link de evidência aparece em Bugs e permite mudar status", async ({
  page,
}) => {
  const scenario = `E2E evidencia ${Date.now()}`;

  await login(page);
  await page.locator('button[title="Testes"]').click();
  await page.getByText("Novo teste", { exact: false }).first().click();

  await page
    .locator('input[placeholder*="Descreva objetivamente"]')
    .fill(scenario);
  await page.locator("select.resultSelect").selectOption("FAILED");
  await page.locator("textarea").nth(0).fill("1. Passo único");
  await page.locator("textarea").nth(1).fill("Resultado esperado");
  await page.locator("textarea").nth(2).fill("Resultado obtido diferente");
  await page.locator(".bugBox textarea").first().fill("Bug criado pelo teste E2E");
  await page
    .locator(".bugBox textarea")
    .last()
    .fill("https://drive.google.com/file/d/E2E_EVIDENCE/view");

  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/v1/cases/quick")),
    page.locator('button.btn.primary:has-text("Salvar")').click(),
  ]);

  await page.locator('button[title="Bugs"]').click();
  const bugRow = page.locator("tr", { hasText: scenario });
  await expect(bugRow).toBeVisible();
  await expect(bugRow.locator(".evidenceCell a")).toHaveAttribute(
    "href",
    "https://drive.google.com/file/d/E2E_EVIDENCE/view",
  );

  await bugRow.locator("select.inlineStatus").selectOption("IN_PROGRESS");
  await expect(page.getByText("Status atualizado")).toBeVisible();

  // limpeza: o teste não deve deixar dados para trás no ambiente
  await page.locator('button[title="Testes"]').click();
  const testRow = page.locator("tr", { hasText: scenario });
  page.once("dialog", (d) => d.accept());
  await testRow.locator('button[title="Excluir"]').click();
  await expect(testRow).toHaveCount(0);
});
