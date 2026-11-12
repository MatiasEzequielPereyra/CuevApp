import assert from "node:assert/strict";
import { randomUUID, createECDH } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const apiUrl = process.env.API_URL;
const anonKey = process.env.ANON_KEY;
const serviceKey = process.env.CUEVA_SERVICE_KEY;
const databaseUrl = process.env.DB_URL;
const origin = "http://127.0.0.1:3000";
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
const anonymous = createClient(apiUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const database = new pg.Client({ connectionString: databaseUrl });
const suffix = randomUUID();
const studentIds = [randomUUID(), randomUUID()];
const userIds = [];
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

async function call(method, body, cookies, requestOrigin = origin) {
  const headers = { origin: requestOrigin };
  if (cookies) headers.cookie = cookies;
  if (body !== undefined) headers["content-type"] = "application/json";
  return fetch(`${origin}/api/notifications/push`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function assertJson(response, status, expected) {
  assert.equal(response.status, status, await response.clone().text());
  assert.deepEqual(await response.json(), expected);
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

  const signedIn = await anonymous.auth.signInWithPassword({ email: emails[0], password });
  if (signedIn.error || !signedIn.data.session) {
    throw signedIn.error ?? new Error("Supabase did not issue an integration session");
  }
  const session = signedIn.data.session;
  const claims = JSON.parse(
    Buffer.from(session.access_token.split(".")[1], "base64url").toString("utf8"),
  );
  assert.equal(claims.sub, userIds[0]);
  assert.ok(claims.session_id, "authenticated JWT must include a session id");

  const cookieJar = new Map();
  const ssrClient = createServerClient(apiUrl, anonKey, {
    cookies: {
      getAll: () => Array.from(cookieJar, ([name, value]) => ({ name, value })),
      setAll: items => {
        for (const { name, value } of items) cookieJar.set(name, value);
      },
    },
  });
  const cookieSession = await ssrClient.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (cookieSession.error) throw cookieSession.error;
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

  const unauthenticated = await call("GET");
  assert.equal(unauthenticated.status, 403, "GET must reject requests without a session");
  const foreignOrigin = await call("PUT", { enabled: false }, cookies, "https://attacker.example");
  assert.equal(foreignOrigin.status, 403, "mutations must reject a foreign Origin");

  const initialPreference = await call("GET", undefined, cookies);
  assert.equal(initialPreference.status, 200);
  const initialBody = await initialPreference.json();
  assert.equal(initialBody.pushEnabled, true, "new student preference defaults to enabled");
  assert.equal(initialBody.available, false, "CI must not require production VAPID secrets");
  assert.equal(initialBody.publicKey, null, "unconfigured VAPID key must not be exposed");

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
