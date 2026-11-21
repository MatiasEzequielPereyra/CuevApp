import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import pg from "pg";

const { API_URL, DB_URL, ANON_KEY, CUEVA_SERVICE_KEY } = process.env;
const origin = process.env.CUEVA_PRODUCT_ORIGIN ?? "http://127.0.0.1:3000";
for (const url of [API_URL, DB_URL, origin]) assert.equal(new URL(url).hostname, "127.0.0.1");
const service = createClient(API_URL, CUEVA_SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const db = new pg.Client({ connectionString: DB_URL });
const studentId = randomUUID(), exerciseId = randomUUID();
const exerciseName = `Sentadilla emoji ${randomUUID().slice(0,8)}`;
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
  return {id:user.id,email,cookies:[...cookies].map(([name,value]) => ({name,value,url:origin}))};
}
await db.connect();
let browser;
try {
  const admin = await account("admin"), learner = await account("alumno");
  await db.query("insert into public.cueva_students(id,first_name,last_name,email,joined_on) values($1,'Mention','Local',$2,current_date)", [studentId,learner.email]);
  await db.query("insert into public.cueva_student_invitations(student_id,email,user_id,state,lease,requested_by) values($1,$2,$3,'sent',$4,$5)", [studentId,learner.email,learner.id,randomUUID(),admin.id]);
  await db.query("insert into public.cueva_exercises(id,name,revision,active,updated_by) values($1,$2,1,true,$3)", [exerciseId,exerciseName,admin.id]);
  browser = await chromium.launch();
  const context = await browser.newContext();
  await context.addCookies(admin.cookies);
  const page = await context.newPage();
  await page.goto(`${origin}/rutinas?alumno=${studentId}`);
  const editor = page.getByRole("region", {name:"Editor de rutina"});
  await editor.getByRole("button", {name:"Texto libre"}).click();
  const adminTextarea = editor.getByRole("textbox", {name:"Rutina en texto libre"});
  await adminTextarea.fill(exerciseName);
  await expect(page.getByRole("listbox", {name:"Ejercicios sugeridos"})).toHaveCount(0);
  await adminTextarea.fill(`🙂 @${exerciseName}`);
  await expect(page.getByRole("option", {name:exerciseName})).toBeVisible();
  await page.getByRole("option", {name:exerciseName}).click();
  await expect(page.getByRole("listbox", { name: "Ejercicios sugeridos" })).toHaveCount(0);
  const highlightedMention = editor.locator(".routine-text-mention-highlight");
  await expect(highlightedMention).toHaveText(exerciseName);
  // Highlight styling must not change inline text metrics: the textarea owns the native caret.
  await expect(highlightedMention).toHaveCSS("font-weight", "400");
  await expect(highlightedMention).toHaveCSS("padding-left", "0px");
  await expect(highlightedMention).not.toHaveCSS("text-shadow", "none");
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
  // Copy/paste must carry the linked UUID with the visible text, not only the name.
  await adminTextarea.press("Control+C");
  await adminTextarea.press("End");
  await adminTextarea.press("Control+V");
  await expect(highlightedMention).toHaveCount(2);
  // Restore one occurrence so the remaining assertions use a single mention.
  await adminTextarea.fill(`🙂 @${exerciseName}`);
  await expect(page.getByRole("option", {name:exerciseName})).toBeVisible();
  await page.getByRole("option", {name:exerciseName}).click();
  await expect(highlightedMention).toHaveCount(1);
  // Use a real browser pointer click at the visible mention text. This exercises
  // the textarea's native caret placement and React click handler together.
  await adminTextarea.click({position:mentionClickPoint});
  const adminPreview = page.getByRole("dialog", {name:`Ejercicio: ${exerciseName}`});
  await expect(adminPreview).toBeVisible();
  await expect(page.getByRole("listbox", { name: "Ejercicios sugeridos" })).toHaveCount(0);
  await expect(adminPreview.getByRole("status")).toHaveText("Aún no se encuentra con video disponible");
  await adminPreview.getByRole("button", {name:"Cerrar"}).click();
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
  const mention = pupil.locator(".my-routine-mention");
  await expect(mention).toHaveText(exerciseName);
  await expect(pupil.locator(".my-routine-notes")).toContainText(`🙂 ${exerciseName}`);
  await expect(pupil.getByRole("heading", {name:"Ejercicios mencionados"})).toBeVisible();
  await expect(pupil.getByRole("group", {name:"Día de entrenamiento"})).toHaveCount(0);

  // A linked mention never opens a preview from proximity, hover or focus.
  const preview = pupil.getByRole("dialog", {name:`Ejercicio: ${exerciseName}`});
  await mention.hover();
  await expect(preview).toHaveCount(0);
  await mention.focus();
  await expect(preview).toHaveCount(0);
  await expect(pupil).toHaveURL(`${origin}/mi-rutina`);

  // A deliberate click opens the inline details; text-only mentions still
  // expose workout logging even when no video is available.
  await mention.click();
  await expect(preview.getByText(exerciseName, {exact:true})).toBeVisible();
  await expect(preview.getByRole("status")).toHaveText("Aún no se encuentra con video disponible");
  await expect(preview.getByRole("link")).toHaveCount(0);
  await preview.getByRole("button", {name:"Registrar peso"}).click();
  await preview.getByLabel("Peso utilizado (kg)").fill("37.5");
  await preview.getByRole("button", {name:"Guardar entrenamiento"}).click();
  await expect(preview.getByRole("status").filter({hasText:"Entrenamiento guardado."})).toBeVisible();
  await expect.poll(async () => (await db.query(
    "select count(*)::int as count from public.cueva_workout_entries where student_id=$1 and exercise_id=$2",
    [studentId,exerciseId]
  )).rows[0].count).toBe(1);
  await preview.getByRole("button", {name:"Guardar último peso"}).click();
  await expect.poll(async () => (await db.query(
    "select count(*)::int as count from public.cueva_workout_entries where student_id=$1 and exercise_id=$2",
    [studentId,exerciseId]
  )).rows[0].count).toBe(2);
  await preview.getByRole("button", {name:"Por series"}).click();
  const setRows = preview.locator(".student-workout-set");
  await setRows.nth(0).getByLabel("Repeticiones").fill("10");
  await setRows.nth(0).getByLabel("Peso (kg)").fill("40");
  await preview.getByRole("button", {name:"Agregar serie"}).click();
  await setRows.nth(1).getByLabel("Repeticiones").fill("8");
  await setRows.nth(1).getByLabel("Peso (kg)").fill("42.5");
  await preview.getByRole("button", {name:"Guardar entrenamiento"}).click();
  await expect(preview.getByRole("status").filter({hasText:"Entrenamiento guardado."})).toBeVisible();
  await expect.poll(async () => (await db.query(
    "select count(*)::int as count from public.cueva_workout_sets s join public.cueva_workout_entries e on e.id=s.entry_id where e.student_id=$1 and e.exercise_id=$2",
    [studentId,exerciseId]
  )).rows[0].count).toBe(2);
  await pupil.locator("h1").click();
  await expect(preview).toHaveCount(0);
  await expect(pupil).toHaveURL(`${origin}/mi-rutina`);

  // A linked exercise with a confirmed video opens the player from an explicit
  // action; closing it does not reopen a preview through restored focus/hover.
  await db.query("update public.cueva_exercises set video_url='https://www.youtube.com/watch?v=dQw4w9WgXcQ' where id=$1", [exerciseId]);
  await pupil.reload();
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
  await expect(pupil).toHaveURL(`${origin}/mi-rutina`);
  console.log("PASS: authenticated text mention preview, no-video state, inline video playback, keyboard dismissal and no navigation.");
} finally {
  await browser?.close();
  // Immutable synthetic publications are removed with this disposable stack.
  await db.end();
}
