import { expect, test, type Page } from "@playwright/test";
import { signIn, startStudentsApp, studentFixture } from "./admin-students-fixture";
import { routineEditorFixture } from "./routine-editor-fixture";

test.describe.configure({ mode: "default" });
const origin = "http://127.0.0.1:3261";
const learner = routineEditorFixture();
let backend: Awaited<ReturnType<typeof studentFixture>>;
let app: ReturnType<typeof startStudentsApp>;

test.beforeAll(async () => {
  backend = await studentFixture((request, url) => {
    if (url.pathname === "/cueva_notification_inbox") return Promise.resolve({ body: [] });
    return learner.handle(request, url);
  });
  app = startStudentsApp(origin, backend.endpoint);
  await expect.poll(async () => {
    try { return (await fetch(`${origin}/ingresar`)).status; } catch { return 0; }
  }, { timeout: 30_000 }).toBe(200);
});

test.afterAll(async () => {
  try { await app?.close(); } finally { await backend?.close(); }
});

async function device(page: Page, {
  standalone = true, permission = "default", requested = "granted", supported = true, subscribed = false, apple = false,
}: { standalone?: boolean; permission?: NotificationPermission; requested?: NotificationPermission;
    supported?: boolean; subscribed?: boolean; apple?: boolean } = {}) {
  await page.addInitScript(config => {
    const state = { permission: config.permission, subscribed: config.subscribed };
    Object.defineProperty(window.navigator, "standalone", { value: config.standalone });
    if (config.apple) Object.defineProperty(window.navigator, "userAgent", { value: "iPhone Safari" });
    if (!config.supported) {
      Reflect.deleteProperty(window, "PushManager");
      Reflect.deleteProperty(window, "Notification");
      return;
    }
    const record = (key: string) => sessionStorage.setItem(key, String(Number(sessionStorage.getItem(key)) + 1));
    Object.defineProperty(window, "Notification", { value: {
      get permission() { return state.permission; },
      requestPermission: async () => { record("permissionCalls"); state.permission = config.requested; return state.permission; },
    } });
    const subscription = { toJSON: () => ({ endpoint: "https://example.test/synthetic" }) };
    const registration = { pushManager: {
      getSubscription: async () => state.subscribed ? subscription : null,
      subscribe: async () => { record("subscribeCalls"); state.subscribed = true; return subscription; },
    } };
    Object.defineProperty(window.navigator, "serviceWorker", { value: {
      getRegistration: async () => registration,
      register: async () => registration,
      ready: Promise.resolve(registration),
    } });
  }, { standalone, permission, requested, supported, subscribed, apple });
}

async function pushApi(page: Page, initialRegistered = false) {
  const state = { registered: initialRegistered, enabled: true, reply: true, registrations: 0, reads: 0, checks: 0 };
  await page.route("**/api/notifications/push*", async route => {
    const request = route.request();
    if (request.method() === "GET") {
      state.reads++;
      return route.fulfill({ json: { available: true, publicKey: "AQ", pushEnabled: state.enabled } });
    }
    if (request.method() === "PUT") {
      expect(request.postDataJSON()).toEqual({ enabled: false });
      state.enabled = false;
      return route.fulfill({ json: { pushEnabled: false } });
    }
    if (new URL(request.url()).searchParams.has("check")) {
      state.checks++;
      return route.fulfill({ json: { registered: state.registered } });
    }
    state.registrations++;
    if (state.reply) { state.registered = true; state.enabled = true; }
    return route.fulfill({ json: { registered: state.reply } });
  });
  return state;
}

const bannerName = "Activá las notificaciones de CUEVA";
const permissionCalls = (page: Page) => page.evaluate(() => Number(sessionStorage.getItem("permissionCalls")));

