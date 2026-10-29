import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const width of [360, 768, 1440]) {
  for (const theme of ["light", "dark"] as const) {
    test(`vista previa no operativa a ${width}px / ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      const response = await page.goto("/ingresar");
      expect(response?.status()).toBe(200);
      await expect(page.getByText("El acceso todavía no está disponible.")).toBeVisible();
      await expect(page.getByLabel("Correo electrónico")).toBeDisabled();
      await expect(page.getByLabel("Contraseña")).toBeDisabled();
      await expect(page.getByRole("button", { name: "Ingresar" })).toBeDisabled();
      await expect(page.locator("form")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(accessibility.violations).toEqual([]);
    });
  }
}

test("se puede ir y volver con teclado sin enviar credenciales", async ({ page }) => {
  await page.goto("/");
  const link = page.getByRole("link", { name: "Ver el futuro acceso" });
  await link.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/ingresar$/);
  const back = page.getByRole("link", { name: "Volver al inicio" });
  await back.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/$/);
});
