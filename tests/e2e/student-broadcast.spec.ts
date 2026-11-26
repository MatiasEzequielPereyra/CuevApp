import { expect, test } from "@playwright/test";
import { signIn, startStudentsApp, studentFixture } from "./admin-students-fixture";
import { routineEditorFixture } from "./routine-editor-fixture";

test.describe.configure({ mode: "default" });
const origin = "http://127.0.0.1:3262";
const learner = routineEditorFixture();
const calls: Array<{ p_request_id: string; p_title: string; p_body: string }> = [];
let backend: Awaited<ReturnType<typeof studentFixture>>;
let app: ReturnType<typeof startStudentsApp>;

test.beforeAll(async () => {
  backend = await studentFixture(async (request, url) => {
    if (url.pathname === "/cueva_notification_admin_alerts") return { body: [] };
    if (url.pathname === "/cueva_notification_settings") return { body: [{ send_time: "12:00:00" }] };
    if (url.pathname === "/rpc/cueva_send_student_broadcast") {
      const chunks = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      calls.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      if (calls.length === 1) return { status: 503, body: { code: "synthetic" } };
      return { body: { recipients: 2, devices: 1 } };
    }
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

test("Alertas revisa antes de enviar y un reintento conserva la misma operación", async ({ page, context }) => {
  await signIn(context, origin);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/alertas`);
  const composer = page.getByRole("region", { name: "Comunicado para todos los alumnos" });
  await composer.getByLabel("Título").fill("Nuevo horario");
  await composer.getByLabel("Mensaje").fill("El gimnasio abre a las 10 el viernes.");
  await composer.getByRole("button", { name: "Revisar comunicado" }).click();
  await expect(composer.getByText("¿Publicar este comunicado para todos los alumnos habilitados?")).toBeVisible();
  expect(calls).toHaveLength(0);
  await composer.getByRole("button", { name: "Enviar a todos" }).click();
  await expect(composer.getByRole("status")).toContainText("Podés reintentar");
  await expect(composer.getByLabel("Título")).toHaveValue("Nuevo horario");
  await composer.getByRole("button", { name: "Enviar a todos" }).click();
  await expect(composer.getByRole("status")).toHaveText("Publicado en Avisos para 2 alumnos. Push en cola para 1 dispositivo.");
  expect(calls).toHaveLength(2);
  expect(calls[0]).toEqual(calls[1]);
  expect(calls[0]?.p_title).toBe("Nuevo horario");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("el servidor rechaza el comunicado de un alumno y las solicitudes externas", async ({ context, request }) => {
  const data = { id: crypto.randomUUID(), title: "Mensaje", body: "Prueba" };
  await signIn(context, origin, learner.studentUser);
  const endpoint = `${origin}/api/notifications/student-notices`;
  expect((await context.request.post(endpoint, { headers: { origin }, data })).status()).toBe(403);
  expect((await request.post(endpoint, { headers: { origin: "https://external.example.test" }, data })).status()).toBe(403);
  expect((await request.post(`${endpoint}/worker`)).status()).toBe(403);
});
