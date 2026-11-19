import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const { API_URL, DB_URL, CUEVA_SERVICE_KEY, CUEVA_PRODUCT_ORIGIN, MAILPIT_URL } = process.env;
const rejected = process.env.CUEVA_TEST_RECOVERY_REJECTED === "1";
for (const [name, value] of Object.entries({ API_URL, DB_URL, CUEVA_PRODUCT_ORIGIN, MAILPIT_URL })) {
  assert.equal(new URL(value).hostname, "127.0.0.1", `${name} must target the isolated loopback stack`);
}
const admin = createClient(API_URL, CUEVA_SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const db = new pg.Client({ connectionString: DB_URL });
const password = () => `Cueva!9-${randomUUID()}`;
const createdUsers = [];
const studentId = randomUUID();

async function createAccount(role) {
  const email = `${role}-${randomUUID()}@example.test`;
  const initial = password();
  const { data, error } = await admin.auth.admin.createUser({ email, password: initial, email_confirm: true });
  assert.ok(!error && data.user, `Auth provisioned a synthetic user (${error?.status ?? "ok"}/${error?.code ?? "ok"})`);
  const userId = data.user.id;
  createdUsers.push(userId);
  await db.query("insert into public.cueva_profiles(user_id,role) values ($1,$2)", [userId, role]);
  await db.query("insert into cueva_private.access_state(user_id,ready,session_not_before) values ($1,true,now()-interval '1 minute')", [userId]);
  return { email, initial, userId };
}

function session() {
  const jar = new Map();
  return async (path, form) => {
    const headers = { cookie: Array.from(jar, ([name, value]) => `${name}=${value}`).join("; ") };
    if (form) headers.origin = CUEVA_PRODUCT_ORIGIN;
    const response = await fetch(new URL(path, CUEVA_PRODUCT_ORIGIN), {
      headers, redirect: "manual", ...(form && { method: "POST", body: new URLSearchParams(form) }),
    });
    for (const header of response.headers.getSetCookie()) {
      const [nameValue] = header.split(";");
      const equals = nameValue.indexOf("=");
      jar.set(nameValue.slice(0, equals), nameValue.slice(equals + 1));
    }
    return response;
  };
}

async function login(account, credential, request = session()) {
  return request("/api/acceso/ingresar", { email: account.email, password: credential });
}

async function checkPassword(account, request, path) {
  const next = password();
  const fields = { new_password: next, confirm_password: next };
  assert.equal((await request("/api/acceso/cambiar-contrasena", { ...fields, current_password: password() })).status, 401);
  const changed = await request("/api/acceso/cambiar-contrasena", { ...fields, current_password: account.initial });
  assert.equal(changed.status, 303);
  assert.equal(new URL(changed.headers.get("location")).pathname, path);
  assert.match(await (await request(`${path}?contrasena=actualizada`)).text(), /Tu contraseña se actualizó correctamente/);
  assert.equal((await login(account, account.initial)).status, 401);
  assert.equal((await login(account, next)).status, 303);
  return next;
}

async function readRecoveryMail(email) {
  const result = await (await fetch(`${MAILPIT_URL}/api/v1/messages`)).json();
  const mails = result.messages.filter(message => message.To.some(recipient => recipient.Address === email));
  assert.equal(mails.length, 1, "one recovery message was accepted locally");
  const message = await (await fetch(`${MAILPIT_URL}/api/v1/message/${mails[0].ID}`)).json();
  const link = /href="([^"<>]+)"/.exec(message.HTML)?.[1];
  assert.ok(link, "GoTrue mail contains a recovery link");
  const confirmation = new URL(link.replaceAll("&amp;", "&"));
  // The isolated stack uses GoTrue's stock template. Read the very same token
  // and redirect fields that CUEVA's production recovery template combines.
  assert.equal(confirmation.pathname, "/auth/v1/verify");
  assert.equal(confirmation.searchParams.get("type"), "recovery");
  const target = new URL(confirmation.searchParams.get("redirect_to"));
  assert.ok(target.origin === CUEVA_PRODUCT_ORIGIN && target.pathname === "/aceptar-invitacion");
  const token = confirmation.searchParams.get("token");
  assert.ok(token, "GoTrue supplied the token hash");
  return { ...Object.fromEntries(target.searchParams), token };
}

