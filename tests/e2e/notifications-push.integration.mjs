import assert from "node:assert/strict";
import { randomUUID, createECDH } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { chromium, expect } from "@playwright/test";
import pg from "pg";

const apiUrl = process.env.API_URL;
const anonKey = process.env.ANON_KEY;
const serviceKey = process.env.CUEVA_SERVICE_KEY;
const databaseUrl = process.env.DB_URL;
const origin = process.env.CUEVA_PRODUCT_ORIGIN ?? "http://127.0.0.1:3000";
const nativeBrowser = process.env.CUEVA_TEST_NATIVE_PUSH_BROWSER;
for (const [name, value] of Object.entries({
  API_URL: apiUrl,
  ANON_KEY: anonKey,
  SERVICE_ROLE_KEY: serviceKey,
  DB_URL: databaseUrl,
})) {
  if (!value) throw new Error(`Missing ${name} from Supabase local environment`);
}

const admin = createClient(apiUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const database = new pg.Client({ connectionString: databaseUrl });
const suffix = randomUUID();
const studentIds = [randomUUID(), randomUUID()];
const userIds = [];
const [priceId, periodId, reminderId, deliveryId, inboxId] = Array.from({ length: 5 }, () => randomUUID());
const emails = studentIds.map((id, index) => `push-integration-${index}-${suffix}@example.test`);
const password = `CuevA-${randomUUID()}-9!`;
let databaseConnected = false;
const keyPair = createECDH("prime256v1");
keyPair.generateKeys();
const keys = {
  p256dh: keyPair.getPublicKey().toString("base64url"),
  auth: Buffer.alloc(16, 19).toString("base64url"),
};

function subscription(endpointId) {
  return {
    endpoint: `https://fcm.googleapis.com/fcm/send/cueva-${suffix}-${endpointId}`,
    expirationTime: null,
    keys,
  };
}

function cookieHeader(jar) {
  return Array.from(jar, ([name, value]) => `${name}=${value}`).join("; ");
}

async function call(method, body, cookies, requestOrigin = origin, checkOnly = false) {
  const headers = { origin: requestOrigin };
  if (cookies) headers.cookie = cookies;
  if (body !== undefined) headers["content-type"] = "application/json";
  return fetch(`${origin}/api/notifications/push${checkOnly ? "?check=1" : ""}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function assertJson(response, status, expected) {
  assert.equal(response.status, status, await response.clone().text());
  assert.deepEqual(await response.json(), expected);
}

async function cookiesFor(index) {
  const cookieJar = new Map();
  const client = createServerClient(apiUrl, anonKey, {
    cookies: {
      getAll: () => Array.from(cookieJar, ([name, value]) => ({ name, value })),
      setAll: items => {
        for (const { name, value } of items) cookieJar.set(name, value);
      },
    },
  });
  const { data, error } = await client.auth.signInWithPassword({ email: emails[index], password });
  if (error) throw error;
  assert.equal(data.user.id, userIds[index]);
  assert.ok(data.session && cookieJar.size, "real login must create an SSR session");
  const claims = JSON.parse(Buffer.from(data.session.access_token.split(".")[1], "base64url").toString("utf8"));
  assert.ok(claims.session_id, "authenticated JWT must include a session id");
  return cookieJar;
}

async function inboxFixture() {
  await database.query("insert into public.cueva_prices(id,effective_month,cents,actor) values($1,'2099-03-01',10000,$2)", [priceId, userIds[0]]);
  await database.query("insert into public.cueva_periods(id,student_id,month,due_on,cents,price_id,actor) values($1,$2,'2099-03-01','2099-03-10',10000,$3,$4)", [periodId, studentIds[0], priceId, userIds[0]]);
  await database.query("insert into public.cueva_notifications(id,period_id,reminder_days,due_on,scheduled_at) values($1,$2,5,'2099-03-10','2099-03-05T15:00:00Z')", [reminderId, periodId]);
  await database.query("insert into public.cueva_notification_deliveries(id,notification_id,channel,next_attempt_at) values($1,$2,'internal',now())", [deliveryId, reminderId]);
  await database.query("insert into public.cueva_notification_inbox(id,delivery_id,notification_id,student_id,user_id,title,body) values($1,$2,$3,$4,$5,'Aviso sintético','Prueba local de lectura')", [inboxId, deliveryId, reminderId, studentIds[0], userIds[0]]);
}

function browserCookies(jar) {
  return Array.from(jar, ([name, value]) => ({ name, value, url: origin, httpOnly: true }));
}

async function exerciseInbox(ownerCookies, otherCookies) {
  await inboxFixture();
  const browser = await chromium.launch();
  try {
    const owner = await browser.newContext();
    const other = await browser.newContext();
    await owner.addCookies(browserCookies(ownerCookies));
    await other.addCookies(browserCookies(otherCookies));
    const ownerPage = await owner.newPage();
    const otherPage = await other.newPage();
    await otherPage.goto(`${origin}/notificaciones`);
    await expect(otherPage.getByText("Todavía no tenés avisos internos.")).toBeVisible();
    const denied = await otherPage.evaluate(async id => {
      const response = await fetch("/api/notifications/inbox", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
      });
      return { status: response.status, body: await response.json() };
    }, inboxId);
    assert.deepEqual(denied, { status: 404, body: { message: "Aviso no encontrado." } });
    assert.equal((await database.query("select read_at from public.cueva_notification_inbox where id=$1", [inboxId])).rows[0].read_at, null);

    await ownerPage.goto(`${origin}/notificaciones`);
    const readResponse = ownerPage.waitForResponse(response => new URL(response.url()).pathname === "/api/notifications/inbox");
    await ownerPage.getByRole("button", { name: "Marcar como leído" }).click();
    const response = await readResponse;
    assert.equal(response.status(), 200);
    assert.match((await response.request().allHeaders())["content-length"], /^\d+$/);
    await expect(ownerPage.getByText("Leído", { exact: true })).toBeVisible();
    await ownerPage.reload();
    await expect(ownerPage.getByText("Leído", { exact: true })).toBeVisible();
    assert.ok((await database.query("select read_at from public.cueva_notification_inbox where id=$1", [inboxId])).rows[0].read_at);
    console.log("PASS: inbox browser PATCH with Content-Length 200, persisted after reload, other student 404.");
  } finally {
    await browser.close();
  }
}

async function exerciseNativePush(jar, otherJar, studentId) {
  const context = await chromium.launchPersistentContext("", {
    channel: nativeBrowser,
    permissions: ["notifications"],
    ignoreDefaultArgs: ["--disable-background-networking", "--disable-component-update", "--disable-sync", "--disable-extensions"],
  });
  const page = await context.newPage();
  try {
    await page.addInitScript(() => {
      const realFetch = window.fetch.bind(window);
      window.fetch = (input, options) => {
        if (input === "/api/notifications/push" && options?.method === "POST") {
          const scenario = window.cuevaPushTestResponse;
          window.cuevaPushTestResponse = null;
          if (scenario === "no-confirmation") return Promise.resolve(Response.json({ registered: false }));
          if (scenario === "invalid-host") {
            // Keep the native keys and replace only the endpoint to exercise the real 400.
            const body = JSON.stringify({ ...JSON.parse(options.body), endpoint: "https://attacker.example/device" });
            return realFetch(input, { ...options, body });
          }
        }
        return realFetch(input, options);
      };
    });
    await context.addCookies(browserCookies(jar));
    await page.goto(`${origin}/notificaciones`);
    const enable = page.getByRole("button", { name: "Activar en este dispositivo" });
    const enabled = page.getByText("Push habilitado", { exact: true });
    const registrationUrl = `${origin}/api/notifications/push`;
    const waitForRegistration = () => page.waitForResponse(response =>
      response.url() === registrationUrl && response.request().method() === "POST", { timeout: 60_000 });

    await page.evaluate(() => { window.cuevaPushTestResponse = "invalid-host"; });
    const rejected = waitForRegistration();
    await enable.click();
    assert.equal((await rejected).status(), 400);
    await expect(page.getByText("La suscripción del dispositivo no es válida.")).toBeVisible();
    await expect(enabled).toHaveCount(0);
    await page.reload();
    await expect(enable).toBeVisible();
    await expect(enabled).toHaveCount(0);

    await page.evaluate(() => { window.cuevaPushTestResponse = "no-confirmation"; });
    await enable.click();
    await expect(page.getByText("No pudimos confirmar el registro de este dispositivo.")).toBeVisible();
    await expect(enabled).toHaveCount(0);

    const registered = waitForRegistration();
    await enable.click();
    const response = await registered;
    assert.equal(response.status(), 200);
    assert.deepEqual(await response.json(), { registered: true });
    const details = response.request().postDataJSON();
    await expect(enabled).toBeVisible();
    const checked = page.waitForResponse(result => result.url() === `${registrationUrl}?check=1`);
    await page.reload();
    const verification = await checked;
    assert.equal(verification.status(), 200);
    assert.deepEqual(await verification.json(), { registered: true });
    await expect(enabled).toBeVisible({ timeout: 15_000 });
    await assertJson(await call("POST", details, cookieHeader(otherJar), origin, true), 200, { registered: false });
    const stored = await database.query("select student_id from public.cueva_push_subscriptions where student_id=$1 and endpoint=$2 and revoked_at is null", [studentId, details.endpoint]);
    assert.equal(stored.rowCount, 1);
    await assertJson(await call("DELETE", { endpoint: details.endpoint }, cookieHeader(jar)), 200, { removed: true });
    await page.reload();
    await expect(enable).toBeVisible();
    await expect(enabled).toHaveCount(0);
    console.log(`PASS: ${nativeBrowser} native subscription (${new URL(details.endpoint).hostname}), real 400, 200 without confirmation, 200 registered, reload, other student and revocation.`);
  } finally {
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await (await registration?.pushManager.getSubscription())?.unsubscribe();
    }).catch(() => {});
    await context.close();
  }
}

try {
  await database.connect();
  databaseConnected = true;

  for (let index = 0; index < 2; index += 1) {
    const created = await admin.auth.admin.createUser({
      email: emails[index],
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user) {
      throw created.error ?? new Error("Supabase did not create the integration user");
    }
    userIds.push(created.data.user.id);
  }

  for (let index = 0; index < 2; index += 1) {
    await database.query(
      "insert into public.cueva_profiles(user_id,role) values($1,'alumno')",
      [userIds[index]],
    );
    await database.query(
      "insert into cueva_private.access_state(user_id,ready,session_not_before) values($1,true,now()-interval '1 minute')",
      [userIds[index]],
    );
    await database.query(
      "insert into public.cueva_students(id,first_name,last_name,email,joined_on) values($1,$2,'Push',$3,date '2026-01-12')",
      [studentIds[index], `Integration${index}`, emails[index]],
    );
    await database.query(
      `insert into public.cueva_student_invitations(
         student_id,email,user_id,state,lease,requested_by
       ) values($1,$2,$3,'sent',$4,$5)`,
      [studentIds[index], emails[index], userIds[index], randomUUID(), userIds[0]],
    );
  }

  const cookieJar = await cookiesFor(0);
  const otherJar = await cookiesFor(1);
  const cookies = cookieHeader(cookieJar);
  assert.ok(cookies, "SSR auth session must be serialized into cookies");

  let serverReady = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(origin);
      if (response.status < 500) {
        serverReady = true;
        break;
      }
    } catch {
      // Next.js may still be starting.
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.ok(serverReady, "Next.js server did not become ready");

  await exerciseInbox(cookieJar, otherJar);
  if (nativeBrowser) await exerciseNativePush(otherJar, cookieJar, studentIds[1]);

  const unauthenticated = await call("GET");
  assert.equal(unauthenticated.status, 403, "GET must reject requests without a session");
  const foreignOrigin = await call("PUT", { enabled: false }, cookies, "https://attacker.example");
  assert.equal(foreignOrigin.status, 403, "mutations must reject a foreign Origin");

  const initialPreference = await call("GET", undefined, cookies);
  assert.equal(initialPreference.status, 200);
  const initialBody = await initialPreference.json();
  assert.equal(initialBody.pushEnabled, true, "new student preference defaults to enabled");
  assert.equal(initialBody.available, !!nativeBrowser, "native browser run uses a dedicated local VAPID key pair");
  if (!nativeBrowser) assert.equal(initialBody.publicKey, null, "unconfigured VAPID key must not be exposed");

  await assertJson(
    await call("PUT", { enabled: false }, cookies),
    200,
    { pushEnabled: false },
  );
  const disabled = await call("GET", undefined, cookies);
  assert.equal((await disabled.json()).pushEnabled, false, "preference update must persist through RLS");
  await assertJson(
    await call("PUT", { enabled: true }, cookies),
    200,
    { pushEnabled: true },
  );

  const foreignEndpoint = subscription("owned-by-second-student");
  await database.query(
    `insert into public.cueva_push_subscriptions(student_id,endpoint,p256dh,auth_secret)
     values($1,$2,$3,$4)`,
    [studentIds[1], foreignEndpoint.endpoint, keys.p256dh, keys.auth],
  );
  const crossAccount = await call("POST", foreignEndpoint, cookies);
  assert.equal(crossAccount.status, 409, "another student's endpoint must not be claimed");
  const foreignDelete = await call("DELETE", { endpoint: foreignEndpoint.endpoint }, cookies);
  await assertJson(foreignDelete, 200, { removed: true });
  const foreignRow = await database.query(
    "select revoked_at from public.cueva_push_subscriptions where endpoint=$1 and student_id=$2",
    [foreignEndpoint.endpoint, studentIds[1]],
  );
  assert.equal(foreignRow.rows.length, 1);
  assert.equal(foreignRow.rows[0].revoked_at, null, "DELETE must not revoke another student's device");

  const firstEndpoint = subscription("device-1");
  await assertJson(
    await call("POST", firstEndpoint, cookies),
    200,
    { registered: true },
  );
  let ownRows = await database.query(
    "select id,student_id,revoked_at from public.cueva_push_subscriptions where endpoint=$1",
    [firstEndpoint.endpoint],
  );
  assert.equal(ownRows.rows.length, 1);
  assert.equal(ownRows.rows[0].student_id, studentIds[0]);
  await assertJson(await call("POST", firstEndpoint, cookies, origin, true), 200, { registered: true });
  await assertJson(await call("POST", firstEndpoint, cookieHeader(otherJar), origin, true), 200, { registered: false });
  await assertJson(await call("POST", {
    ...firstEndpoint, keys: { ...keys, auth: Buffer.alloc(16, 51).toString("base64url") },
  }, cookies, origin, true), 200, { registered: false });

  await assertJson(
    await call("POST", { ...firstEndpoint, keys: { ...keys, auth: Buffer.alloc(16, 23).toString("base64url") } }, cookies),
    200,
    { registered: true },
  );
  const refreshed = await database.query(
    "select id,auth_secret from public.cueva_push_subscriptions where endpoint=$1",
    [firstEndpoint.endpoint],
  );
  assert.equal(refreshed.rows[0].id, ownRows.rows[0].id, "re-registering must update, not duplicate, a device");
  assert.equal(refreshed.rows[0].auth_secret, Buffer.alloc(16, 23).toString("base64url"));

  await assertJson(
    await call("DELETE", { endpoint: firstEndpoint.endpoint }, cookies),
    200,
    { removed: true },
  );
  ownRows = await database.query(
    "select revoked_at from public.cueva_push_subscriptions where endpoint=$1",
    [firstEndpoint.endpoint],
  );
  assert.ok(ownRows.rows[0].revoked_at, "DELETE must revoke the caller's device");
  await assertJson(await call("POST", firstEndpoint, cookies, origin, true), 200, { registered: false });
  await assertJson(
    await call("POST", firstEndpoint, cookies),
    200,
    { registered: true },
  );
  ownRows = await database.query(
    "select revoked_at from public.cueva_push_subscriptions where endpoint=$1",
    [firstEndpoint.endpoint],
  );
  assert.equal(ownRows.rows[0].revoked_at, null, "registering a revoked endpoint must reactivate it");

  for (let index = 2; index <= 10; index += 1) {
    const response = await call("POST", subscription(`device-${index}`), cookies);
    await assertJson(response, 200, { registered: true });
  }
  const atLimit = await database.query(
    "select count(*)::integer as count from public.cueva_push_subscriptions where student_id=$1 and revoked_at is null",
    [studentIds[0]],
  );
  assert.equal(atLimit.rows[0].count, 10, "student may have at most ten active devices");
  const eleventh = await call("POST", subscription("device-11"), cookies);
  assert.equal(eleventh.status, 409, "eleventh active device must be rejected");
  const afterLimit = await database.query(
    "select count(*)::integer as count from public.cueva_push_subscriptions where student_id=$1 and revoked_at is null",
    [studentIds[0]],
  );
  assert.equal(afterLimit.rows[0].count, 10, "rejected registration must not exceed the cap");

  const ownPreference = await database.query(
    "select push_enabled from public.cueva_notification_preferences where student_id=$1",
    [studentIds[0]],
  );
  const otherPreference = await database.query(
    "select push_enabled from public.cueva_notification_preferences where student_id=$1",
    [studentIds[1]],
  );
  assert.equal(ownPreference.rows[0].push_enabled, true);
  assert.equal(otherPreference.rows[0].push_enabled, true, "one student's preference must not affect another");

  process.stdout.write(
    "PASS: authenticated Push HTTP API exercised against local Supabase: session/RLS, origin checks, preference persistence, endpoint ownership, register/update/revoke/reactivate, and ten-device cap.\n",
  );
} finally {
  if (databaseConnected) {
    try {
      await database.query("delete from public.cueva_notification_inbox where id=$1", [inboxId]);
      await database.query("delete from public.cueva_notification_deliveries where id=$1", [deliveryId]);
      await database.query("delete from public.cueva_notifications where id=$1", [reminderId]);
      await database.query("delete from public.cueva_periods where id=$1", [periodId]);
      await database.query("delete from public.cueva_prices where id=$1", [priceId]);
      await database.query("delete from public.cueva_push_subscriptions where student_id = any($1::uuid[])", [studentIds]);
      await database.query("delete from public.cueva_student_invitations where student_id = any($1::uuid[])", [studentIds]);
      await database.query("delete from public.cueva_notification_preferences where student_id = any($1::uuid[])", [studentIds]);
      await database.query("delete from public.cueva_students where id = any($1::uuid[])", [studentIds]);
      if (userIds.length) {
        await database.query("delete from public.cueva_profiles where user_id = any($1::uuid[])", [userIds]);
        await database.query("delete from cueva_private.access_state where user_id = any($1::uuid[])", [userIds]);
      }
    } finally {
      await database.end();
    }
  }
  for (const userId of userIds) {
    const deleted = await admin.auth.admin.deleteUser(userId);
    if (deleted.error) throw deleted.error;
  }
}
