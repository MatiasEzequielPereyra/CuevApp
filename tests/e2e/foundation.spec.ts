import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";

for (const width of [360, 390, 768, 1440]) {
  for (const theme of ["light", "dark"] as const) {
    test(`${width}px / ${theme}: layout, assets, contrast and accessibility`, async ({ page }) => {
      await page.setViewportSize({ width, height: 960 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      const errors: string[] = [];
      const external: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
      page.on("request", (request) => { if (!request.url().startsWith("http://127.0.0.1:3000/")) external.push(request.url()); });
      const response = await page.goto("/");
      expect(response?.status()).toBe(200);
      await page.getByRole("button", { name: theme === "light" ? "Claro" : "Oscuro", exact: true }).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page).toHaveTitle("CUEVA · Un lugar para avanzar");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Un lugarpara avanzar.");
      await expect(page.getByText("El acceso a cuentas y las funciones del gimnasio todavía no están disponibles.", { exact: false })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const unloaded = await page.locator("img").evaluateAll((images) => images.filter((image) => !(image instanceof HTMLImageElement) || !image.complete || image.naturalWidth === 0).map((image) => image.getAttribute("src")));
      expect(unloaded).toEqual([]);
      expect((await page.request.get("/brand/cueva-symbol.svg")).status()).toBe(200);
      const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(accessibility.violations).toEqual([]);
      expect(errors).toEqual([]);
      expect(external).toEqual([]);
      await page.screenshot({ path: `evidence/runs/home-${width}-${theme}.png`, fullPage: true });
      await writeFile(`evidence/runs/check-${width}-${theme}.json`, JSON.stringify({
        width, theme, pageStatus: response?.status(),
        layout: await page.evaluate(() => ({ innerWidth, scrollWidth: document.documentElement.scrollWidth })),
        unloadedImages: unloaded, browserErrors: errors, externalRequests: external,
        axe: { violations: accessibility.violations, incomplete: accessibility.incomplete.map(({ id }) => id), passedRules: accessibility.passes.map(({ id }) => id) },
      }, null, 2));
    });
  }
}

test("keyboard skip link moves focus to the main content", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Saltar al contenido" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
});

test("keyboard reaches theme choices and project with visible focus", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "CUEVA, inicio" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Claro", exact: true })).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.keyboard.press("Tab");
  const dark = page.getByRole("button", { name: "Oscuro", exact: true });
  await expect(dark).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dark).toHaveAttribute("aria-pressed", "true");
  const focus = await dark.evaluate((button) => {
    const style = getComputedStyle(button);
    return { width: style.outlineWidth, style: style.outlineStyle, offset: style.outlineOffset, matches: button.matches(":focus-visible") };
  });
  expect(focus).toEqual({ width: "3px", style: "solid", offset: "5px", matches: true });
  await page.screenshot({ path: "evidence/runs/keyboard-focus.png", fullPage: true });
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const project = page.getByRole("link", { name: "Conocé el proyecto" });
  await expect(project).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#proyecto$/);
});

test("theme survives reload, follows system and synchronizes across tabs", async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Claro", exact: true }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const other = await context.newPage();
  await other.goto("/");
  await expect(other.locator("html")).toHaveAttribute("data-theme", "light");
  await other.getByRole("button", { name: "Oscuro", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Sistema", exact: true }).click();
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("storage denied or corrupted does not prevent using appearance controls", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Unavailable", "SecurityError"); } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Oscuro", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Claro", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("invalid saved theme falls back to system", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("cueva:appearance:v1", "invalid"));
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Sistema", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("no JavaScript: content and anchor navigation remain available", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, colorScheme: "dark", viewport: { width: 360, height: 960 } });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:3000/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator(".noscript-note")).toBeVisible();
  await expect(page.getByRole("group", { name: "Elegir tema" })).toBeHidden();
  await page.getByRole("link", { name: "Conocé el proyecto" }).click();
  await expect(page).toHaveURL(/#proyecto$/);
  await context.close();
});

test("zoom-equivalent reflow and local-only scope", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator("form, input, video, iframe")).toHaveCount(0);
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
  const admin = await page.request.get("/admin");
  expect(admin.status()).toBe(404);
});
