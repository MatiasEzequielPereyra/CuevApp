import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const state = {
  enabled: true,
  signupCalls: [],
  signupError: null,
  signupSession: null,
  userClientCalls: 0,
};
const origin = "https://cueva.example";
const config = () => ({
  origin, url: "https://auth.example.supabase.co", key: "publishable-fixture",
  local: false, ownerOnly: false, selfRegistrationEnabled: state.enabled,
});
const supabase = {
  auth: { signUp: async payload => {
    state.signupCalls.push(payload);
    return { data: { user: { id: "fixture" }, session: state.signupSession }, error: state.signupError };
  } },
};
const next = {
  NextResponse: { redirect: (url, init) => new Response(null, {
    status: init?.status ?? 307,
    headers: { location: String(url), ...(init?.headers ?? {}) },
  }) },
};
function load(path) {
  const { outputText } = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const loaded = { exports: {} };
  const runtimeRequire = name => {
    if (name === "next/server") return next;
    if (name === "@supabase/supabase-js") return { createClient: () => supabase };
    if (name === "@/lib/student-invitation/server") return { inviteStudent: () => { throw Error("No admin invitation allowed"); } };
    if (name === "@/lib/product-auth/server") return {
      productConfig: config, localFetch: () => { throw Error("No local fetch needed"); },
      userClient: () => { state.userClientCalls++; throw Error("Signup must be anonymous"); },
      pendingUserClient: () => { throw Error("No invited sessions"); },
      serviceClient: () => { throw Error("No service role for public signup"); },
    };
    return require(name);
  };
  new Function("require", "module", "exports", outputText)(runtimeRequire, loaded, loaded.exports);
  return loaded.exports;
}
const { POST } = load("src/app/api/acceso/[operation]/route.ts");
function reset() {
  state.enabled = true;
  state.signupCalls.length = 0;
  state.signupError = null;
  state.signupSession = null;
  state.userClientCalls = 0;
}
const fields = {
  first_name: "Ana", last_name: "Pérez", email: "Ana@Example.Test",
  password: "Strong-Pass-123", confirm_password: "Strong-Pass-123",
};
async function send(values = fields, overrideOrigin = origin) {
  const req = new Request(origin + "/api/acceso/registrarse", {
    method: "POST",
    headers: { origin: overrideOrigin, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(values),
  });
  return POST(req, { params: Promise.resolve({ operation: "registrarse" }) });
}

test("disabled registration is unavailable without creating an account", async () => {
  reset(); state.enabled = false;
  assert.equal((await send()).status, 404);
  assert.equal(state.signupCalls.length, 0);
});
test("origin restriction applies before signup", async () => {
  reset();
  assert.equal((await send(fields, "https://external.example")).status, 403);
  assert.equal(state.signupCalls.length, 0);
});
test("invalid names, email, password and mismatches never reach Auth", async () => {
  reset();
  for (const input of [
    { ...fields, first_name: "" },
    { ...fields, last_name: "x".repeat(81) },
    { ...fields, email: "invalid" },
    { ...fields, password: "weak", confirm_password: "weak" },
    { ...fields, confirm_password: "different-strong-password" },
  ]) assert.equal((await send(input)).status, 400);
  assert.equal(state.signupCalls.length, 0);
});
test("user signs up with only publishable Auth and automatic email confirmation", async () => {
  reset();
  const result = await send(fields);
  assert.equal(result.status, 303);
  assert.equal(result.headers.get("location"), origin + "/registrarse?estado=enviado");
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.equal(state.userClientCalls, 0);
  assert.deepEqual(state.signupCalls, [{
    email: "ana@example.test", password: fields.password,
    options: {
      emailRedirectTo: origin + "/confirmar-registro",
      data: { first_name: "Ana", last_name: "Pérez", full_name: "Ana Pérez" },
    },
  }]);
});
test("existing emails are not exposed by the public response", async () => {
  reset();
  state.signupError = { code: "user_already_exists", message: "already exists" };
  const response = await send();
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), origin + "/registrarse?estado=enviado");
});
test("provider failures and auto-confirm configuration fail closed", async () => {
  reset(); state.signupError = { code: "email_provider_error", message: "secret provider failure" };
  assert.equal((await send()).status, 503);
  reset(); state.signupSession = { access_token: "unexpected-auto-confirm" };
  assert.equal((await send()).status, 503);
});