test("Inicio instalado pide permiso solo al pulsar y confirma un solo registro", async ({ page, context }) => {
  await signIn(context, origin, learner.studentUser);
  await device(page);
  const api = await pushApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/cuenta`);
  const banner = page.getByRole("complementary", { name: bannerName });
  await expect(banner).toBeVisible();
  expect(await permissionCalls(page)).toBe(0);
  expect(api.registrations).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const activate = banner.getByRole("button", { name: "Activar notificaciones" });
  await activate.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(page.getByRole("heading", { name: "Notificaciones activadas" })).toBeVisible();
  expect(await permissionCalls(page)).toBe(1);
  expect(api.registrations).toBe(1);
  expect(await page.evaluate(() => Number(sessionStorage.getItem("subscribeCalls")))).toBe(1);
});

test("Ahora no se conserva al volver a Inicio y Avisos permite activar, desactivar y reactivar", async ({ page, context }) => {
  await signIn(context, origin, learner.studentUser);
  await device(page, { permission: "granted" });
  const api = await pushApi(page);
  api.reply = false;
  await page.goto(`${origin}/cuenta`);
  await page.getByRole("complementary", { name: bannerName }).getByRole("button", { name: "Ahora no" }).click();
  await page.getByRole("link", { name: "Avisos y notificaciones" }).click();
  await page.getByRole("button", { name: "Activar en este dispositivo" }).click();
  await expect(page.getByText("No pudimos confirmar el registro de este dispositivo.")).toBeVisible();
  await expect(page.getByText("Notificaciones activadas", { exact: true })).toHaveCount(0);
  api.reply = true;
  await page.getByRole("button", { name: "Activar en este dispositivo" }).click();
  await expect(page.getByText("Notificaciones activadas", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Desactivar push en mi cuenta" }).click();
  await expect(page.getByText("Notificaciones activadas", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Volver a activar push" }).click();
  await expect(page.getByText("Notificaciones activadas", { exact: true })).toBeVisible();
  expect(api.registrations).toBe(3);
  expect(await page.evaluate(() => Number(sessionStorage.getItem("subscribeCalls")))).toBe(1);
  expect(await permissionCalls(page)).toBe(0);
  await page.getByRole("link", { name: "Inicio", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/cuenta`);
  await expect(page.getByRole("complementary", { name: bannerName })).toHaveCount(0);
  expect(api.reads).toBe(2);
});

test("dispositivo ya registrado se comprueba y no muestra invitación", async ({ page, context }) => {
  await signIn(context, origin, learner.studentUser);
  await device(page, { permission: "granted", subscribed: true });
  const api = await pushApi(page, true);
  await page.goto(`${origin}/cuenta`);
  await expect.poll(() => api.checks).toBe(1);
  await expect(page.getByRole("complementary", { name: bannerName })).toHaveCount(0);
  await page.getByRole("link", { name: "Avisos y notificaciones" }).click();
  await expect(page.getByText("Notificaciones activadas", { exact: true })).toBeVisible();
  expect(api.registrations).toBe(0);
  expect(await permissionCalls(page)).toBe(0);
});

for (const [scenario, config, message] of [
  ["denegado", { permission: "denied" }, /las notificaciones están bloqueadas/i],
  ["no compatible", { supported: false }, /no admite avisos push/i],
  ["iPhone en navegador", { standalone: false, apple: true }, /agregar a pantalla de inicio.*desde su ícono/i],
] as const) {
  test(`${scenario}: Avisos explica qué hacer sin pedir permiso`, async ({ page, context }) => {
    await signIn(context, origin, learner.studentUser);
    await device(page, config);
    const api = await pushApi(page);
    await page.goto(`${origin}/notificaciones`);
    const settings = page.getByRole("region", { name: "Avisos en este dispositivo" });
    await expect(settings.getByText(message)).toBeVisible();
    await expect(settings.getByRole("button", { name: "Activar en este dispositivo" })).toHaveCount(0);
    expect(await permissionCalls(page)).toBe(0);
    expect(api.registrations).toBe(0);
  });
}

test("Inicio nunca ofrece activación al visitante ni al administrador", async ({ page, context }) => {
  await device(page);
  const api = await pushApi(page);
  await page.goto(`${origin}/cuenta`);
  await expect(page).toHaveURL(`${origin}/ingresar`);
  await signIn(context, origin);
  await page.goto(`${origin}/cuenta`);
  await expect(page.getByRole("navigation", { name: "Navegación del alumno" })).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: bannerName })).toHaveCount(0);
  expect(api.reads).toBe(0);
});
