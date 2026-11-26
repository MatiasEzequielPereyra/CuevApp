// Focused real Auth/PostgREST proof in the existing disposable CI stack.
// Token generation is local/admin test setup; no SMTP delivery is claimed.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const { API_URL, DB_URL, CUEVA_PRODUCT_ORIGIN, CUEVA_SERVICE_KEY, CUEVA_PUBLISHABLE_KEY } = process.env;
for (const value of [API_URL, DB_URL, CUEVA_PRODUCT_ORIGIN]) assert.equal(new URL(value).hostname, "127.0.0.1");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(API_URL, CUEVA_SERVICE_KEY, options);
const db = new pg.Client({ connectionString: DB_URL });
const users = [];
const students = [];
const credential = () => `Synthetic!9-${randomUUID()}`;
const post = (operation, fields) => fetch(`${CUEVA_PRODUCT_ORIGIN}/api/acceso/${operation}`, {
  method: "POST", headers: { origin: CUEVA_PRODUCT_ORIGIN }, body: new URLSearchParams(fields), redirect: "manual",
});
await db.connect();
try {
  for (const kind of ["admin", "sent", "self_registered", "pending"]) {
    const email = `recovery-${randomUUID()}@example.test`;
    const old = credential();
    const created = await service.auth.admin.createUser({ email, password: old, email_confirm: true });
    assert.equal(created.error, null);
    const id = created.data.user.id;
    users.push(id);
    const ready = kind !== "pending";
    const role = kind === "admin" ? "admin" : "alumno";
    await db.query("insert into public.cueva_profiles(user_id,role) values($1,$2)", [id, role]);
    await db.query("insert into cueva_private.access_state(user_id,ready,session_not_before) values($1,$2,now()-interval '1 minute')", [id, ready]);
    if (kind === "sent" || kind === "self_registered") {
      const student = randomUUID(); students.push(student);
      await db.query("insert into public.cueva_students(id,first_name,last_name,email,joined_on) values($1,'Prueba','Recuperacion',$2,current_date)", [student, email]);
      await db.query("insert into public.cueva_student_invitations(student_id,email,user_id,state,lease,requested_by) values($1,$2,$3,$4,$5,$3)", [student, email, id, kind, randomUUID()]);
    }
    const snapshot = async () => (await db.query(`select p.role,s.* from public.cueva_profiles p join cueva_private.access_state s using(user_id) where p.user_id=$1`, [id])).rows;
    const before = await snapshot();
    const generated = await service.auth.admin.generateLink({ type: "recovery", email });
    assert.equal(generated.error, null);
    const token = generated.data.properties.hashed_token;
    const next = credential();
    assert.equal((await post("restablecer", { token_hash: token, password: next, confirm_password: "mismatch" })).status, 400);
    const response = await post("restablecer", { token_hash: token, password: next, confirm_password: next });
    assert.equal(response.status, ready ? 200 : 403);
    assert.equal(response.headers.get("set-cookie"), null, "No recovery session is published");
    assert.deepEqual(await snapshot(), before, "Recovery cannot mutate role or access gate");
    const client = createClient(API_URL, CUEVA_PUBLISHABLE_KEY, options);
    const oldLogin = await client.auth.signInWithPassword({ email, password: old });
    if (ready) {
      assert.ok(oldLogin.error, "Old password rejected");
      const login = await client.auth.signInWithPassword({ email, password: next });
      assert.equal(login.error, null);
      assert.equal(login.data.user.id, id);
      const profile = await client.from("cueva_profiles").select("role").maybeSingle();
      assert.equal(profile.data?.role, role);
      assert.equal((await post("restablecer", { token_hash: token, password: credential(), confirm_password: "mismatch" })).status, 400);
      assert.equal((await post("restablecer", { token_hash: token, password: next, confirm_password: next })).status, 400, "Token replay rejected by real Auth");
    } else {
      assert.equal(oldLogin.error, null, "Pending account password was not changed");
      const profile = await client.from("cueva_profiles").select("role").maybeSingle();
      assert.equal(profile.data, null, "Pending account remains denied by RLS");
    }
    await client.auth.signOut();
  }
  const response = await post("recuperar", { email: `unknown-${randomUUID()}@example.test` });
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { ok: true });
  console.log("PASS recovery: native Auth token -> own password -> new login; admin/invited/self-registered roles and gates unchanged; pending denied; replay rejected. No SMTP delivery claim.");
} finally {
  for (const student of students) {
    await db.query("delete from public.cueva_student_invitations where student_id=$1", [student]);
    await db.query("delete from public.cueva_students where id=$1", [student]);
  }
  await db.end();
  for (const id of users) await service.auth.admin.deleteUser(id);
}
