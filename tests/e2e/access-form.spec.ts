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

test("recuperación: enlace visible, envío único y respuesta genérica", async ({ page }) => {
  let calls = 0;
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/acceso/recuperar", async route => {
    calls++;
    await waiting;
    await route.fulfill({ status: 202, contentType: "application/json", body: '{"ok":true}' });
  });
  await page.goto("/ingresar");
  await page.getByRole("link", { name: "¿Olvidaste tu contraseña?" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/recuperar-contrasena$/);
  await page.getByLabel("Correo electrónico").fill("persona@example.test");
  await page.getByRole("button", { name: "Enviar enlace", exact: true }).click();
  await expect(page.getByRole("button", { name: "Procesando…" })).toBeDisabled();
  await page.keyboard.press("Enter");
  release();
  await expect(page.getByRole("status")).toContainText("Si existe una cuenta");
  await expect(page.getByRole("button", { name: "Solicitud procesada" })).toBeDisabled();
  expect(calls).toBe(1);
  for (const [width, theme] of [[390, "Claro"], [1440, "Oscuro"]] as const) {
    await page.setViewportSize({ width, height: 850 });
    await page.getByRole("button", { name: theme, exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("recuperación: token en memoria, coincidencia y confirmación antes del retorno al ingreso", async ({ page }) => {
  const token = "a".repeat(64);
  let calls = 0;
  await page.route("**/api/acceso/restablecer", route => {
    calls++;
    const body = route.request().postDataBuffer()!.toString();
    expect(body).toContain(token);
    return route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
  });
  await page.goto(`/recuperar-contrasena#token_hash=${token}&type=recovery`);
  await expect(page).toHaveURL(/\/recuperar-contrasena$/);
  const password = page.getByLabel("Contraseña nueva", { exact: true });
  const confirmation = page.getByLabel("Confirmar contraseña");
  await password.fill("Synthetic-next-123");
  await confirmation.fill("Synthetic-different-456");
  await page.getByRole("button", { name: "Guardar contraseña", exact: true }).click();
  const feedback = page.getByRole("region", { name: "Recuperación de contraseña" }).getByRole("alert");
  await expect(feedback).toHaveText("Las contraseñas no coinciden.");
  await expect(feedback).toBeFocused();
  expect(calls).toBe(0);
  await confirmation.fill("Synthetic-next-123");
  await page.getByRole("button", { name: "Guardar contraseña", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Contraseña actualizada" })).toBeVisible();
  await expect(page).toHaveURL(/\/ingresar$/);
  expect(calls).toBe(1);
  expect(await page.context().cookies()).toEqual([]);
});

test("recuperación: enlace rechazado o actualización incierta nunca muestra éxito", async ({ page }) => {
  for (const status of [400, 503]) {
    await page.route("**/api/acceso/restablecer", route => route.fulfill({ status, contentType: "application/json", body: '{"error":"enlace"}' }));
    await page.goto(`/recuperar-contrasena#token_hash=${"b".repeat(64)}&type=recovery`);
    await page.getByLabel("Contraseña nueva", { exact: true }).fill("Synthetic-next-123");
    await page.getByLabel("Confirmar contraseña").fill("Synthetic-next-123");
    await page.getByRole("button", { name: "Guardar contraseña", exact: true }).click();
    await expect(page.getByRole("region", { name: "Recuperación de contraseña" }).getByRole("alert")).toContainText("Solicitá uno nuevo");
    await expect(page.getByLabel("Correo electrónico")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Contraseña actualizada" })).toHaveCount(0);
    await page.unroute("**/api/acceso/restablecer");
  }
});

test("formulario activo: identidad, temas, teclado y accesibilidad", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/ingresar$/);
  await expect(page.getByLabel("Correo electrónico")).toBeEnabled();
  await expect(page.getByLabel("Correo electrónico")).toHaveAttribute("autocomplete", "username");
  await expect(page.getByLabel("Correo electrónico")).toHaveAttribute("type", "email");
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveAttribute("autocomplete", "current-password");
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveAttribute("type", "password");
  const remember = page.getByRole("checkbox", { name: "Mantener sesión iniciada" });
  await expect(remember).not.toBeChecked();
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
  await expect(remember).toBeFocused();
  await page.keyboard.press("Space");
  await expect(remember).toBeChecked();
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
    expect(route.request().postData()).toContain('name="remember"\r\n\r\n1');
    await gate;
    await route.fulfill({ status: 401, body: "INTERNAL_ACCOUNT_DETAIL" });
  });
  await page.goto("/ingresar");
  await fill(page);
  await page.getByRole("checkbox", { name: "Mantener sesión iniciada" }).check();
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

test("una redirección de ingreso sin sesión vuelve al formulario y permite reintentar", async ({ page }) => {
  await page.route("**/api/acceso/ingresar", route => route.fulfill({ status: 303, headers: { location: "/cuenta" } }));
  await page.goto("/ingresar");
  await fill(page);
  const submit = page.getByRole("button", { name: "Ingresar", exact: true });
  await submit.click();
  await expect(page.locator("form").getByRole("alert")).toContainText("El acceso no está disponible en este momento.");
  await expect(page).toHaveURL(/\/ingresar$/);
  await expect(submit).toBeEnabled();
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveValue("");
  const response = await page.request.get("/cuenta", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe("/ingresar");
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(await page.context().cookies()).toEqual([]);
});
