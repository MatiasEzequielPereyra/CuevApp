// CUEVA-007: floating panels, per-exercise summaries, and compact editable history (current contract).
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import pg from "pg";
import { verifyLegacyExerciseContract } from "./exercise-legacy-contract.mjs";

const { API_URL, DB_URL, ANON_KEY, CUEVA_SERVICE_KEY } = process.env;
const origin = process.env.CUEVA_PRODUCT_ORIGIN ?? "http://127.0.0.1:3000";
for (const url of [API_URL, DB_URL, origin]) assert.equal(new URL(url).hostname, "127.0.0.1");
const service = createClient(API_URL, CUEVA_SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const db = new pg.Client({ connectionString: DB_URL });
const studentId = randomUUID(), exerciseId = randomUUID();
const exerciseName = `Sentadilla emoji ${randomUUID().slice(0,8)}`;
const secondExerciseId = randomUUID();
const secondExerciseName = `Press de hombros ${randomUUID().slice(0,8)}`;
const password = `CuevA-${randomUUID()}-9!`;
async function checked(operation) {
  const { data, error } = await operation;
  assert.ok(!error, `local operation failed: ${error?.code ?? error?.status ?? "unknown"}`);
  return data;
}
async function account(role) {
  const email = `mention-${randomUUID()}@example.test`;
  const { user } = await checked(service.auth.admin.createUser({ email, password, email_confirm: true }));
  await db.query("insert into public.cueva_profiles(user_id,role) values($1,$2)", [user.id, role]);
  await db.query("insert into cueva_private.access_state(user_id,ready,session_not_before) values($1,true,now()-interval '1 minute')", [user.id]);
  const cookies = new Map();
  const client = createServerClient(API_URL, ANON_KEY, { cookies: {
    getAll: () => [...cookies].map(([name,value]) => ({name,value})),
    setAll: items => { for (const {name,value} of items) cookies.set(name,value); },
  } });
  await checked(client.auth.signInWithPassword({email,password}));
  return {id:user.id,email,client,cookies:[...cookies].map(([name,value]) => ({name,value,url:origin}))};
}
await db.connect();
let browser;
try {
  const admin = await account("admin"), learner = await account("alumno");
  await verifyLegacyExerciseContract({ adminClient: admin.client, studentClient: learner.client,
    anonClient: createClient(API_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } }), origin });
  await db.query("insert into public.cueva_students(id,first_name,last_name,email,joined_on) values($1,'Mention','Local',$2,current_date)", [studentId,learner.email]);
  await db.query("insert into public.cueva_student_invitations(student_id,email,user_id,state,lease,requested_by) values($1,$2,$3,'sent',$4,$5)", [studentId,learner.email,learner.id,randomUUID(),admin.id]);
  await db.query("insert into public.cueva_exercises(id,name,revision,active,updated_by) values($1,$2,1,true,$3)", [exerciseId,exerciseName,admin.id]);
  await db.query("insert into public.cueva_exercises(id,name,revision,active,updated_by) values($1,$2,1,true,$3)", [secondExerciseId,secondExerciseName,admin.id]);
  browser = await chromium.launch();
  const context = await browser.newContext();
  await context.addCookies(admin.cookies);
  const page = await context.newPage();
  await page.goto(`${origin}/rutinas?alumno=${studentId}`);
  const editor = page.getByRole("region", {name:"Editor de rutina"});
  await editor.getByRole("button", {name:"Texto libre"}).click();
  const adminTextarea = editor.getByRole("textbox", {name:"Rutina en texto libre"});
  const inlineExerciseName = `${exerciseName} temporal 007`;
  const adminEditorBeforeSuggestions = await adminTextarea.boundingBox();
  await adminTextarea.fill(`@${inlineExerciseName}`);
  await expect(page.getByRole("listbox", {name:"Ejercicios sugeridos"})).toBeVisible();
  const suggestions = page.getByRole("listbox", {name:"Ejercicios sugeridos"});
  await expect(suggestions).toHaveCSS("opacity", "1");
  await expect(suggestions).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(suggestions).toHaveCSS("z-index", "2147483000");
  await expect(suggestions).toHaveCSS("position", "fixed");
  expect((await adminTextarea.boundingBox()).height).toBe(adminEditorBeforeSuggestions.height);
  await page.getByLabel("Registro").selectOption("time");
  await page.getByRole("button", {name: new RegExp(`Crear .* en Ejercicios`)}).click();
  await expect.poll(async () => (await db.query(
    "select tracking_mode from public.cueva_exercises where name=$1",
    [inlineExerciseName]
  )).rows[0]?.tracking_mode).toBe("time");
  await adminTextarea.fill("");
  await adminTextarea.fill(exerciseName);
  await expect(page.getByRole("listbox", {name:"Ejercicios sugeridos"})).toHaveCount(0);
  await adminTextarea.fill(`🙂 @${exerciseName}`);
  await expect(page.getByRole("listbox", {name:"Ejercicios sugeridos"}).getByRole("option", {name:exerciseName, exact:true})).toBeVisible();
  await page.getByRole("listbox", {name:"Ejercicios sugeridos"}).getByRole("option", {name:exerciseName, exact:true}).click();
  await expect(page.getByRole("listbox", { name: "Ejercicios sugeridos" })).toHaveCount(0);
  const highlightedMention = editor.locator(".routine-text-mention-highlight");
  await expect(highlightedMention).toHaveText(exerciseName);
  // Highlight styling must not change inline text metrics: the textarea owns the native caret.
  await expect(highlightedMention).toHaveCSS("font-weight", "400");
  await expect(highlightedMention).toHaveCSS("padding-left", "0px");
  const mentionBoxShadow = await highlightedMention.evaluate(element => getComputedStyle(element).boxShadow);
  assert.notEqual(mentionBoxShadow, "none", "linked mention must retain its visual highlight");
  await expect(highlightedMention).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  const mentionClickPoint = await adminTextarea.evaluate((element, name) => {
    const start = element.value.indexOf(name);
    const style = getComputedStyle(element);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    context.font = style.font;
    const before = context.measureText(element.value.slice(0, start)).width;
    const mention = context.measureText(name.slice(0, Math.floor(name.length / 2))).width;
    return {
      x: element.clientLeft + parseFloat(style.paddingLeft) + before + mention,
      y: element.clientTop + parseFloat(style.paddingTop) + parseFloat(style.lineHeight) / 2,
    };
  }, exerciseName);
  // Native drag selection must include the full text and linked mention.
  const drag = await adminTextarea.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    context.font = style.font;
    const width = context.measureText(element.value).width;
    return {
      start: { x: rect.left + element.clientLeft + parseFloat(style.paddingLeft) + 1, y: rect.top + element.clientTop + parseFloat(style.paddingTop) + parseFloat(style.lineHeight) / 2 },
      end: { x: rect.left + element.clientLeft + parseFloat(style.paddingLeft) + width - 1, y: rect.top + element.clientTop + parseFloat(style.paddingTop) + parseFloat(style.lineHeight) / 2 },
    };
  });
  await page.mouse.move(drag.start.x, drag.start.y);
  await page.mouse.down();
  await page.mouse.move(drag.end.x, drag.end.y, { steps: 8 });
  await page.mouse.up();
  assert.equal(await adminTextarea.evaluate(element => element.value.slice(element.selectionStart, element.selectionEnd)), `🙂 ${exerciseName}`);
  // Capture clipboard payload and whether the component suppresses native paste.
  await adminTextarea.evaluate(element => {
    const diagnostics = [];
    window.__routineClipboardDiagnostics = diagnostics;
    for (const type of ["copy", "paste"]) window.addEventListener(type, event => {
      const clipboard = event.clipboardData;
      const snapshot = { type, types: clipboard ? Array.from(clipboard.types) : [],
        plain: clipboard?.getData("text/plain") ?? "", html: clipboard?.getData("text/html") ?? "",
        custom: clipboard?.getData("application/x-cuevapp-routine-mentions") ?? "",
        selectionStart: element.selectionStart, selectionEnd: element.selectionEnd, value: element.value };
      queueMicrotask(() => diagnostics.push({ ...snapshot, defaultPrevented: event.defaultPrevented }));
    });
  });
  // Copy/paste must carry the linked UUID with the visible text, not only the name.
  await adminTextarea.press("Control+C");
  await adminTextarea.press("End");
  await adminTextarea.press("Control+V");
  await expect(highlightedMention).toHaveCount(2);
  // Multi-line arbitrary selections must preserve every linked exercise UUID on paste.
  await adminTextarea.fill("Inicio\n🙂 @");
  await adminTextarea.pressSequentially(exerciseName);
  await expect(page.getByRole("listbox", {name:"Ejercicios sugeridos"}).getByRole("option", {name:exerciseName, exact:true})).toBeVisible();
  await page.getByRole("listbox", {name:"Ejercicios sugeridos"}).getByRole("option", {name:exerciseName, exact:true}).click();
  await adminTextarea.press("End");
  await adminTextarea.press("Enter");
  await expect(page.getByRole("listbox", {name:"Ejercicios sugeridos"})).toHaveCount(0);
  await expect(adminTextarea).toHaveValue(`Inicio\n🙂 ${exerciseName}\n`);
  await adminTextarea.pressSequentially("Fin");
  await expect(highlightedMention).toHaveCount(1);
  await adminTextarea.press("Control+A");
  await adminTextarea.press("Control+C");
  await adminTextarea.press("End");
  await adminTextarea.press("Enter");
  await adminTextarea.press("Control+V");
  await expect(highlightedMention).toHaveCount(2);
  await expect(adminTextarea).toHaveValue(`Inicio\n🙂 ${exerciseName}\nFin\nInicio\n🙂 ${exerciseName}\nFin`);
  console.log("ROUTINE_CLIPBOARD_DIAGNOSTICS", JSON.stringify(await page.evaluate(() => window.__routineClipboardDiagnostics)));
  // Restore one occurrence so the remaining assertions use a single mention.
  await adminTextarea.fill(`🙂 @${exerciseName}`);
  await expect(page.getByRole("listbox", {name:"Ejercicios sugeridos"}).getByRole("option", {name:exerciseName, exact:true})).toBeVisible();
  await page.getByRole("listbox", {name:"Ejercicios sugeridos"}).getByRole("option", {name:exerciseName, exact:true}).click();
  await expect(highlightedMention).toHaveCount(1);
  const adminMentionHue = await highlightedMention.evaluate(element => getComputedStyle(element).getPropertyValue("--mention-hue").trim());
  // Use a real browser pointer click at the visible mention text. This exercises
  // the textarea's native caret placement and React click handler together.
  await adminTextarea.click({position:mentionClickPoint});
  const adminPreview = page.getByRole("dialog", {name:`Ejercicio: ${exerciseName}`});
  await expect(adminPreview).toHaveCount(0);
  await expect(page.getByRole("listbox", { name: "Ejercicios sugeridos" })).toHaveCount(0);
  await expect(editor.getByText("Borrador guardado", {exact:true})).toBeVisible();
  const {rows:[draft]} = await db.query("select revision,text_content,mentions from public.cueva_routine_text_drafts where kind='draft' and owner_id=$1", [studentId]);
  assert.equal(draft.text_content,`🙂 ${exerciseName}`);
  assert.deepEqual(draft.mentions,[{exercise_id:exerciseId,start:2,end:2+Array.from(exerciseName).length,text:exerciseName}]);
  await editor.getByRole("button", {name:"Publicar rutina"}).click();
  await expect(editor.getByText("Rutina publicada.", {exact:true})).toBeVisible();
  const pupilContext = await browser.newContext();
  await pupilContext.addCookies(learner.cookies);
  const pupil = await pupilContext.newPage();
  await pupil.goto(`${origin}/mi-rutina`);
  await expect(pupil.getByRole("heading", {name:"Ejercicios mencionados"})).toHaveCount(0);
  const mention = pupil.locator(".my-routine-mention");
  await expect(mention).toHaveText(exerciseName);
  await expect.poll(() => mention.evaluate(element => getComputedStyle(element).getPropertyValue("--mention-hue").trim())).toBe(adminMentionHue);
  await expect(pupil.locator(".my-routine-notes")).toContainText(`🙂 ${exerciseName}`);
  await expect(pupil.getByRole("group", {name:"Día de entrenamiento"})).toHaveCount(0);

  // A linked mention never opens a preview from proximity, hover or focus.
  const preview = pupil.getByRole("dialog", {name:`Ejercicio: ${exerciseName}`});
  const logger = pupil.locator(".student-workout-row .student-workout").first();
  const loggerPanel = pupil.locator(".student-workout-floating-panel");
  await mention.hover();
  await expect(preview).toHaveCount(0);
  await mention.focus();
  await expect(preview).toHaveCount(0);
  await expect(pupil).toHaveURL(`${origin}/mi-rutina`);

  // A deliberate click opens the inline details; text-only mentions still
  // expose workout logging even when no video is available.
  await mention.click();
  await expect(preview.getByText(exerciseName, {exact:true})).toBeVisible();
  await expect(preview).toHaveCSS("opacity", "1");
  await expect(preview).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(preview).toHaveCSS("z-index", "2147483000");
  await preview.hover(); // moving from the mention to the panel must not dismiss it.
  await expect(preview.getByRole("status")).toHaveText("Aún no se encuentra con video disponible");
  await expect(preview.getByRole("link")).toHaveCount(0);
  const rowBeforePanel = await logger.boundingBox();
  const loggerTrigger = logger.getByRole("button", {name:"Registrar peso"});
  const panelControlId = await loggerTrigger.getAttribute("aria-controls");
  await loggerTrigger.click();
  await expect(loggerPanel).toBeVisible();
  expect(await loggerPanel.getAttribute("id")).toBe(panelControlId);
  await expect(loggerPanel).toHaveCSS("position", "fixed");
  const panelBox = await loggerPanel.boundingBox();
  const viewport = pupil.viewportSize();
  expect(panelBox.x).toBeGreaterThanOrEqual(0);
  expect(panelBox.y).toBeGreaterThanOrEqual(0);
  expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(viewport.width);
  expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(viewport.height);
  const rowAfterPanel = await logger.boundingBox();
  expect(rowAfterPanel.height).toBe(rowBeforePanel.height);
  await loggerPanel.getByLabel("Peso utilizado (kg)").fill("37.5");
  await loggerPanel.getByRole("button", {name:"Guardar resultado"}).click();
  await expect(loggerPanel.getByRole("status").filter({hasText:"Resultado guardado."})).toBeVisible();
  await expect(logger.getByText("REALIZADO")).toBeVisible();
  await expect.poll(async () => (await db.query(
    "select count(*)::int as count from public.cueva_workout_entries where student_id=$1 and exercise_id=$2",
    [studentId,exerciseId]
  )).rows[0].count).toBe(1);
  await loggerPanel.getByRole("button", {name:"Guardar último peso"}).click();
  await expect.poll(async () => (await db.query(
    "select count(*)::int as count from public.cueva_workout_entries where student_id=$1 and exercise_id=$2",
    [studentId,exerciseId]
  )).rows[0].count).toBe(2);
  const rowHeightBeforeSets = (await logger.boundingBox()).height;
  await loggerPanel.getByRole("button", {name:"Por series"}).click();
  expect((await logger.boundingBox()).height).toBe(rowHeightBeforeSets);
  const setRows = loggerPanel.locator(".student-workout-set");
  await setRows.nth(0).getByLabel("Repeticiones").fill("10");
  await setRows.nth(0).getByLabel("Peso (kg)").fill("40");
  await loggerPanel.getByRole("button", {name:"Agregar serie"}).click();
  await setRows.nth(1).getByLabel("Repeticiones").fill("8");
  await setRows.nth(1).getByLabel("Peso (kg)").fill("42.5");
  await loggerPanel.getByRole("button", {name:"Guardar resultado"}).click();
  await expect(loggerPanel.getByRole("status").filter({hasText:"Resultado guardado."})).toBeVisible();
  await expect.poll(async () => (await db.query(
    "select count(*)::int as count from public.cueva_workout_sets s join public.cueva_workout_entries e on e.id=s.entry_id where e.student_id=$1 and e.exercise_id=$2",
    [studentId,exerciseId]
  )).rows[0].count).toBe(2);
  await expect(logger.getByText("REALIZADO")).toBeVisible();
  await loggerPanel.getByRole("button", {name:"Rápido"}).click();
  await loggerPanel.getByLabel("Peso utilizado (kg)").fill("47.5");
  await loggerPanel.getByRole("button", {name:"Guardar resultado"}).click();
  await expect(loggerPanel.getByRole("status").filter({hasText:"Resultado guardado."})).toBeVisible();
  await expect.poll(async () => (await db.query(
    "select count(*)::int as count from public.cueva_workout_entries where student_id=$1 and exercise_id=$2",
    [studentId,exerciseId]
  )).rows[0].count).toBe(4);
  await loggerPanel.getByRole("button", {name:"Ver historial"}).click();
  // Select the multi-set entry by its recorded reps, not by history position:
  // the two earlier quick entries are also editable and appear in the same list.
  const setsHistoryEntry = loggerPanel.locator(".student-workout-history > ol > li").filter({hasText:"8 rep."});
  await expect(setsHistoryEntry).toHaveCount(1);
  await setsHistoryEntry.getByRole("button", {name:"Editar"}).click();
  await expect(loggerPanel.locator(".student-workout-set")).toHaveCount(2);
  await loggerPanel.locator(".student-workout-set").nth(1).getByLabel("Peso (kg)").fill("45");
  await loggerPanel.getByRole("button", {name:"Guardar cambios"}).click();
  await expect(loggerPanel.getByRole("status").filter({hasText:"Cambios guardados."})).toBeVisible();
  await expect(logger.getByText("45 kg", { exact: true })).toBeVisible();
  const visibleHistoryRows = loggerPanel.locator(".student-workout-history > ol > li");
  await expect(visibleHistoryRows).toHaveCount(3);
  for (let index = 0; index < 3; index++) {
    await expect(visibleHistoryRows.nth(index)).toHaveCSS("white-space", "nowrap");
    expect((await visibleHistoryRows.nth(index).boundingBox()).height).toBeLessThanOrEqual(30);
  }
  const reusableEntry = loggerPanel.locator(".student-workout-history > ol > li").filter({hasText:"8 rep."});
  await reusableEntry.getByRole("button", {name:"Usar"}).click();
  await expect(loggerPanel.getByLabel("Peso utilizado (kg)")).toHaveValue("45");
  pupil.once("dialog", dialog => dialog.accept());
  await reusableEntry.getByRole("button", {name:"Eliminar"}).click();
  await expect.poll(async () => (await db.query(
    "select count(*)::int as count from public.cueva_workout_entries where student_id=$1 and exercise_id=$2",
    [studentId,exerciseId]
  )).rows[0].count).toBe(3);
  await expect(loggerPanel.locator(".student-workout-history > ol > li")).toHaveCount(3);
  await expect(loggerPanel.getByRole("status").filter({hasText:"Registro eliminado."})).toBeVisible();
  await pupil.locator("h1").click();
  await expect(preview).toHaveCount(0);
  await expect(logger.getByText("REALIZADO")).toBeVisible();
  await logger.getByRole("button", {name:"Cerrar registro de peso"}).click();
  await expect(loggerPanel).toHaveCount(0);
  await expect(pupil).toHaveURL(`${origin}/mi-rutina`);

  // A linked exercise with a confirmed video opens the player from an explicit
  // action; closing it does not reopen a preview through restored focus/hover.
  await db.query("update public.cueva_exercises set video_url='https://www.youtube.com/watch?v=dQw4w9WgXcQ' where id=$1", [exerciseId]);
  // Selecting a linked exercise asks for confirmation before opening its player;
  // the exercise autocomplete remains reserved for typing @.
  await adminTextarea.click({position:mentionClickPoint});
  await expect(adminPreview).toBeVisible();
  const adminPlayer = page.getByRole("dialog", {name:exerciseName});
  await expect(page.locator("dialog.my-routine-dialog").filter({has: page.getByRole("heading", {name: exerciseName, exact: true})})).toHaveCount(0);
  await adminPreview.getByRole("button", {name:"Ver video"}).click();
  await expect(adminPlayer).toBeVisible();
  await adminPlayer.getByRole("button", {name:"Cerrar"}).click();
  await expect(adminPlayer).toHaveCount(0);
  await pupil.reload();
  await expect(logger.getByText("REALIZADO")).toBeVisible();
  await mention.click();
  await expect(preview.getByRole("button", {name:"Ver video"})).toBeVisible();
  const videoApi = url => url.pathname === "/api/ejercicios/video" && url.searchParams.get("id") === exerciseId && url.searchParams.get("player") === "1";
  await pupil.route("**/api/ejercicios/video**", async route => {
    if (!videoApi(new URL(route.request().url()))) return route.continue();
    await route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({message:"Video temporalmente no disponible."})});
  });
  await preview.getByRole("button", {name:"Ver video"}).click();
  const player = pupil.getByRole("dialog", {name:exerciseName});
  await expect(player).toBeVisible();
  await expect(player.getByRole("alert")).toHaveText("Video temporalmente no disponible.");
  await expect(player.getByRole("button", {name:"Reintentar"})).toBeVisible();
  await pupil.unroute("**/api/ejercicios/video**");
  await player.getByRole("button", {name:"Reintentar"}).click();
  await expect(player.locator("iframe")).toHaveAttribute("src", /youtube-nocookie.com\/embed\/dQw4w9WgXcQ/);
  await expect(pupil).toHaveURL(`${origin}/mi-rutina`);
  await pupil.mouse.click(1, 1);
  await expect(player).toHaveCount(0);
  await expect(preview).toHaveCount(0);
  await mention.hover();
  await expect(preview).toHaveCount(0);

  // Escape closes the player too, without restoring a neighboring preview.
  await mention.click();
  await preview.getByRole("button", {name:"Ver video"}).click();
  await expect(player).toBeVisible();
  await pupil.keyboard.press("Escape");
  await expect(player).toHaveCount(0);
  await expect(preview).toHaveCount(0);
  await mention.hover();
  await expect(preview).toHaveCount(0);

  // Clicking the native dialog backdrop closes the player without restoring a preview.
  await mention.click();
  await preview.getByRole("button", {name:"Ver video"}).click();
  await expect(player).toBeVisible();
  await pupil.mouse.click(5, 5);
  await expect(player).toHaveCount(0);
  await expect(preview).toHaveCount(0);
  await mention.hover();
  await expect(preview).toHaveCount(0);
  await expect(pupil).toHaveURL(`${origin}/mi-rutina`);
  // Touch coverage for the published free-text mention: opening, interacting
  // inside the floating panel, and dismissing it with an outside tap.
  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await touchContext.addCookies(learner.cookies);
  const touchPage = await touchContext.newPage();
  await touchPage.goto(`${origin}/mi-rutina`);
  const touchMention = touchPage.locator(".my-routine-mention").filter({ hasText: exerciseName }).first();
  const touchPreview = touchPage.getByRole("dialog", { name: `Ejercicio: ${exerciseName}` });
  await touchMention.tap();
  await expect(touchPreview).toBeVisible();
  await expect(touchPreview.getByRole("button", { name: "Ver video" })).toBeVisible();
  // Tapping an action inside the panel must not be treated as an outside tap.
  await touchPreview.getByRole("button", { name: "Ver video" }).tap();
  const touchPlayer = touchPage.getByRole("dialog", { name: exerciseName });
  await expect(touchPlayer).toBeVisible();
  await touchPage.touchscreen.tap(5, 5);
  await expect(touchPlayer).toHaveCount(0);
  await expect(touchPreview).toHaveCount(0);
  // The mention remains usable after dismissal; a second outside tap closes preview.
  await touchMention.tap();
  await expect(touchPreview).toBeVisible();
  await touchPage.touchscreen.tap(5, 5);
  await expect(touchPreview).toHaveCount(0);
  await touchContext.close();

  // A single source line with two linked UUIDs exposes the exercise picker
  // inside the floating logger; changing to a time-based exercise must reset
  // the draft and switch the available input without closing or shifting rows.
  await adminTextarea.fill(`🙂 @${exerciseName}`);
  await expect(page.getByRole("listbox", {name:"Ejercicios sugeridos"}).getByRole("option", {name:exerciseName, exact:true})).toBeVisible();
  await page.getByRole("listbox", {name:"Ejercicios sugeridos"}).getByRole("option", {name:exerciseName, exact:true}).click();
  await adminTextarea.press("End");
  await adminTextarea.pressSequentially(" @");
  await adminTextarea.pressSequentially(inlineExerciseName);
  await expect(page.getByRole("listbox", {name:"Ejercicios sugeridos"}).getByRole("option", {name:inlineExerciseName, exact:true})).toBeVisible();
  await page.getByRole("listbox", {name:"Ejercicios sugeridos"}).getByRole("option", {name:inlineExerciseName, exact:true}).click();
  await adminTextarea.press("End");
  await adminTextarea.pressSequentially(" @");
  await adminTextarea.pressSequentially(secondExerciseName);
  await expect(page.getByRole("listbox", {name:"Ejercicios sugeridos"}).getByRole("option", {name:secondExerciseName, exact:true})).toBeVisible();
  await page.getByRole("listbox", {name:"Ejercicios sugeridos"}).getByRole("option", {name:secondExerciseName, exact:true}).click();
  await editor.getByRole("button", {name:"Publicar rutina"}).click();
  await expect(editor.getByText("Rutina publicada.", {exact:true})).toBeVisible();
  const {rows:[inlineExercise]} = await db.query("select id from public.cueva_exercises where name=$1", [inlineExerciseName]);
  assert.ok(inlineExercise?.id, "inline-created exercise must retain its catalog UUID");
  await pupil.reload();
  const rowLogger = pupil.locator(".student-workout-row .student-workout").first();
  const rowTrigger = rowLogger.getByRole("button", {name:"Registrar peso"});
  await rowTrigger.click();
  const selectionPanel = pupil.locator(".student-workout-floating-panel");
  await expect(selectionPanel.getByLabel("Ejercicio")).toHaveValue(exerciseId);
  await selectionPanel.getByLabel("Ejercicio").selectOption(inlineExercise.id);
  await expect(selectionPanel.getByLabel("Ejercicio")).toHaveValue(inlineExercise.id);
  await expect(selectionPanel.getByLabel("Duración (segundos)")).toBeVisible();
  await expect(selectionPanel.getByLabel("Peso utilizado (kg)")).toHaveCount(0);
  await selectionPanel.getByLabel("Ejercicio").selectOption(secondExerciseId);
  await expect(selectionPanel.getByLabel("Peso utilizado (kg)")).toBeVisible();
  await selectionPanel.getByLabel("Peso utilizado (kg)").fill("22.5");
  await selectionPanel.getByRole("button", {name:"Guardar resultado"}).click();
  await expect(selectionPanel.getByRole("status").filter({hasText:"Resultado guardado."})).toBeVisible();
  const firstExerciseSummary = pupil.locator(".my-routine-exercise-with-summary").filter({hasText:exerciseName}).locator(".student-workout-exercise-summary").first();
  const secondExerciseSummary = pupil.locator(".my-routine-exercise-with-summary").filter({hasText:secondExerciseName}).locator(".student-workout-exercise-summary").first();
  await expect(firstExerciseSummary).toContainText("47,5 kg");
  await expect(secondExerciseSummary).toContainText("22,5 kg");
  await selectionPanel.getByRole("button", {name:"Cerrar registro"}).click();
  await expect(selectionPanel).toHaveCount(0);

  console.log("PASS: authenticated text mention preview, per-exercise workout summaries, floating logger layout, history reuse/deletion and three-entry limit, UUID exercise selection, time tracking, inline video playback, keyboard dismissal and no navigation.");
} finally {
  await browser?.close();
  // Immutable synthetic publications are removed with this disposable stack.
  await db.end();
}
