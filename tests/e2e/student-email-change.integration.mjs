import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const { API_URL, DB_URL, CUEVA_SERVICE_KEY, CUEVA_PRODUCT_ORIGIN, MAILPIT_URL } = process.env;
for (const [name, value] of Object.entries({ API_URL, DB_URL, CUEVA_PRODUCT_ORIGIN, MAILPIT_URL })) {
  assert.equal(new URL(value).hostname, "127.0.0.1", `${name} must target the isolated loopback stack`);
}
const admin = createClient(API_URL, CUEVA_SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const db = new pg.Client({ connectionString: DB_URL });
const studentId = randomUUID();
const originalEmail = `before-${randomUUID()}@example.test`;
const newEmail = `after-${randomUUID()}@example.test`;
const password = `Synthetic!9-${randomUUID()}`;
const confirmationPath = "/mi-perfil?correo=confirmado";
const success = /Tu nuevo correo fue confirmado/;
const jar = new Map();
let userId;

async function app(path, form, cookies = jar) {
  const headers = { cookie: Array.from(cookies, ([name, value]) => `${name}=${value}`).join("; ") };
  if (form) headers.origin = CUEVA_PRODUCT_ORIGIN;
  const response = await fetch(new URL(path, CUEVA_PRODUCT_ORIGIN), {
    headers, redirect: "manual", ...(form && { method: "POST", body: new URLSearchParams(form) }),
  });
  for (const header of response.headers.getSetCookie()) {
    const [nameValue] = header.split(";");
    const equals = nameValue.indexOf("=");
    cookies.set(nameValue.slice(0, equals), nameValue.slice(equals + 1));
  }
  return response;
}

async function verifyEmail(recipient) {
  const inbox = await (await fetch(`${MAILPIT_URL}/api/v1/messages`)).json();
  const matches = inbox.messages.filter(message => message.To.some(item => item.Address === recipient));
  assert.equal(matches.length, 1, "exactly one local verification email reached this address");
  const mail = await (await fetch(`${MAILPIT_URL}/api/v1/message/${matches[0].ID}`)).json();
  const href = /href="([^"<>]+)"/.exec(mail.HTML)?.[1];
  assert.ok(href, "Auth produced a confirmation link");
  const url = new URL(href.replaceAll("&amp;", "&"));
  assert.ok(url.origin === API_URL && url.pathname === "/auth/v1/verify");
  assert.equal(url.searchParams.get("type"), "email_change");
  const result = await fetch(url, { redirect: "manual" });
  assert.ok(result.status >= 300 && result.status < 400, "GoTrue handled the email verification");
  const callback = new URL(result.headers.get("location"));
  assert.ok(callback.origin === CUEVA_PRODUCT_ORIGIN && callback.pathname === "/mi-perfil");
  return app(callback.pathname + callback.search);
}

async function expectIdentity(address) {
  const result = await db.query(`select u.email = $2 and s.email = $2 and i.email = $2 as synchronized
    from auth.users u join public.cueva_student_invitations i on i.user_id = u.id
    join public.cueva_students s on s.id = i.student_id where u.id=$1 and s.id=$3`, [userId, address, studentId]);
  assert.deepEqual(result.rows, [{ synchronized: true }]);
}

await db.connect();
try {
  const created = await admin.auth.admin.createUser({ email: originalEmail, password, email_confirm: true });
  assert.ok(!created.error && created.data.user, "Auth provisioned the synthetic account");
  userId = created.data.user.id;
  await db.query("insert into public.cueva_profiles(user_id,role) values ($1,'alumno')", [userId]);
  await db.query("insert into cueva_private.access_state(user_id,ready,session_not_before) values ($1,true,now()-interval '1 minute')", [userId]);
  await db.query("insert into public.cueva_students(id,first_name,last_name,email,joined_on) values($1,'Prueba','Local',$2,current_date)", [studentId, originalEmail]);
  await db.query("insert into public.cueva_student_invitations(student_id,email,user_id,state,lease,requested_by) values($1,$2,$3,'sent',$4,$3)", [studentId, originalEmail, userId, randomUUID()]);

  assert.doesNotMatch(await (await app(confirmationPath)).text(), success);
  assert.equal((await app("/api/acceso/ingresar", { email: originalEmail, password })).status, 303);
  assert.doesNotMatch(await (await app(confirmationPath)).text(), success);
  const requested = await app("/api/acceso/cambiar-correo", { email: newEmail });
  assert.equal(requested.status, 303);
  assert.equal(new URL(requested.headers.get("location")).search, "?correo=pendiente");
  assert.ok(jar.has("cueva-email-change"));
  await expectIdentity(originalEmail);
  assert.doesNotMatch(await (await app(confirmationPath)).text(), success);

  const partial = await verifyEmail(originalEmail);
  assert.equal(partial.status, 200);
  assert.doesNotMatch(await partial.text(), success);
  await expectIdentity(originalEmail);

  const confirmed = await verifyEmail(newEmail);
  assert.equal(confirmed.status, 200);
  assert.match(await confirmed.text(), success);
  await expectIdentity(newEmail);
  const copied = new Map(jar);
  const proof = jar.get("cueva-email-change");
  copied.set("cueva-email-change", `${proof.slice(0, -1)}${proof.endsWith("A") ? "B" : "A"}`);
  assert.doesNotMatch(await (await app(confirmationPath, undefined, copied)).text(), success);
  assert.equal((await app("/api/acceso/ingresar", { email: originalEmail, password }, new Map())).status, 401);
  assert.equal((await app("/api/acceso/ingresar", { email: newEmail, password }, new Map())).status, 303);
  console.log("PASS: real Auth double confirmation; partial and forged status rejected; Auth, linked invitation and student updated together; login switched.");
} finally {
  try {
    await db.query("delete from public.cueva_student_invitations where student_id=$1", [studentId]);
    await db.query("delete from public.cueva_students where id=$1", [studentId]);
  } finally {
    await db.end();
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
}
