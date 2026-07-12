import { Page, expect } from "@playwright/test";

export async function login(
  page: Page,
  email = "admin@local.test",
  password = "demo123",
) {
  await page.goto("/");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"], form button').first().click();
  // Usamos o botão de navegação "Testes" (sempre visível, inclusive no
  // mobile) como sinal de login bem-sucedido — o botão "Sair" fica dentro
  // de um bloco que o CSS esconde em telas estreitas.
  await expect(page.locator('button[title="Testes"]')).toBeVisible();
}
