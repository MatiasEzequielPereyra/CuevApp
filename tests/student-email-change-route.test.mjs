import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const source = fs.readFileSync("src/app/api/acceso/[operation]/route.ts", "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

const state = {
  origin: "https://cueva.example",
  user: { id: "student-1", email: "actual@example.test" },
  role: "alumno",
  authError: null,
  updateArgs: null,
  userClientCalls: 0,
};
const auth = {
  auth: {
    getUser: async () => ({ data: { user: state.user }, error: null }),
    updateUser: async (...args) => {
      state.updateArgs = args;
      return { data: { user: state.user }, error: state.authError };
    },
  },
  from: (table) => ({
    select: () => ({
      maybeSingle: async () => table === "cueva_profiles"
        ? ({ data: { role: state.role }, error: null })
        : ({ data: null, error: null }),
    }),
  }),
};

const routeModule = { exports: {} };
const runtimeRequire = (name) => {
  if (name === "next/server") return {
    NextResponse: {
      redirect: (url, options = {}) => new Response(null, {
        status: options.status ?? 307,
        headers: { location: String(url), ...(options.headers ?? {}) },
      }),
    },
  };
  if (name === "@/lib/student-invitation/server") return { inviteStudent: async () => {} };
  if (name === "@/lib/product-auth/server") return {
    productConfig: () => ({ origin: state.origin }),
    userClient: async () => { state.userClientCalls += 1; return auth; },
    serviceClient: () => { throw new Error("service role must not be used for a student email change"); },
    pendingUserClient: async () => ({ auth, commit: () => {} }),
  };
  return require(name);
};
new Function("require", "module", "exports", output)(runtimeRequire, routeModule, routeModule.exports);
const { POST } = routeModule.exports;

function request(email, origin = state.origin) {
  return new Request("https://cueva.example/api/acceso/cambiar-correo", {
    method: "POST",
    headers: { origin, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email }),
  });
}
async function run(email, origin) {
  return POST(request(email, origin), { params: Promise.resolve({ operation: "cambiar-correo" }) });
}
function reset() {
  state.role = "alumno";
  state.authError = null;
  state.updateArgs = null;
  state.userClientCalls = 0;
}

test("rejects a foreign Origin before opening an authenticated client", async () => {
  reset();
  assert.equal((await run("nuevo@example.test", "https://attacker.example")).status, 403);
  assert.equal(state.userClientCalls, 0);
});

test("rejects invalid email values without calling Supabase Auth", async () => {
  reset();
  assert.equal((await run("no-es-un-correo")).status, 400);
  assert.equal(state.updateArgs, null);
});

test("only an authenticated alumno can request an email change", async () => {
  reset();
  state.role = "admin";
  assert.equal((await run("nuevo@example.test")).status, 403);
  assert.equal(state.updateArgs, null);
});

test("asks Supabase Auth to send verification and preserves the current email until confirmation", async () => {
  reset();
  const response = await run("  Nuevo@Example.Test  ");
  assert.equal(response.status, 303);
  assert.match(response.headers.get("location"), /mi-perfil\\?correo=pendiente$/);
  assert.deepEqual(state.updateArgs, [{
    email: "nuevo@example.test",
  }, {
    emailRedirectTo: "https://cueva.example/mi-perfil?correo=confirmado",
  }]);
});

test("does not start a verification when the requested email is already current", async () => {
  reset();
  const response = await run("ACTUAL@example.test");
  assert.equal(response.status, 303);
  assert.match(response.headers.get("location"), /mi-perfil\\?correo=igual$/);
  assert.equal(state.updateArgs, null);
});

test("returns a generic failure when Auth cannot start the verification", async () => {
  reset();
  state.authError = { message: "sensitive provider detail" };
  assert.equal((await run("nuevo@example.test")).status, 503);
});
