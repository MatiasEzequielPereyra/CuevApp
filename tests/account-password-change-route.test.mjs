import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const state = {
  config: { origin: "https://cueva.example", url: "https://project.supabase.co", key: "publishable-test-key", local: false },
  user: { id: "user-1", email: "alumno@example.test" },
  role: "alumno",
  authError: null,
  verifyError: null,
  verifiedUserId: "user-1",
  updateArgs: null,
  setSessionArgs: null,
  authCalls: 0,
  verifierCalls: 0,
};
const auth = {
  auth: {
    getUser: async () => { state.authCalls += 1; return { data: { user: state.user }, error: state.authError }; },
    signOut: async () => ({ error: null }),
    setSession: async (...args) => { state.setSessionArgs = args; return { data: { user: state.user }, error: null }; },
    updateUser: async (...args) => { state.updateArgs = args; return { data: { user: state.user }, error: state.authError }; },
  },
  from: table => ({
    select: () => ({
      maybeSingle: async () => table === "cueva_profiles"
        ? ({ data: { role: state.role }, error: null })
        : ({ data: null, error: null }),
    }),
  }),
};
const source = fs.readFileSync("src/app/api/acceso/[operation]/route.ts", "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const routeModule = { exports: {} };
const runtimeRequire = name => {
  if (name === "next/server") return {
    NextResponse: {
      redirect: (url, options = {}) => new Response(null, {
        status: options.status ?? 307,
        headers: { location: String(url), ...(options.headers ?? {}) },
      }),
    },
  };
  if (name === "@supabase/supabase-js") return {
    createClient: () => ({
      auth: {
        signInWithPassword: async ({ email, password }) => {
          state.verifierCalls += 1;
          state.verifiedCredentials = { email, password };
          return { data: { user: state.verifyError ? null : { id: state.verifiedUserId }, session: state.verifyError ? null : { access_token: "fresh-access-token", refresh_token: "fresh-refresh-token" } }, error: state.verifyError };
        },
        signOut: async () => ({ error: null }),
      },
    }),
  };
  if (name === "@/lib/student-invitation/server") return { inviteStudent: async () => {} };
  if (name === "@/lib/product-auth/server") return {
    productConfig: () => state.config,
    localFetch: () => fetch,
    userClient: async () => auth,
    serviceClient: () => { throw new Error("password changes must not use the service role"); },
    pendingUserClient: async () => ({ auth, commit: () => {} }),
  };
  return require(name);
};
new Function("require", "module", "exports", output)(runtimeRequire, routeModule, routeModule.exports);
const { POST } = routeModule.exports;

function request(fields, origin = state.config.origin) {
  return new Request("https://cueva.example/api/acceso/cambiar-contrasena", {
    method: "POST",
    headers: { origin, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
  });
}
async function run(fields, origin) {
  return POST(request(fields, origin), { params: Promise.resolve({ operation: "cambiar-contrasena" }) });
}
const valid = {
  current_password: "Current-Password-123",
  new_password: "New-Password-456",
  confirm_password: "New-Password-456",
};
function reset() {
  state.user = { id: "user-1", email: "alumno@example.test" };
  state.role = "alumno";
  state.authError = null;
  state.verifyError = null;
  state.verifiedUserId = "user-1";
  state.updateArgs = null;
  state.setSessionArgs = null;
  state.authCalls = 0;
  state.verifierCalls = 0;
}

test("rejects a foreign Origin before authenticating", async () => {
  reset();
  assert.equal((await run(valid, "https://attacker.example")).status, 403);
  assert.equal(state.authCalls, 0);
});

test("rejects weak, mismatched, missing and unchanged passwords before verification", async () => {
  reset();
  assert.equal((await run({ ...valid, new_password: "short", confirm_password: "short" })).status, 400);
  assert.equal((await run({ ...valid, confirm_password: "different-password" })).status, 400);
  assert.equal((await run({ ...valid, current_password: "" })).status, 400);
  assert.equal((await run({ ...valid, new_password: valid.current_password, confirm_password: valid.current_password })).status, 400);
  assert.equal(state.verifierCalls, 0);
});

test("requires a valid authenticated account with an allowed role", async () => {
  reset();
  state.authError = { message: "expired" };
  assert.equal((await run(valid)).status, 401);
  reset();
  state.role = "unknown";
  assert.equal((await run(valid)).status, 403);
  assert.equal(state.verifierCalls, 0);
});

test("requires the current password to authenticate the same user", async () => {
  reset();
  state.verifyError = { message: "invalid credentials" };
  assert.equal((await run(valid)).status, 401);
  assert.equal(state.updateArgs, null);
  reset();
  state.verifiedUserId = "another-user";
  assert.equal((await run(valid)).status, 401);
  assert.equal(state.updateArgs, null);
});

test("allows an alumno to update their password only after reauthentication", async () => {
  reset();
  const response = await run(valid);
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "https://cueva.example/mi-perfil?contrasena=actualizada");
  assert.deepEqual(state.verifiedCredentials, { email: "alumno@example.test", password: valid.current_password });
  assert.deepEqual(state.setSessionArgs, [{ access_token: "fresh-access-token", refresh_token: "fresh-refresh-token" }]);
  assert.deepEqual(state.updateArgs, [{ password: valid.new_password }]);
});

test("allows an administrator to update their own password with the same checks", async () => {
  reset();
  state.role = "admin";
  const response = await run(valid);
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "https://cueva.example/mi-cuenta?contrasena=actualizada");
  assert.deepEqual(state.setSessionArgs, [{ access_token: "fresh-access-token", refresh_token: "fresh-refresh-token" }]);
  assert.deepEqual(state.updateArgs, [{ password: valid.new_password }]);
});

test("does not use service-role access for a self-service password change", async () => {
  reset();
  assert.equal((await run(valid)).status, 303);
});
