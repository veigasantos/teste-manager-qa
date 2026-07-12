import { test, expect } from "@playwright/test";
import { login } from "./helpers";

// Regressão: no mobile (390px), cards e gráfico do dashboard "vazavam"
// horizontalmente por causa de um "grid blowout" (min-width implícito de
// itens de grid/flex que não respeitava a largura do container).
test.use({ viewport: { width: 390, height: 844 } });

test("dashboard não vaza horizontalmente no mobile", async ({ page }) => {
  await login(page);

  const offenders = await page.evaluate(() => {
    const bad: string[] = [];
    document
      .querySelectorAll(".metrics, .metric, .grid2, .card, .top, .bar")
      .forEach((el) => {
        // +5px de tolerância: arredondamento sub-pixel de grid/flex em
        // larguras fracionadas não é o "vazamento" real que este teste
        // cobre — só um overflow bem maior indica regressão de layout.
        if (el.scrollWidth > el.clientWidth + 5) {
          bad.push(`${el.className} (${el.scrollWidth}px em ${el.clientWidth}px)`);
        }
      });
    return bad;
  });

  expect(offenders).toEqual([]);
});
