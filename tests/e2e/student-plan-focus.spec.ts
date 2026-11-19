import { expect, test } from "@playwright/test";
import { signIn, startStudentsApp, studentFixture } from "./admin-students-fixture";
import { attachFocusEvidence } from "./focus-evidence";
import { routineEditorFixture } from "./routine-editor-fixture";

const origin = "http://127.0.0.1:3235";
const publicationId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const exerciseId = "bbbbbbbb-bbbb-4bbb-8bbb-000000000001";
const routines = routineEditorFixture();
test.use({ hasTouch: true });
test.describe.configure({ mode: "serial" });
let fixture: Awaited<ReturnType<typeof studentFixture>>;
let app: ReturnType<typeof startStudentsApp>;

test.beforeAll(async () => {
  fixture = await studentFixture(async (request, url) => {
    if (url.pathname === "/cueva_routine_publications") {
      const row = { id: publicationId, content: "", published_at: "2026-11-18T12:00:00Z", plan: { version: 2, days: [
        { id: "push", name: "Empuje", blocks: [{ id: "block", name: "Principal", rounds: 2, exercises: [
          { id: "press", exercise_id: exerciseId, name: "Press militar", mode: "weight", reps: "10", weight_kg: 20, note: "" },
        ] }] },
        { id: "pull", name: "Tirón", blocks: [] },
      ] } };
      return { body: request.headers.accept?.includes("vnd.pgrst.object") ? row : [row] };
    }
    if (url.pathname === "/cueva_routine_text_publications") {
      const row = { publication_id: publicationId, format: "blocks", text_content: "", block_content: "", mentions: [] };
      return { body: request.headers.accept?.includes("vnd.pgrst.object") ? row : [row] };
    }
    if (url.pathname === "/rpc/cueva_my_routine_video_ids") return { body: [exerciseId] };
    if (url.pathname === "/rpc/cueva_student_assigned_exercises") return { body: [] };
    if (url.pathname === "/cueva_notification_inbox") return { body: [{
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", title: "Aviso local de prueba", body: "Contenido sintético",
      created_at: "2026-11-18T12:00:00Z", read_at: null,
    }] };
    return routines.handle(request, url);
  });
  app = startStudentsApp(origin, fixture.endpoint);
  await expect.poll(async () => {
    if (app.processHandle.exitCode !== null) throw new Error(`El servidor de foco salió con código ${app.processHandle.exitCode}.`);
    try { return (await fetch(`${origin}/mi-rutina`)).status; } catch { return 0; }
  }, { timeout: 55_000 }).toBe(200);
});

test("Notificaciones hidrata la fecha calculada por el servidor y conserva el diseño", async ({ page, context }) => {
  await signIn(context, origin, routines.studentUser);
  const hydrationErrors: string[] = [];
  page.on("pageerror", error => hydrationErrors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error" && /hydrat|server rendered/i.test(message.text())) hydrationErrors.push(message.text());
  });
  await page.addInitScript(() => {
    Intl.DateTimeFormat = new Proxy(Intl.DateTimeFormat, {
      construct(target, args) {
        const formatter = Reflect.construct(target, args);
        if (args[0] !== "es-AR" || args[1]?.timeStyle !== "short") return formatter;
        return new Proxy(formatter, {
          get(instance, property) {
            if (property === "format") return () => "FORMATO_DISTINTO_DEL_CLIENTE";
            const value = Reflect.get(instance, property, instance);
            return typeof value === "function" ? value.bind(instance) : value;
          },
        });
      },
    });
  });
  await page.route("**/api/notifications/push", route => route.fulfill({ json: { registered: false } }));
  await page.route("**/api/notifications/inbox", route => route.fulfill({ json: { readAt: "2026-11-18T12:10:00Z" } }));
  await page.goto(`${origin}/notificaciones`);
  await expect(page.getByRole("heading", { name: "Notificaciones", exact: true })).toBeVisible();
  await expect(page.locator(".student-notifications")).toBeVisible();
  await page.getByRole("button", { name: "Marcar como leído" }).click();
  await expect(page.getByText("Leído", { exact: true })).toBeVisible();
  const expected = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" })
    .format(new Date("2026-11-18T12:00:00Z"));
  expect(await page.locator(".student-notifications time").textContent()).toBe(expected);
  expect(hydrationErrors).toEqual([]);
});

test.afterAll(async () => {
  try { await app?.close(); } finally { await fixture?.close(); }
});

test("cerrar el video conserva el foco de Tab entre Empuje y Tirón", async ({ page, context }, testInfo) => {
  await signIn(context, origin, routines.studentUser);
  await page.setViewportSize({ width: 390, height: 740 });
  await page.addInitScript(() => {
    const events: { event: string; active: string; tag: string; label: string; focused: boolean; time: number }[] = [];
    Object.assign(window, { cuevaFocusTrace: events });
    for (const name of ["focusin", "close"]) document.addEventListener(name, () => {
      events.push({ event: name, active: document.activeElement?.textContent?.trim().slice(0, 80) ?? "none",
        tag: document.activeElement?.tagName ?? "none", label: document.activeElement?.getAttribute("aria-label") ?? "",
        focused: document.hasFocus(), time: performance.now() });
    }, true);
  });
  await page.route("**/api/ejercicios/video?*", route => route.fulfill({ json: { kind: "storage", src: `${origin}/focus-video.webm` } }));
  await page.route("**/focus-video.webm", route => route.fulfill({ status: 204 }));
  await page.goto(`${origin}/mi-rutina`);
  const days = page.getByRole("group", { name: "Día de entrenamiento" });
  const push = days.getByRole("button", { name: "Empuje", exact: true });
  const pull = days.getByRole("button", { name: "Tirón", exact: true });
  try {
    for (let iteration = 0; iteration < 3; iteration++) {
      await push.click();
      const row = page.getByRole("button", { name: /Press militar/ });
      await row.focus();
      await row.press("Enter");
      await expect(page.getByRole("dialog").getByRole("button", { name: "Cerrar" })).toBeFocused();
      // Native close restores the trigger synchronously and queues its close
      // event. Move focus before that queued event to exercise the same race
      // without relying on the runner's speed or weakening the Tab assertion.
      const focus = await page.evaluate(() => {
        document.querySelector("dialog")!.close();
        const nativeRestore = document.activeElement?.textContent ?? "";
        const push = Array.from(document.querySelectorAll<HTMLButtonElement>(".my-routine button"))
          .find(button => button.textContent === "Empuje")!;
        push.focus();
        return { nativeRestore, requested: document.activeElement?.textContent };
      });
      expect(focus.nativeRestore).toMatch(/Press militar/);
      expect(focus.requested).toBe("Empuje");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page.keyboard.press("Tab");
      await expect(pull).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(pull).toHaveAttribute("aria-pressed", "true");
    }
  } finally {
    await attachFocusEvidence(page, testInfo);
  }
});
