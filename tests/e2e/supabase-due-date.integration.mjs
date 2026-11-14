import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
import pg from "pg";

const apiUrl = process.env.API_URL;
const anonKey = process.env.ANON_KEY;
const serviceKey = process.env.CUEVA_SERVICE_KEY;
const databaseUrl = process.env.DB_URL;
const origin = "http://127.0.0.1:3000";
for (const [name, value] of Object.entries({ API_URL: apiUrl, ANON_KEY: anonKey, SERVICE_ROLE_KEY: serviceKey, DB_URL: databaseUrl })) {
  if (!value) throw new Error(`Missing ${name} from Supabase local environment`);
}

const admin = createClient(apiUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const anonymous = createClient(apiUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const database = new pg.Client({ connectionString: databaseUrl });
let userId;
const studentId = randomUUID();
const priceId = randomUUID();
const email = `due-date-e2e-${randomUUID()}@example.test`;
const password = `CuevA-${randomUUID()}-9!`;
let browser;
let userCreated = false;
let databaseConnected = false;

try {
  await database.connect();
  databaseConnected = true;

  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw created.error ?? new Error("Supabase did not create the test user");
  userId = created.data.user.id;
  userCreated = true;

  const signedIn = await anonymous.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error("Supabase did not issue an authenticated session");
  const session = signedIn.data.session;
  const claims = JSON.parse(Buffer.from(session.access_token.split(".")[1], "base64url").toString("utf8"));
  assert.equal(claims.sub, userId);
  assert.ok(claims.session_id, "authenticated JWT must contain the Supabase session id");

  await database.query(
    "insert into public.cueva_profiles(user_id,role) values($1,'admin')",
    [userId],
  );
  await database.query(
    "insert into cueva_private.access_state(user_id,ready,session_not_before) values($1,true,now()-interval '1 minute')",
    [userId],
  );
  await database.query(
    "insert into public.cueva_students(id,first_name,last_name,email,joined_on) values($1,'Integration','Student',$2,date '2026-01-12')",
    [studentId, `student-${studentId}@example.test`],
  );
  await database.query(
    "insert into public.cueva_prices(id,effective_month,cents,actor,recorded_at) values($1,date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')::date,10000,$2,now())",
    [priceId, userId],
  );

  const cookieJar = new Map();
  const ssrClient = createServerClient(apiUrl, anonKey, {
    cookies: {
      getAll: () => Array.from(cookieJar, ([name, value]) => ({ name, value })),
      setAll: (items) => {
        for (const { name, value } of items) cookieJar.set(name, value);
      },
    },
  });
  const cookieSession = await ssrClient.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (cookieSession.error) throw cookieSession.error;
  assert.ok(cookieJar.size > 0, "SSR auth session must be serialized into cookies");

  let serverReady = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(origin);
      if (response.status < 500) {
        serverReady = true;
        break;
      }
    } catch {
      // The Next.js development server may still be starting.
    }
    await delay(1000);
  }
  assert.ok(serverReady, "Next.js server did not become ready");

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies(Array.from(cookieJar, ([name, value]) => ({
    name, value, url: origin, httpOnly: true, secure: false, sameSite: "Lax",
  })));
  const page = await context.newPage();
  await page.goto(`${origin}/cuenta`);
  const cards = page.getByRole("navigation", { name: "Secciones de administración" });
  await cards.getByRole("link", { name: "Comprobantes", exact: true }).click();
  await page.getByRole("heading", { name: "Comprobantes de pago", exact: true }).waitFor({ state: "visible" });
  await page.goto(`${origin}/cuenta`);
  await cards.getByRole("link", { name: "Vencimientos", exact: true }).click();
  await page.getByRole("heading", { name: "Vencimientos", exact: true }).waitFor({ state: "visible" });
  await page.getByLabel("Buscar alumno").fill("Integration");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  const studentLink = page.locator(`a[href="/pagos?vista=vencimientos&alumno=${studentId}"]`);
  await studentLink.click();
  await page.getByRole("heading", { name: "Vencimiento del alumno" }).waitFor({ state: "visible" });

  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(`${origin}/pagos`);
  await page.getByLabel("Buscar alumno").fill("Integration");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await page.waitForURL(url => url.pathname === "/pagos" && url.searchParams.get("q") === "Integration");
  const paymentStudentLink = page.getByRole("link", { name: /Student, Integration/ });
  assert.equal(await paymentStudentLink.getAttribute("href"), `/pagos?alumno=${studentId}`);
  await paymentStudentLink.click();
  await page.getByRole("heading", { name: "Integration Student", exact: true }).waitFor({ state: "visible" });
  assert.equal(await page.getByRole("link", { name: "Cambiar alumno" }).getAttribute("href"), "/pagos");
  const receiptLink = page.getByRole("link", { name: "Revisar comprobantes de pago" });
  await receiptLink.waitFor({ state: "visible", timeout: 30000 });
  assert.equal(await receiptLink.getAttribute("href"), "/pagos/comprobantes", "payments keeps the receipt review link");
  await page.getByRole("heading", { name: "Vencimiento del alumno" }).waitFor({ state: "visible", timeout: 30000 });
  await page.getByLabel("Nuevo día de vencimiento").fill("20");
  await page.getByRole("button", { name: "Guardar cambio de vencimiento" }).click();
  await page.getByText("Operación registrada.").waitFor({ state: "visible", timeout: 30000 });

  const nextMonth = await database.query(
    "select (date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')+interval '1 month')::date as month",
  );
  const schedule = await database.query(
    "select due_day from public.cueva_due_schedules where student_id=$1 and effective_month=$2 order by recorded_at desc limit 1",
    [studentId, nextMonth.rows[0].month],
  );
  assert.equal(schedule.rows[0]?.due_day, 20, "UI/API operation must persist the new due-day schedule");

  const persistedAudit = await database.query(
    "select actor,new_due_day from public.cueva_due_date_audit where student_id=$1 order by recorded_at desc limit 1",
    [studentId],
  );
  assert.equal(persistedAudit.rows[0]?.actor, userId);
  assert.equal(persistedAudit.rows[0]?.new_due_day, 20);

  await page.getByRole("radio", { name: /Período actual/ }).check();
  await page.getByRole("checkbox", { name: "Confirmo que quiero modificar el período actual." }).check();
  await page.getByLabel("Nuevo día de vencimiento").fill("22");
  await page.getByRole("button", { name: "Guardar cambio de vencimiento" }).click();
  await page.getByText("Operación registrada.", { exact: true }).waitFor({ state: "visible", timeout: 30000 });
  await page.getByText(/Día de referencia actual: 22/).waitFor({ state: "visible", timeout: 30000 });

  const currentMonth = await database.query(
    `select date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')::date as month,
            to_char(now() at time zone 'America/Argentina/Buenos_Aires','YYYY-MM-DD') as today`,
  );
  const currentSchedule = await database.query(
    "select due_day from public.cueva_due_schedules where student_id=$1 and effective_month=$2 order by recorded_at desc,id desc limit 1",
    [studentId, currentMonth.rows[0].month],
  );
  assert.equal(currentSchedule.rows[0]?.due_day, 22, "explicitly confirmed current-period change must persist");

  const currentAudit = await database.query(
    "select actor,new_due_day,scope from public.cueva_due_date_audit where student_id=$1 and scope='current_period' order by recorded_at desc limit 1",
    [studentId],
  );
  assert.equal(currentAudit.rows[0]?.actor, userId);
  assert.equal(currentAudit.rows[0]?.new_due_day, 22);
  assert.equal(currentAudit.rows[0]?.scope, "current_period");
  process.stdout.write("PASS: authenticated UI persisted next-period and explicitly confirmed current-period changes with audit.\n");

  const today = currentMonth.rows[0].today;
  const month = today.slice(0, 7);
  const dueOn = `${month}-22`;
  const status = dueOn < today ? "Vencido" : "Pendiente";
  await page.getByRole("button", { name: "Crear período", exact: true }).click();
  const period = page.getByRole("article", { name: `Período ${month}` });
  await period.getByText("Saldo pendiente", { exact: true }).waitFor({ state: "visible", timeout: 30000 });
  await period.getByText(status, { exact: true }).waitFor({ state: "visible" });
  const balance = period.locator(".billing-period-balance dd");
  assert.equal(await balance.textContent(), "$ 100");
  assert.equal(await period.locator("time").getAttribute("datetime"), dueOn);

  const register = period.locator("summary").filter({ hasText: "Registrar pago" });
  assert.ok((await register.boundingBox())?.height >= 44, "mobile register action has a comfortable touch target");
  await register.press("Enter");
  assert.equal(await register.evaluate(element => element.matches(":focus-visible")), true);
  await period.getByLabel("Importe en pesos").fill("40");
  await period.getByRole("button", { name: "Confirmar pago" }).click();
  await balance.filter({ hasText: /^\$ 60$/ }).waitFor({ state: "visible", timeout: 30000 });
  await period.locator("summary").filter({ hasText: "Historial de movimientos" }).click();
  await period.getByText("$ 40 · Confirmado", { exact: true }).waitFor({ state: "visible" });
  assert.equal(await period.locator("time").getAttribute("datetime"), dueOn);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "payments fits at 360 CSS pixels");

  const persistedPayment = await database.query(
    `select p.cents, p.actor, t.due_on::text from public.cueva_payments p
       join public.cueva_periods t on t.id=p.period_id where t.student_id=$1`,
    [studentId],
  );
  assert.deepEqual(persistedPayment.rows, [{ cents: "4000", actor: userId, due_on: dueOn }]);
  process.stdout.write("PASS: authenticated admin searched and selected a student, verified the due date, and registered a partial payment from mobile.\n");
} finally {
  if (browser) await browser.close();
  if (databaseConnected) {
    try {
      await database.query("delete from public.cueva_due_date_audit where student_id=$1", [studentId]);
      await database.query("delete from public.cueva_due_date_attempts where student_id=$1", [studentId]);
      await database.query("delete from public.cueva_due_schedules where student_id=$1", [studentId]);
      await database.query("delete from public.cueva_payments using public.cueva_periods where period_id=cueva_periods.id and student_id=$1", [studentId]);
      await database.query("delete from public.cueva_periods where student_id=$1", [studentId]);
      await database.query("delete from public.cueva_prices where id=$1", [priceId]);
      await database.query("delete from public.cueva_students where id=$1", [studentId]);
      if (userId) {
        await database.query("delete from cueva_private.billing_operations where actor=$1", [userId]);
        await database.query("delete from public.cueva_profiles where user_id=$1", [userId]);
        await database.query("delete from cueva_private.access_state where user_id=$1", [userId]);
      }
    } finally {
      await database.end();
    }
  }
  if (userCreated) {
    const deleted = await admin.auth.admin.deleteUser(userId);
    if (deleted.error) throw deleted.error;
  }
}
