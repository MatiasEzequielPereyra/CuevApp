import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const origin = "https://cueva.example";
const id = "synthetic-user";
const token = "a".repeat(64);
const state = {};
function reset() {
  Object.assign(state, { calls: [], sendError: null, otpError: null, role: "alumno", confirmed: true,
    updateError: null, currentId: id, changedId: id, ownerOnly: false, profileError: null });
}
const auth = {
  auth: {
    verifyOtp: async args => {
      state.calls.push(["verify", args]);
      return { data: { user: { id, email_confirmed_at: state.confirmed ? "2026-11-26" : null }, session: state.otpError ? null : {} }, error: state.otpError };
    },
    getUser: async () => ({ data: { user: { id: state.currentId } }, error: null }),
    updateUser: async args => {
      state.calls.push(["update", args]);
      return { data: { user: { id: state.changedId } }, error: state.updateError };
    },
    signOut: async args => { state.calls.push(["signOut", args]); return { error: null }; },
  },
  from: table => {
    assert.equal(table, "cueva_profiles");
    return { select: columns => {
      assert.equal(columns, "role");
      return { eq: (key, value) => {
        assert.equal(key, "user_id"); assert.equal(value, id);
        return { maybeSingle: async () => ({ data: state.role ? { role: state.role } : null, error: state.profileError }) };
      } };
    } };
  },
};
const output = ts.transpileModule(fs.readFileSync("src/app/api/acceso/[operation]/route.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function("require", "module", "exports", output)(name => {
  if (name === "@supabase/supabase-js") return { createClient: (_url, key, options) => {
    assert.equal(key, "publishable-only");
    assert.equal(options.auth.persistSession, false);
    return { auth: { resetPasswordForEmail: async (...args) => {
      state.calls.push(["send", ...args]);
      if (state.sendError === "throw") throw Error("synthetic provider failure");
      return { error: state.sendError };
    } } };
  } };
  if (name === "@/lib/product-auth/server") return {
    productConfig: () => ({ origin, url: "https://provider.example.test", key: "publishable-only", ownerOnly: state.ownerOnly }),
    pendingUserClient: async () => ({ auth, commit: () => assert.fail("Recovery sessions must never become SSR cookies") }),
    userClient: () => assert.fail("Do not use the browser's existing session"),
    serviceClient: () => assert.fail("No privileged client or gate mutations in public recovery"),
  };
  if (name === "@/lib/student-invitation/server") return {};
  return require(name);
}, mod, mod.exports);
function run(operation, fields, headers = {}) {
  return mod.exports.POST(new Request(`${origin}/api/acceso/${operation}`, {
    method: "POST", headers: { origin, ...headers }, body: new URLSearchParams(fields),
  }), { params: Promise.resolve({ operation }) });
}
const valid = { token_hash: token, password: "Synthetic-next-123", confirm_password: "Synthetic-next-123" };

test("known, unknown, rate-limited and SMTP-rejected requests have the same acknowledgement", async () => {
  for (const error of [null, { code: "user_not_found" }, { status: 429 }, { status: 500 }, "throw"]) {
    reset(); state.sendError = error;
    const response = await run("recuperar", { email: " Persona@Example.test ", next: "https://evil.example" });
    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(state.calls, [["send", "persona@example.test", { redirectTo: origin + "/recuperar-contrasena" }]]);
  }
});
test("origin, content type, body limit, email and owner-only mode are enforced before Auth", async () => {
  reset();
  assert.equal((await run("recuperar", { email: "bad" })).status, 400);
  assert.equal((await run("recuperar", { email: "a@example.test" }, { origin: "https://evil.example" })).status, 403);
  assert.equal((await run("recuperar", {}, { "content-type": "application/json" })).status, 415);
  assert.equal((await run("recuperar", { email: "a".repeat(9000) })).status, 413);
  state.ownerOnly = true;
  assert.equal((await run("recuperar", { email: "a@example.test" })).status, 404);
  assert.deepEqual(state.calls, []);
});
test("password validation happens before consuming the one-use token", async () => {
  reset();
  for (const fields of [{ ...valid, token_hash: "bad" }, { ...valid, password: "short" }, { ...valid, confirm_password: "different" }, { ...valid, password: "a".repeat(1025) }]) {
    assert.equal((await run("restablecer", fields)).status, 400);
  }
  assert.deepEqual(state.calls, []);
});
test("expired, invalid and replayed Auth tokens cannot update a password", async () => {
  for (const code of ["otp_expired", "invalid_token", "already_used"]) {
    reset(); state.otpError = { code };
    const response = await run("restablecer", valid);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "enlace" });
    assert.deepEqual(state.calls, [["verify", { token_hash: token, type: "recovery" }]]);
  }
});
test("enabled students and admins update only the verified identity; no cookies or privileged writes", async () => {
  for (const role of ["alumno", "admin"]) {
    reset(); state.role = role;
    const response = await run("restablecer", { ...valid, user_id: "another-user", role: "admin", redirectTo: "https://evil.example" });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.deepEqual(state.calls, [["verify", { token_hash: token, type: "recovery" }], ["update", { password: valid.password }], ["signOut", { scope: "local" }]]);
    assert.equal(response.headers.get("set-cookie"), null);
  }
});
test("pending/locked accounts and missing roles stay gated", async () => {
  for (const role of [null, "unexpected"]) {
    reset(); state.role = role;
    assert.equal((await run("restablecer", valid)).status, 403);
    assert.equal(state.calls.some(([name]) => name === "update"), false);
    assert.equal(state.calls.at(-1)[0], "signOut");
  }
});
test("unconfirmed identity or a different authenticated subject cannot update", async () => {
  reset(); state.confirmed = false;
  assert.equal((await run("restablecer", valid)).status, 400);
  reset(); state.currentId = "different";
  assert.equal((await run("restablecer", valid)).status, 400);
  assert.equal(state.calls.some(([name]) => name === "update"), false);
});
test("provider rejection or wrong mutation acknowledgement cannot report success", async () => {
  for (const wrongId of [false, true]) {
    reset();
    if (wrongId) state.changedId = "another-user";
    else state.updateError = { code: "weak_password" };
    const response = await run("restablecer", valid);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "actualizacion" });
    assert.equal(state.calls.at(-1)[0], "signOut");
  }
});