async function accessState(userId) {
  const query = await db.query(`select ready, operation_kind, allowed_session is null as unbound,
    nonce_hash is not null as has_nonce from cueva_private.access_state where user_id=$1`, [userId]);
  return query.rows[0];
}

await db.connect();
try {
  const staff = await createAccount("admin");
  const student = await createAccount("alumno");
  await db.query("insert into public.cueva_students(id,first_name,last_name,email,joined_on) values($1,'Prueba','Local',$2,current_date)", [studentId, student.email]);
  await db.query("insert into public.cueva_student_invitations(student_id,email,user_id,state,lease,requested_by) values($1,$2,$3,'sent',$4,$5)", [studentId, student.email, student.userId, randomUUID(), staff.userId]);
  const staffSession = session();
  const studentSession = session();
  assert.equal((await login(staff, staff.initial, staffSession)).status, 303);
  assert.equal((await login(student, student.initial, studentSession)).status, 303);
  let old = student.initial;
  if (!rejected) {
    await checkPassword(staff, staffSession, "/mi-cuenta");
    old = await checkPassword(student, studentSession, "/mi-perfil");
    console.log("PASS: admin and alumno changed their own password, wrong current and old passwords rejected.");
  }

  const accessPage = await staffSession(`/alumnos?id=${studentId}`);
  assert.equal(accessPage.status, 200);
  const profileMarkup = await accessPage.text();
  assert.match(profileMarkup, /Recuperar acceso del alumno/);
  assert.match(profileMarkup, /Enviar enlace de recuperación/);
  assert.match(profileMarkup, /action="\/api\/acceso\/admin-recuperar"/);
  const fields = { email: student.email };
  assert.equal((await studentSession("/api/acceso/admin-recuperar", fields)).status, 403);
  const recovery = await staffSession("/api/acceso/admin-recuperar", fields);
  const state = await accessState(student.userId);
  assert.equal(state.ready, false);
  assert.equal(state.unbound, true);
  assert.equal(state.has_nonce, true);
  assert.doesNotMatch(await (await studentSession("/mi-perfil")).text(), /action="\/api\/acceso\/cambiar-contrasena"/);
  if (rejected) {
    assert.equal(recovery.status, 503);
    assert.equal(state.operation_kind, "reset");
    assert.equal((await staffSession("/api/acceso/admin-recuperar", fields)).status, 409);
    const inbox = await (await fetch(`${MAILPIT_URL}/api/v1/messages`)).json();
    assert.equal(inbox.messages.some(message => message.To.some(recipient => recipient.Address === student.email)), false);
    console.log("PASS: SMTP rejection -> 503, no mail, gate closed with reset reserved, retry -> 409.");
  } else {
    assert.equal(recovery.status, 303);
    assert.equal(new URL(recovery.headers.get("location")).pathname, "/alumnos");
    assert.equal(new URL(recovery.headers.get("location")).searchParams.get("id"), studentId);
    assert.equal(state.operation_kind, null);
    const recover = session();
    assert.equal((await recover("/api/acceso/invitacion", await readRecoveryMail(student.email))).status, 303);
    const newPassword = password();
    assert.equal((await recover("/api/acceso/contrasena", { password: newPassword })).status, 303);
    assert.equal((await accessState(student.userId)).ready, true);
    const restoredProfile = await recover("/mi-perfil");
    assert.equal(restoredProfile.status, 200);
    assert.match(await restoredProfile.text(), /action="\/api\/acceso\/cambiar-contrasena"/);
    assert.equal((await login(student, old)).status, 401);
    assert.equal((await login(student, newPassword)).status, 303);
    console.log("PASS: recovery mail -> Auth verification -> chosen password -> ready; old password rejected.");
  }
} finally {
  try {
    await db.query("delete from public.cueva_student_invitations where student_id=$1", [studentId]);
    await db.query("delete from public.cueva_students where id=$1", [studentId]);
  } finally {
    await db.end();
    for (const userId of createdUsers) await admin.auth.admin.deleteUser(userId);
  }
}
