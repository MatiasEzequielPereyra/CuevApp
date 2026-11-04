import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Real built UI with synthetic server configuration; endpoint responses below
// are controlled in the browser. No provider, account or session is created.
test.describe.configure({ mode: "serial" });
test.use({ baseURL: "http://127.0.0.1:3210", trace: "off", video: "off", screenshot: "off" });
let server: ChildProcess;
const syntheticEnv = { ...process.env, CUEVA_PRODUCT_AUTH_ENABLED: "1", CUEVA_EMAIL_TEMPLATE_READY: "1", CUEVA_DEFAULT_MAIL_OWNER_TEST: "0", CUEVA_SUPABASE_URL: "https://provider.example.test", CUEVA_PRODUCT_ORIGIN: "https://app.example.test", CUEVA_PUBLISHABLE_KEY: "synthetic-public-value", CUEVA_SERVICE_KEY: "synthetic-server-value" };

test.beforeAll(async () => {
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3210"], {
    stdio: "ignore", windowsHide: true,
    env: { ...syntheticEnv, VERCEL_ENV: "production" },
  });
  await expect.poll(async () => {
    try { return (await fetch("http://127.0.0.1:3210/ingresar")).status; } catch { return 0; }
  }, { timeout: 30_000 }).toBe(200);
});
test.afterAll(async () => {
  if (!server || server.exitCode !== null) return;
  const stopped = new Promise<void>(resolve => server.once("exit", () => resolve()));
  server.kill();
  await stopped;
});

async function fill(page: Page) {
  await page.getByLabel("Correo electrónico").fill("persona@example.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("Synthetic-only-123");
}

test("formulario activo: identidad, temas, teclado y accesibilidad", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/ingresar$/);
  await expect(page.getByLabel("Correo electrónico")).toBeEnabled();
  await expect(page.getByLabel("Correo electrónico")).toHaveAttribute("autocomplete", "username");
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveAttribute("autocomplete", "current-password");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Saltar al contenido" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  for (const width of [390, 1440]) {
    for (const theme of ["Claro", "Oscuro"]) {
      await page.setViewportSize({ width, height: 960 });
      await page.getByRole("button", { name: theme, exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
      mkdirSync("evidence/runs", { recursive: true });
      await page.screenshot({ path: `evidence/runs/access-active-${width}-${theme}.png`, fullPage: true });
    }
  }
  await page.getByLabel("Correo electrónico").focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Contraseña", { exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Ingresar", exact: true })).toBeFocused();
});

test("validación nativa evita envíos incompletos", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/acceso/ingresar", route => { calls++; return route.fulfill({ status: 401 }); });
  await page.goto("/ingresar");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page.getByLabel("Correo electrónico")).toBeFocused();
  expect(calls).toBe(0);
});

test("Preview mantiene el formulario cerrado incluso con configuración", async ({ page }) => {
  const preview = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3211"], {
    stdio: "ignore", windowsHide: true, env: { ...syntheticEnv, VERCEL_ENV: "preview" },
  });
  try {
    await expect.poll(async () => {
      try { return (await fetch("http://127.0.0.1:3211/ingresar")).status; } catch { return 0; }
    }, { timeout: 15_000 }).toBe(200);
    await page.goto("http://127.0.0.1:3211/");
    await expect(page).toHaveURL("http://127.0.0.1:3211/ingresar");
    await expect(page.getByLabel("Correo electrónico")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Ingresar", exact: true })).toBeDisabled();
    await expect(page.getByText("El acceso no está disponible en este entorno.")).toBeVisible();
  } finally {
    const stopped = new Promise<void>(resolve => preview.once("exit", () => resolve()));
    preview.kill();
    await stopped;
  }
});

test("un solo POST, estado pendiente y error genérico sin guardar contraseña", async ({ page }) => {
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/acceso/ingresar", async route => {
    calls++;
    expect(route.request().method()).toBe("POST");
    expect(route.request().url()).not.toContain("?");
    expect(route.request().postData()).toContain('name="email"');
    expect(route.request().postData()).toContain('name="password"');
    await gate;
    await route.fulfill({ status: 401, body: "INTERNAL_ACCOUNT_DETAIL" });
  });
  await page.goto("/ingresar");
  await fill(page);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ingresando…" })).toBeDisabled();
  await expect(page.getByRole("status")).toHaveText("Estamos procesando tu ingreso.");
  await page.locator("form").evaluate(form => { if (form instanceof HTMLFormElement) { form.requestSubmit(); form.requestSubmit(); } });
  release();
  await expect(page.locator("form").getByRole("alert")).toContainText("Revisá tu correo y contraseña");
  await expect(page.locator("form").getByRole("alert")).toBeFocused();
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveValue("");
  await expect(page.getByText("INTERNAL_ACCOUNT_DETAIL")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ingresar", exact: true })).toBeEnabled();
  expect(calls).toBe(1);
  expect(await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) }))).toEqual({ local: [], session: [] });
  expect(await page.context().cookies()).toEqual([]);
  await expect(page).toHaveURL(/\/ingresar$/);
});

for (const failure of [403, 404, 429, 503, "network"] as const) {
  test(`fallo ${failure} permite reintentar sin exponer respuesta`, async ({ page }) => {
    await page.route("**/api/acceso/ingresar", route => failure === "network" ? route.abort() : route.fulfill({ status: failure, body: "INTERNAL_DETAIL" }));
    await page.goto("/ingresar");
    await fill(page);
    await page.getByRole("button", { name: "Ingresar", exact: true }).click();
    await expect(page.locator("form").getByRole("alert")).toContainText(failure === "network" ? "Revisá tu conexión" : "Intentá de nuevo más tarde");
    await expect(page.getByLabel("Contraseña", { exact: true })).toHaveValue("");
    await expect(page.getByRole("button", { name: "Ingresar", exact: true })).toBeEnabled();
    await expect(page.getByText("INTERNAL_DETAIL")).toHaveCount(0);
  });
}

test("una respuesta 200 sin redirección no simula ingreso correcto", async ({ page }) => {
  await page.route("**/api/acceso/ingresar", route => route.fulfill({ status: 200, body: "ok" }));
  await page.goto("/ingresar");
  await fill(page);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("El acceso no está disponible");
  await expect(page).toHaveURL(/\/ingresar$/);
});

test("un tiempo de espera agotado permite reintentar", async ({ page }) => {
  await page.clock.install();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/acceso/ingresar", async route => { await gate; await route.abort().catch(() => {}); });
  await page.goto("/ingresar");
  await fill(page);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ingresando…" })).toBeDisabled();
  await page.clock.runFor(20_100);
  await expect(page.locator("form").getByRole("alert")).toContainText("No pudimos confirmar el ingreso");
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveValue("");
  await expect(page.getByRole("button", { name: "Ingresar", exact: true })).toBeEnabled();
  release();
});

test("redirección controlada continúa a cuenta real sin sesión ni bucle", async ({ page }) => {
  await page.route("**/api/acceso/ingresar", route => route.fulfill({ status: 303, headers: { location: "/cuenta" } }));
  await page.goto("/ingresar");
  await fill(page);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page).toHaveURL(/\/cuenta$/);
  await expect(page.getByRole("heading", { name: "Ingresá para continuar" })).toBeVisible();
  const response = await page.request.get("/cuenta");
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(await page.context().cookies()).toEqual([]);
});
