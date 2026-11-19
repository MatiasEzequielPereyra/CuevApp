import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const studentId = "c3000000-0000-4000-8000-000000000001";
const targetUserId = "c1000000-0000-4000-8000-000000000002";
const state = {
  config: { origin: "https://cueva.example", url: "https://project.supabase.co", key: "publishable-test-key", local: false, ownerOnly: false },
  user: { id: "admin-1", email: "admin@example.test" },
  role: "admin",
  student: { id: studentId },
  invitation: { user_id: targetUserId },
  targetProfile: { role: "alumno" },
  calls: [],
  sentTo: null,
};
const auth = {
  auth: {
    getUser: async () => ({ data: { user: state.user }, error: null }),
    resetPasswordForEmail: async (email, options) => { state.sentTo = { email, options }; return { error: null }; },
  },
  from: table => ({
    select: () => ({
      maybeSingle: async () => table === "cueva_profiles"
        ? ({ data: { role: state.role }, error: null })
        : ({ data: null, error: null }),
      eq: (column, value) => ({
        maybeSingle: async () => {
          state.calls.push({ table, column, value });
          if (table === "cueva_students") return { data: state.student, error: null };
          if (table === "cueva_student_invitations") return { data: state.invitation, error: null };
          return { data: null, error: null };
        },
      }),
    }),
  }),
};
const service = {
  from: table => ({
    select: () => ({
      eq: (column, value) => ({
        maybeSingle: async () => {
          state.calls.push({ table, column, value });
          if (table === "cueva_profiles") return { data: state.targetProfile, error: null };
          return { data: null, error: null };
        },
      }),
    }),
  }),
  rpc: async (name, args) => {
    state.calls.push({ rpc: name, args });
    if (name === "cueva_begin_operation") return { data: 4, error: null };
    return { data: true, error: null };
  },
  auth: { admin: { getUserById: async id => ({ data: { user: { id, email: "alumno@example.test" } }, error: null }) } },
};
const source = fs.readFileSync("src/app/api/acceso/[operation]/route.ts", "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const routeModule = { exports: {} };
const runtimeRequire = name => {
  if (name === "next/server") return {
    NextResponse: { redirect: (url, options = {}) => new Response(null, {
      status: options.status ?? 307,
      headers: { location: String(url), ...(options.headers ?? {}) },
    }) },
  };
  if (name === "@supabase/supabase-js") return { createClient: () => ({}) };
  if (name === "@/lib/student-invitation/server") return { inviteStudent: async () => {} };
  if (name === "@/lib/product-auth/server") return {
    productConfig: () => state.config,
    localFetch: () => fetch,
    userClient: async () => auth,
    serviceClient: () => service,
    pendingUserClient: async () => ({ auth, commit: () => {} }),
  };
  return require(name);
};
new Function("require", "module", "exports", output)(runtimeRequire, routeModule, routeModule.exports);
const { POST } = routeModule.exports;
function request(email, origin = state.config.origin) {
  return new Request("https://cueva.example/api/acceso/admin-recuperar", {
    method: "POST",
    headers: { origin, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email }),
  });
}
async function run(email, origin) {
  return POST(request(email, origin), { params: Promise.resolve({ operation: "admin-recuperar" }) });
}
function reset() {
  state.config.ownerOnly = false;
  state.role = "admin";
  state.student = { id: studentId };
  state.invitation = { user_id: targetUserId };
  state.targetProfile = { role: "alumno" };
  state.calls = [];
  state.sentTo = null;
}

test("only administrators can request student password recovery", async () => {
  reset();
  state.role = "alumno";
  assert.equal((await run("alumno@example.test")).status, 403);
  assert.equal(state.sentTo, null);
});

test("validates the student's email before accessing recovery records", async () => {
  reset();
  assert.equal((await run("not-an-email")).status, 400);
  assert.equal(state.calls.length, 0);
});

test("does not send a reset when no student record or linked Auth user exists", async () => {
  reset();
  state.student = null;
  assert.equal((await run("alumno@example.test")).status, 404);
  assert.equal(state.sentTo, null);
  reset();
  state.invitation = { user_id: null };
  assert.equal((await run("alumno@example.test")).status, 404);
  assert.equal(state.sentTo, null);
});

test("sends a recovery link only to the Auth account linked to that student", async () => {
  reset();
  const response = await run(" Alumno@Example.Test ");
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "https://cueva.example/alumnos?id=c3000000-0000-4000-8000-000000000001&recuperacion=enviada");
  assert.deepEqual(state.calls.slice(0, 3), [
    { table: "cueva_students", column: "email", value: "alumno@example.test" },
    { table: "cueva_student_invitations", column: "student_id", value: studentId },
    { table: "cueva_profiles", column: "user_id", value: targetUserId },
  ]);
  assert.equal(state.sentTo.email, "alumno@example.test");
  assert.equal(new URL(state.sentTo.options.redirectTo).pathname, "/aceptar-invitacion");
  assert.equal(new URL(state.sentTo.options.redirectTo).searchParams.get("type"), "recovery");
});
