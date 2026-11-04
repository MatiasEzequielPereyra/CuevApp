import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const width of [360, 768, 1440]) {
  for (const theme of ["light", "dark"] as const) {
    test(`vista previa no operativa a ${width}px / ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      const response = await page.goto("/ingresar");
      expect(response?.status()).toBe(200);
      await expect(page.getByText("El acceso no está disponible en este entorno.")).toBeVisible();
      await expect(page.getByLabel("Correo electrónico")).toBeDisabled();
      await expect(page.getByLabel("Contraseña")).toBeDisabled();
      await expect(page.getByRole("button", { name: "Ingresar" })).toBeDisabled();
      await expect(page.locator("form")).toHaveAttribute("method", "post");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(accessibility.violations).toEqual([]);
    });
  }
}

test("la raíz redirige al ingreso sin bucle y la ayuda no promete correo", async ({ page, request }) => {
  const root = await request.get("/", { maxRedirects: 0 });
  expect(root.status()).toBe(307);
  expect(root.headers().location).toBe("/ingresar");
  await page.goto("/");
  await expect(page).toHaveURL(/\/ingresar$/);
  await page.getByRole("link", { name: "CUEVA, inicio" }).click();
  await expect(page).toHaveURL(/\/ingresar$/);
  await expect(page.getByText("Contactá al gimnasio", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: /registro|recuperar|contraseña/i })).toHaveCount(0);
});

test("el laboratorio no se habilita en producción aunque exista la bandera", async ({ request }) => {
  expect((await request.get("/laboratorio/login")).status()).toBe(404);
  expect((await request.get("/laboratorio/data")).status()).toBe(404);
  expect((await request.post("/laboratorio/action/login", { form: {} })).status()).toBe(404);
});

test("el acceso de producto permanece cerrado sin configuración", async ({ request }) => {
  expect((await request.get("/aceptar-invitacion")).status()).toBe(404);
  expect((await request.get("/crear-contrasena")).status()).toBe(404);
  expect((await request.get("/cuenta")).status()).toBe(404);
  expect((await request.post("/api/acceso/ingresar", { form: {} })).status()).toBe(404);
});
