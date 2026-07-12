import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("credenciais inválidas mostram erro e não autenticam", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="email"]').fill("invalido@local.test");
  await page.locator('input[type="password"]').fill("senhaerrada");
  await page.locator('button[type="submit"], form button').first().click();
  await expect(page.getByText("E-mail ou senha inválidos")).toBeVisible();
  await expect(page.locator(".logout")).toHaveCount(0);
});

test("credenciais válidas autenticam e mostram a Visão geral", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();
});
