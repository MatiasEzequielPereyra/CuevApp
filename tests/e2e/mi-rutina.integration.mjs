import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { chromium, expect, webkit } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const { API_URL, ANON_KEY, CUEVA_SERVICE_KEY, DB_URL, MIGRATION_EVIDENCE, CUEVA_TEST_VIDEO } = process.env;
const origin = process.env.CUEVA_PRODUCT_ORIGIN ?? "http://127.0.0.1:3000";
assert.ok(API_URL && ANON_KEY && CUEVA_SERVICE_KEY && DB_URL && MIGRATION_EVIDENCE && CUEVA_TEST_VIDEO);
assert.equal(new URL(API_URL).hostname, "127.0.0.1");
assert.equal(new URL(DB_URL).hostname, "127.0.0.1");
assert.equal(new URL(origin).hostname, "127.0.0.1");
const service = createClient(API_URL, CUEVA_SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const db = new pg.Client({ connectionString: DB_URL });
const students = [randomUUID(), randomUUID()];
const suffix = randomUUID();
const exercises = ["Sentadilla", "Press militar", "Plancha", "Remo", "Peso muerto", "Flexiones", "Video de otra ficha", "Video anterior"]
  .map(name => ({ id: randomUUID(), name }));
const press = exercises[1];
const other = exercises[6];
const old = exercises[7];
const youtube = "https://youtu.be/ABCDEFGHIJK";
const path = `${press.id}/${randomUUID()}.webm`;
const bucket = service.storage.from("cueva-exercise-videos");
const password = `CuevA-${suffix}-9!`;
const startNote = "Descansá entre bloques.\nTomá agua.";

async function checked(operation) {
  const { data, error } = await operation;
  if (error) throw error;
  return data;
}

async function createAccount(role) {
  const email = `rutina-${randomUUID()}@example.test`;
  const { user } = await checked(service.auth.admin.createUser({ email, password, email_confirm: true }));
  await db.query("insert into public.cueva_profiles(user_id,role) values($1,$2)", [user.id, role]);
  await db.query("insert into cueva_private.access_state(user_id,ready,session_not_before) values($1,true,now()-interval '1 minute')", [user.id]);
  const cookies = new Map();
  const client = createServerClient(API_URL, ANON_KEY, {
    cookies: {
      getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      setAll: items => { for (const { name, value } of items) cookies.set(name, value); },
    },
  });
  await checked(client.auth.signInWithPassword({ email, password }));
  assert.ok(cookies.size);
  return { id: user.id, email, client, cookies: [...cookies].map(([name, value]) => ({ name, value, url: origin })) };
}

function trackingMode(index) {
  return index === 2 ? "time" : "weight";
}

function target(index) {
  const { id, name } = exercises[index];
  return { id: randomUUID(), exercise_id: id, name, note: index === 1 ? "Controlá el movimiento." : "",
    ...(trackingMode(index) === "time" ? { mode: "time", duration: 45, unit: "seconds" } : { mode: "weight", reps: "8-12", weight_kg: 25 }) };
}

const emBlocks = [[0, 2], [3, 4, 5], [2, 5], [1, 0, 3]];
const block = (indices, number, rounds) => ({
  id: randomUUID(), name: `Bloque ${number}`, rounds, exercises: indices.map(target),
});
const plan = { version: 2, days: [
  { id: randomUUID(), name: "Empuje", blocks: emBlocks.map((indices, index) => block(indices, index + 1, index + 2)) },
  { id: randomUUID(), name: "Tirón", blocks: [block([3, 2], 1, 1)] },
] };
const legacy = { version: 1, blocks: [{ id: randomUUID(), name: "Bloque anterior", exercises: [
  { id: randomUUID(), exercise_id: other.id, name: other.name, sets: 5, reps: "6", weight_kg: 12, note: "" },
  { id: randomUUID(), exercise_id: exercises[3].id, name: "Remo", sets: 3, reps: "8", weight_kg: null, note: "Nota anterior" },
] }] };

async function publish(client, id, revision, content, workout) {
  const common = { p_id: id, p_content: content, p_title: null, p_plan: workout };
  const draft = await checked(client.rpc("cueva_routine_write", { ...common, p_kind: "draft", p_revision: revision, p_operation: randomUUID() }));
  return checked(client.rpc("cueva_routine_write", { ...common, p_kind: "publish", p_revision: draft.revision, p_operation: randomUUID() }));
}

async function studentContext(browser, account, options) {
  const context = await browser.newContext(options);
  await context.addCookies(account.cookies);
  return context;
}

async function layoutAndPlayback(browserType, learner) {
  const browser = await browserType.launch();
  try {
    for (const width of [320, 360, 390, 1440]) {
      for (const theme of ["light", "dark"]) {
        const context = await studentContext(browser, learner, { viewport: { width, height: 740 }, hasTouch: width === 360, colorScheme: theme });
        try {
          const page = await context.newPage();
          await page.goto(`${origin}/mi-rutina`);
          await expect(page.getByRole("heading", { name: "Mi rutina", exact: true })).toBeVisible();
          await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
          const routine = page.locator(".my-routine");
          const day = routine.getByRole("group", { name: "Día de entrenamiento" });
          await expect(day.getByRole("button")).toHaveText(["Empuje", "Tirón"]);
          await expect(day.getByRole("button", { name: "Empuje" })).toHaveAttribute("aria-pressed", "true");
          await expect(routine.getByRole("heading", { level: 3 })).toHaveText(emBlocks.map((_, index) => `Bloque ${index + 1}`));
          const blocks = routine.locator(".my-routine-block");
          for (const [index, entries] of emBlocks.entries()) {
            const rows = blocks.nth(index).getByRole("listitem");
            await expect(rows.locator(".my-routine-mention")).toHaveText(entries.map(exercise => exercises[exercise].name));
            await expect(blocks.nth(index).getByText(`${index + 2} vueltas`, { exact: true })).toHaveCount(1);
          }
          if (width < 600) {
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true,
              `La vista mobile no debe generar scroll horizontal en ${width}px.`);
            await expect(blocks).toHaveCount(emBlocks.length);
            for (const [blockIndex, entries] of emBlocks.entries()) {
              const currentBlock = blocks.nth(blockIndex);
              await expect(currentBlock.getByRole("listitem")).toHaveCount(entries.length);
              for (const row of await currentBlock.locator(".my-routine-exercise").all()) {
                const geometry = await row.evaluate(node => {
                  const rect = node.getBoundingClientRect();
                  const detail = node.querySelector(".my-routine-exercise-detail");
                  return {
                    left: rect.left, right: rect.right,
                    detailClientWidth: detail?.clientWidth ?? 0,
                    detailScrollWidth: detail?.scrollWidth ?? 0,
                    name: node.querySelector(".my-routine-mention")?.textContent?.trim() ?? "",
                    nameOverflow: getComputedStyle(node.querySelector(".my-routine-mention")).textOverflow,
                  };
                });
                assert.ok(geometry.left >= 0 && geometry.right <= innerWidth + 1,
                  `La fila de ejercicio debe permanecer dentro del viewport de ${width}px: ${JSON.stringify(geometry)}`);
                assert.ok(geometry.detailClientWidth > 0 && geometry.detailScrollWidth <= geometry.detailClientWidth + 1,
                  `El detalle del ejercicio no debe desbordarse horizontalmente: ${JSON.stringify(geometry)}`);
                assert.notEqual(geometry.nameOverflow, "ellipsis", "El nombre del ejercicio no debe truncarse.");
                assert.ok(geometry.name.length > 0, "Cada ejercicio debe conservar su nombre visible.");
              }
            }
          }
          await expect(routine.getByText("45 segundos", { exact: true }).first()).toBeVisible();
          await expect(routine.getByText("25 kg", { exact: true }).first()).toBeVisible();
          await expect(routine.getByText("8-12 repeticiones", { exact: true }).first()).toBeVisible();
          const noVideoExercise = routine.getByRole("button", { name: /Sentadilla/ });
          await expect(noVideoExercise).toHaveCount(2);
          await noVideoExercise.first().click();
          const noVideoPreview = page.getByRole("dialog", { name: "Ejercicio: Sentadilla" });
          await expect(noVideoPreview.getByRole("status")).toHaveText("Aún no se encuentra con video disponible");
          await page.mouse.click(5, 5);
          await expect(noVideoPreview).toHaveCount(0);
          await expect(routine.getByText("Descansá entre bloques.", { exact: false })).toBeVisible();
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
          await expect(page).toHaveTitle(/CUEVA/);
          assert.deepEqual((await new AxeBuilder({ page }).include(".my-routine").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations, []);
          const evidence = name => join(MIGRATION_EVIDENCE, `mi-rutina-${browserType.name()}-${width}-${theme}-${name}.png`);
          await page.screenshot({ path: evidence("empuje") });

          const row = routine.getByRole("button", { name: /Press militar/ });
          await row.evaluate(node => node.scrollIntoView({ block: "center" }));
          const y = await page.evaluate(() => scrollY);
          if (width === 390) {
            await row.evaluate(node => {
              const selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
              const focusable = [...document.querySelectorAll(selector)].filter(element =>
                element.getClientRects().length && getComputedStyle(element).visibility !== "hidden"
              );
              const index = focusable.indexOf(node);
              const previous = focusable[index - 1];
              if (!previous) throw new Error("No se encontró el control anterior para probar la navegación por teclado");
              previous.focus();
            });
            await page.keyboard.press("Tab");
            await expect(row).toBeFocused();
            await expect(row).toHaveCSS("outline-style", "solid");
            await page.keyboard.press("Enter");
          } else if (width === 360) {
            await row.tap({ position: { x: 6, y: 7 } });
          } else {
            await row.click();
          }
          const exercisePreview = page.getByRole("dialog", { name: "Ejercicio: Press militar" });
          await expect(exercisePreview).toBeVisible();
          const playVideo = exercisePreview.getByRole("button", { name: "Ver video" });
          if (width === 390) {
            await playVideo.focus();
            await page.keyboard.press("Enter");
          } else if (width === 360) {
            await playVideo.tap();
          } else {
            await playVideo.click();
          }
          const dialog = page.getByRole("dialog", { name: "Press militar" });
          await expect(dialog.getByRole("button", { name: "Cerrar" })).toBeFocused();
          const player = dialog.locator("video");
          await expect(player).toHaveAttribute("src", /\/storage\/v1\/object\/sign\/cueva-exercise-videos\//);
          await expect.poll(() => player.evaluate(video => video.readyState)).toBeGreaterThanOrEqual(2);
          await player.evaluate(video => video.play());
          await expect.poll(() => player.evaluate(video => video.currentTime)).toBeGreaterThan(0);
          await page.screenshot({ path: evidence("video") });
          if (width === 390) await page.keyboard.press("Escape"); else await dialog.getByRole("button", { name: "Cerrar" }).click();
          await expect(dialog).toHaveCount(0);
          await expect(exercisePreview).toHaveCount(0);
          await expect(row).toBeFocused();
          await row.hover();
          await expect(page.getByRole("dialog", { name: "Ejercicio: Press militar" })).toHaveCount(0);
          await expect.poll(() => page.evaluate(() => scrollY)).toBe(y);
          await expect(day.getByRole("button", { name: "Empuje" })).toHaveAttribute("aria-pressed", "true");
          if (width === 390 && browserType.name() === "chromium") {
            await day.getByRole("button", { name: "Empuje" }).focus();
            await page.keyboard.press("Tab");
            await expect(day.getByRole("button", { name: "Tirón" })).toBeFocused();
            await page.keyboard.press("Enter");
          } else {
            // Keep keyboard traversal in a non-touch context (390px); the 360px
            // viewport above independently covers touch interaction.
            await day.getByRole("button", { name: "Tirón" }).click();
          }
          await expect(day.getByRole("button", { name: "Tirón" })).toHaveAttribute("aria-pressed", "true");
          await expect(blocks).toHaveCount(1);
          await expect(blocks.getByText("1 vuelta", { exact: true })).toBeVisible();
          await expect(row).toHaveCount(0);
        } finally {
          await context.close();
        }
      }
    }
    console.log(`PASS ${browserType.name()}: 6 combinaciones, cuatro bloques, video privado reproducido y posición/foco restaurados.`);
  } finally {
    await browser.close();
  }
}

await db.connect();
try {
  await mkdir(MIGRATION_EVIDENCE, { recursive: true });
  const admin = await createAccount("admin");
  const learner = await createAccount("alumno");
  const second = await createAccount("alumno");
  for (const [index, account] of [learner, second].entries()) {
    await db.query("insert into public.cueva_students(id,first_name,last_name,email,joined_on) values($1,'Prueba','Rutina',$2,'2026-01-12')",
      [students[index], account.email]);
    await db.query("insert into public.cueva_student_invitations(student_id,email,user_id,state,lease,requested_by) values($1,$2,$3,'sent',$4,$5)",
      [students[index], account.email, account.id, randomUUID(), admin.id]);
  }

  await checked(bucket.upload(path, await readFile(CUEVA_TEST_VIDEO), { contentType: "video/webm" }));
  for (const [index, exercise] of exercises.entries()) {
    await checked(admin.client.rpc("cueva_exercise_write", {
      p_id: exercise.id, p_name: `${exercise.name} ${suffix}`, p_active: true, p_revision: 0, p_description: "",
      p_video_path: exercise === press ? path : null, p_video_url: [other, old].includes(exercise) ? youtube : null,
      p_tracking_mode: trackingMode(index),
    }));
  }
  const previous = await publish(admin.client, students[0], 0, "Publicación histórica",
    { version: 2, days: [{ id: randomUUID(), name: "Anterior", blocks: [block([7], 1, 2)] }] });
  await publish(admin.client, students[0], previous.draft_revision, startNote, plan);
  assert.deepEqual(await checked(second.client.rpc("cueva_my_routine_video_ids")), []);
  const emptyBrowser = await chromium.launch();
  try {
    const context = await studentContext(emptyBrowser, second);
    const page = await context.newPage();
    await page.goto(`${origin}/mi-rutina`);
    await expect(page.getByRole("heading", { name: "Tu rutina está en preparación" })).toBeVisible();
  } finally {
    await emptyBrowser.close();
  }
  await publish(admin.client, students[1], 0, "Observación anterior", legacy);

  assert.deepEqual(await checked(learner.client.rpc("cueva_my_routine_video_ids")), [press.id]);
  assert.deepEqual(await checked(second.client.rpc("cueva_my_routine_video_ids")), [other.id]);
  assert.deepEqual(await checked(admin.client.rpc("cueva_my_routine_video_ids")), []);
  const observer = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });
  assert.ok((await observer.rpc("cueva_my_routine_video_ids")).error);
  assert.ok((await second.client.storage.from("cueva-exercise-videos").createSignedUrl(path, 60)).error);
  assert.equal((await fetch(`${API_URL}/storage/v1/object/public/cueva-exercise-videos/${path}`)).ok, false);
  console.log("PASS SQL/Storage: última publicación propia, identificadores mínimos, firma cruzada y descarga pública denegadas.");

  for (const browserType of [chromium, webkit]) await layoutAndPlayback(browserType, learner);

  const browser = await chromium.launch();
  try {
    const adminContext = await studentContext(browser, admin);
    const learnerContext = await studentContext(browser, learner);
    const otherContext = await studentContext(browser, second);
    const videoUrl = exercise => `${origin}/api/ejercicios/video?id=${exercise.id}&player=1`;
    for (const [context, exercise] of [[learnerContext, other], [learnerContext, old], [otherContext, press]]) {
      assert.equal((await context.request.get(videoUrl(exercise))).status(), 403);
    }
    const guest = await browser.newContext();
    assert.equal((await guest.request.get(videoUrl(press))).status(), 403);
    await guest.close();

    // Block the PWA service worker and keep the fetch-level 503 active until
    // the user explicitly retries. This also covers React Strict Mode effect remounts.
    const videoContext = await studentContext(browser, learner, { serviceWorkers: "block" });
    const pupil = await videoContext.newPage();
    await pupil.addInitScript(({ exerciseId }) => {
      const originalFetch = window.fetch.bind(window);
      Object.defineProperties(window, {
        __cuevaVideoFailureIntercepts: { value: 0, writable: true },
        __cuevaVideoRetryEnabled: { value: false, writable: true },
      });
      document.addEventListener("click", event => {
        const target = event.target;
        const button = target instanceof Element ? target.closest("button") : null;
        if (button?.textContent?.trim() === "Reintentar") {
          window.__cuevaVideoRetryEnabled = true;
        }
      }, true);
      window.fetch = async (input, init) => {
        const requestUrl = typeof input === "string" || input instanceof URL ? input.toString() : input.url;
        const url = new URL(requestUrl, window.location.href);
        if (url.pathname === "/api/ejercicios/video" &&
            url.searchParams.get("id") === exerciseId &&
            !window.__cuevaVideoRetryEnabled) {
          window.__cuevaVideoFailureIntercepts += 1;
          return new Response(JSON.stringify({ message: "Video temporalmente no disponible." }), {
            status: 503,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          });
        }
        return originalFetch(input, init);
      };
    }, { exerciseId: press.id });
    const summaryBatchRequests = [];
    await pupil.route("**/api/entrenamientos*", async route => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("summary") === "1") {
        summaryBatchRequests.push(url.searchParams.getAll("exercise_id"));
      }
      await route.continue();
    });
    await pupil.goto(`${origin}/mi-rutina`);
    await expect.poll(() => summaryBatchRequests.length).toBe(1);
    assert.deepEqual(
      [...new Set(summaryBatchRequests[0])].sort(),
      exercises.slice(0, 6).map(exercise => exercise.id).sort(),
      "La rutina extensa debe agrupar en una sola solicitud HTTP los seis UUID únicos, sin duplicar ejercicios repetidos."
    );
    await expect(pupil.getByRole("heading", {name:"Descripciones de ejercicios"})).toHaveCount(0);
    const weightedRow = pupil.locator(".my-routine-exercise-item").filter({ hasText: "Press militar" });
    const timedRow = pupil.locator(".my-routine-exercise-item").filter({ hasText: "Plancha" });
    await expect(weightedRow.getByRole("button", { name: "Registrar peso" })).toHaveCount(1);
    const timedLogger = timedRow.first();
    await expect(timedLogger.getByRole("button", { name: "Registrar duración" })).toBeVisible();
    await timedLogger.getByRole("button", { name: "Registrar duración" }).click();
    const timedPanel = pupil.getByRole("dialog", { name: "Registro de Plancha" });
    await expect(timedPanel.getByLabel("Peso utilizado (kg)")).toHaveCount(0);
    await timedPanel.getByLabel("Duración (segundos)").fill("75");
    await timedPanel.getByRole("button", { name: "Guardar resultado" }).click();
    await expect(timedPanel.getByRole("status").filter({ hasText: "Resultado guardado." })).toBeVisible();
    await timedPanel.getByRole("button", { name: "Cerrar registro" }).click();
    await expect(timedPanel).toHaveCount(0);
    await expect(timedRow.locator(".student-workout-exercise-summary-value")).toHaveText(["75 seg", "75 seg"]);
    await weightedRow.getByRole("button", { name: "Registrar peso" }).click();
    const weightedPanel = pupil.getByRole("dialog", { name: "Registro de Press militar" });
    await weightedPanel.getByLabel("Peso utilizado (kg)").fill("32.5");
    await weightedPanel.getByRole("button", { name: "Guardar resultado" }).click();
    await expect(weightedPanel.getByRole("status").filter({ hasText: "Resultado guardado." })).toBeVisible();

    // Exercise the complete series -> history -> edit flow through the authenticated UI.
    await weightedPanel.getByRole("button", { name: "Por series", exact: true }).click();
    await weightedPanel.getByLabel("Repeticiones").fill("10");
    await weightedPanel.getByLabel("Peso (kg)").fill("30");
    await weightedPanel.getByRole("button", { name: "Agregar serie", exact: true }).click();
    await expect(weightedPanel.getByText("Serie 2", { exact: true })).toBeVisible();
    await weightedPanel.getByLabel("Repeticiones").nth(1).fill("8");
    await weightedPanel.getByLabel("Peso (kg)").nth(1).fill("32");
    await weightedPanel.getByRole("button", { name: "Guardar resultado", exact: true }).click();
    await expect(weightedPanel.getByRole("status").filter({ hasText: "Resultado guardado." })).toBeVisible();
    await weightedPanel.getByRole("button", { name: "Ver historial", exact: true }).click();
    const workoutHistory = weightedPanel.locator(".student-workout-history");
    await expect(workoutHistory.getByRole("heading", { name: "Historial de este ejercicio" })).toBeVisible();
    await expect(workoutHistory.locator("ol > li").first()).toContainText("10 rep.");
    await expect(workoutHistory.locator("ol > li").first()).toContainText("32 kg");
    await workoutHistory.getByRole("button", { name: "Editar", exact: true }).first().click();
    await expect(weightedPanel.getByText("Editando un registro anterior")).toBeVisible();
    await weightedPanel.getByLabel("Peso (kg)").nth(0).fill("33");
    await weightedPanel.getByRole("button", { name: "Guardar cambios", exact: true }).click();
    await expect(weightedPanel.getByRole("status").filter({ hasText: "Cambios guardados." })).toBeVisible();
    await expect(workoutHistory.locator("ol > li").first()).toContainText("33 kg");

    // A valid foreign exercise UUID may return HTTP 200, but its history must remain empty.
    // First prove the owner has records for this UUID, then verify another student sees none.
    const ownerWorkoutResponse = await learnerContext.request.get(`${origin}/api/entrenamientos?exercise_id=${press.id}`);
    assert.equal(ownerWorkoutResponse.status(), 200, "El alumno propietario debe poder consultar su historial.");
    const ownerWorkoutPayload = await ownerWorkoutResponse.json();
    assert.ok(ownerWorkoutPayload.history?.entries?.length > 0,
      "La prueba debe partir de registros reales del alumno propietario.");
    const foreignWorkoutResponse = await otherContext.request.get(`${origin}/api/entrenamientos?exercise_id=${press.id}`);
    assert.equal(foreignWorkoutResponse.status(), 200,
      "Una consulta válida por UUID puede responder correctamente sin revelar registros ajenos.");
    const foreignWorkoutPayload = await foreignWorkoutResponse.json();
    assert.deepEqual(foreignWorkoutPayload.history?.entries ?? [], [],
      "El historial de otro alumno no debe exponer ninguna entrada del propietario.");

    await weightedRow.locator(".my-routine-mention").click();
    const exercisePreview = pupil.getByRole("dialog", { name: "Ejercicio: Press militar" });
    await exercisePreview.getByRole("button", { name: "Ver video" }).click();
    const dialog = pupil.getByRole("dialog", { name: "Press militar" });
    await expect(dialog.getByRole("alert")).toHaveText("Video temporalmente no disponible.");
    assert.ok(await pupil.evaluate(() => window.__cuevaVideoFailureIntercepts) >= 1,
      "El fetch del video debe recibir un 503 simulado hasta el reintento explícito.");
    const retryVideoResponse = pupil.waitForResponse(response => {
      const url = new URL(response.url());
      return url.pathname === "/api/ejercicios/video" &&
        url.searchParams.get("id") === press.id &&
        response.status() === 200;
    });
    await dialog.getByRole("button", { name: "Reintentar" }).click();
    const successfulRetry = await retryVideoResponse;
    assert.equal(successfulRetry.status(), 200, "El reintento debe recuperar el video.");
    await expect(dialog.locator("video")).toBeVisible();
    await pupil.keyboard.press("Escape");

    const legacyPage = await otherContext.newPage();
    await legacyPage.route("https://www.youtube-nocookie.com/**", route => route.fulfill({ contentType: "text/html", body: "<title>Player fixture</title>" }));
    await legacyPage.goto(`${origin}/mi-rutina`);
    await expect(legacyPage.getByRole("group", { name: "Día de entrenamiento" })).toHaveCount(0);
    await expect(legacyPage.getByText("5 series", { exact: true })).toBeVisible();
    await expect(legacyPage.getByText("3 series", { exact: true })).toBeVisible();
    await expect(legacyPage.getByText("Nota anterior", { exact: true })).toBeVisible();
    await legacyPage.getByRole("button", { name: /Video de otra ficha/ }).click();
    const legacyPreview = legacyPage.getByRole("dialog", { name: "Ejercicio: Video de otra ficha" });
    await legacyPreview.getByRole("button", { name: "Ver video" }).click();
    await expect(legacyPage.getByRole("dialog").locator("iframe")).toHaveAttribute("src", /youtube-nocookie\.com\/embed\/ABCDEFGHIJK/);
    await expect(legacyPage.getByRole("link", { name: "Abrir en YouTube" })).toHaveAttribute("href", youtube);

    const editor = await adminContext.newPage();
    await editor.goto(`${origin}/rutinas?alumno=${students[0]}`);
    const previewToggle = editor.getByText("Vista previa del borrador", { exact: true });
    await previewToggle.click();
    const preview = editor.locator("details[open]").filter({ has: previewToggle });
    await expect(preview.getByRole("combobox", { name: "Día de entrenamiento" })).toBeVisible();
    await expect(preview.getByText("Press militar", { exact: true })).toBeVisible();
    await previewToggle.click();
    await editor.getByText("Observaciones de la rutina", { exact: true }).click();
    const observations = editor.getByRole("textbox", { name: "Observaciones de la rutina" });
    await observations.fill("Texto nuevo después de publicar");
    await expect(editor.getByText("Borrador guardado", { exact: true })).toBeVisible();
    await pupil.reload();
    await expect(pupil.getByText("Texto nuevo después de publicar")).toHaveCount(0);
    await expect(pupil.getByText("Descansá entre bloques.", { exact: false })).toBeVisible();
    await editor.getByRole("button", { name: "Publicar rutina" }).click();
    await expect(editor.getByText("Rutina publicada.", { exact: true })).toBeVisible();
    await pupil.reload();
    await expect(pupil.getByText("Texto nuevo después de publicar")).toBeVisible();
    console.log("PASS HTTP/UI: acceso cruzado y anónimo denegados, reintento, YouTube, series V1, vista previa admin y publicación explícita.");
  } finally {
    await browser.close();
  }
} finally {
  // This workflow owns a disposable Supabase stack. Leave its immutable
  // publications intact until the runner removes the stack.
  await db.end();
}
