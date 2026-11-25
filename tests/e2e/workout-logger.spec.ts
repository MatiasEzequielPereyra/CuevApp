import { expect, test, type Route } from "@playwright/test";
import { signIn, startStudentsApp, studentFixture } from "./admin-students-fixture";
import { routineEditorFixture } from "./routine-editor-fixture";

test.describe.configure({ mode: "serial" });
const origin = "http://127.0.0.1:3268";
const exerciseId = "bbbbbbbb-bbbb-4bbb-8bbb-000000000000";
const publicationId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const routines = routineEditorFixture();
let trackingMode: "weight" | "time" = "weight";
let fixture: Awaited<ReturnType<typeof studentFixture>>;
let app: ReturnType<typeof startStudentsApp>;

function history(value: number) {
  return {
    last_weight_kg: trackingMode === "weight" ? value : null,
    last_duration_seconds: trackingMode === "time" ? value : null,
    entries: [{ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", revision: 1,
      performed_at: "2026-11-24T12:00:00Z", mode: "quick", tracking_mode: trackingMode,
      weight_kg: trackingMode === "weight" ? value : null,
      duration_seconds: trackingMode === "time" ? value : null, sets: [] }],
    has_more: false,
  };
}
const respond = (route: Route, body: unknown) => route.fulfill({ json: body });

test.beforeAll(async () => {
  fixture = await studentFixture(async (request, url) => {
    const row = (value: unknown) => request.headers.accept?.includes("vnd.pgrst.object") ? value : [value];
    if (url.pathname === "/cueva_routine_publications") return { body: row({
      id: publicationId, content: "", plan: null, published_at: "2026-11-24T12:00:00Z",
    }) };
    if (url.pathname === "/cueva_routine_text_publications") return { body: row({
      format: "text", text_content: "Sentadilla", block_content: "",
      mentions: [{ exercise_id: exerciseId, start: 0, end: 10, text: "Sentadilla" }],
    }) };
    if (url.pathname === "/rpc/cueva_student_mentioned_exercises_with_tracking_mode") return { body: [
      { id: exerciseId, name: "Sentadilla", description: "", tracking_mode: trackingMode },
    ] };
    if (url.pathname === "/rpc/cueva_student_assigned_exercises") return { body: [] };
    return routines.handle(request, url);
  });
  app = startStudentsApp(origin, fixture.endpoint);
  await expect.poll(async () => {
    if (app.processHandle.exitCode !== null) throw new Error("Workout fixture exited");
    try { return (await fetch(origin + "/mi-rutina")).status; } catch { return 0; }
  }, { timeout: 55_000 }).toBe(200);
});
test.afterAll(async () => {
  try { await app?.close(); } finally { await fixture?.close(); }
});

for (const mode of ["weight", "time"] as const) {
  for (const source of ["summary", "history", "summary-after-save", "history-after-save"] as const) {
    test(`${mode}: ${source} retenido conserva el valor escrito y el resumen más nuevo`, async ({ page, context }) => {
      trackingMode = mode;
      await signIn(context, origin, routines.studentUser);
      let held: Route | undefined;
      let submitted: Record<string, unknown> | undefined;
      let reads = 0;
      await page.route("**/api/entrenamientos?*", async route => {
        const summary = new URL(route.request().url()).searchParams.get("summary") === "1";
        if (!summary) reads++;
        if ((source === "history" && !summary && reads === 1)
          || (source === "history-after-save" && !summary && reads === 2)
          || ((source === "summary" || source === "summary-after-save") && summary)) {
          held = route;
          return;
        }
        const next = history(submitted ? 80 : 50);
        await respond(route, summary ? { histories: { [exerciseId]: next } } : { history: next });
      });
      await page.route("**/api/entrenamientos", async route => {
        submitted = route.request().postDataJSON();
        await respond(route, { saved: true });
      });
      await page.goto(origin + "/mi-rutina");
      const logger = page.getByRole("region", { name: "Registro de Sentadilla" });
      await logger.getByRole("button", { name: mode === "weight" ? "Registrar peso" : "Registrar duración", exact: true }).click();
      const panel = page.getByRole("dialog", { name: "Registro de Sentadilla" });
      const input = panel.getByLabel(mode === "weight" ? "Peso utilizado (kg)" : "Duración (segundos)", { exact: true });
      await input.fill("80");
      if (source === "summary-after-save" || source === "history-after-save") {
        await logger.getByRole("button", { name: "Guardar resultado", exact: true }).click();
        await expect(logger.getByText("Resultado guardado.", { exact: true })).toBeVisible();
        expect(submitted?.[mode === "weight" ? "weight_kg" : "duration_seconds"]).toBe(80);
        if (source === "summary-after-save") {
          await expect(logger.locator(".student-workout-summary")).toContainText(mode === "weight" ? "80 kg" : "1 min 20 s");
        } else {
          // Inputs stay editable while the post-save GET is in flight.
          await input.fill("90");
        }
      }
      await expect.poll(() => Boolean(held)).toBe(true);
      const stale = history(50);
      const responseDone = page.waitForResponse(response => response.url() === held!.request().url());
      await respond(held!, source === "history" || source === "history-after-save" ? { history: stale } : { histories: { [exerciseId]: stale } });
      await responseDone;
      // Wait for the component to consume the held body, not just receive headers.
      await expect(logger.getByText("Consultando tus últimos registros…", { exact: true })).toHaveCount(0);
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      await expect(input).toHaveValue(source === "history-after-save" ? "90" : "80");
      if (source === "summary-after-save") {
        await expect(logger.locator(".student-workout-summary")).toContainText(mode === "weight" ? "80 kg" : "1 min 20 s");
      }
    });
  }
}
