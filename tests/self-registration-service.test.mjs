import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

let calls = 0, serviceResult = { data: "created", error: null };
const { outputText } = ts.transpileModule(readFileSync("src/lib/product-auth/self-registration.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const mod = { exports: {} };
new Function("require", "module", "exports", outputText)(name => {
  if (name === "server-only") return {};
  if (name === "@/lib/product-auth/server") return {
    serviceClient: () => ({
      rpc: async (operation, args) => {
        calls++;
        assert.equal(operation, "cueva_complete_self_registration");
        assert.deepEqual(args, {
          p_user: "a1000000-0000-4000-8000-000000000001",
          p_session: "b1000000-0000-4000-8000-000000000001",
        });
        return serviceResult;
      },
    }),
  };
  throw Error("unexpected dependency " + name);
}, mod, mod.exports);
const { completeSelfRegistration } = mod.exports;
const user = { id: "a1000000-0000-4000-8000-000000000001", email_confirmed_at: "2026-11-20" };
const sid = "b1000000-0000-4000-8000-000000000001";
function jwt(payload) {
  return "header." + Buffer.from(JSON.stringify(payload)).toString("base64url") + ".signature";
}
function client({ sub = user.id, session = sid, confirmed = true, token = true, wrongUser = false } = {}) {
  return { auth: {
    getSession: async () => ({ data: {
      session: token ? { access_token: jwt({ sub, session_id: session }) } : null,
    }, error: null }),
    getUser: async () => ({ data: { user: confirmed
      ? (wrongUser ? { ...user, id: "another-account" } : user)
      : { ...user, email_confirmed_at: null } }, error: null }),
  } };
}
test("no session, wrong identity, no confirmation or wrong SID cannot reach service key", async () => {
  calls = 0;
  assert.equal(await completeSelfRegistration(client({ token: false }), user.id), "unauthenticated");
  assert.equal(await completeSelfRegistration(client({ sub: "another-account" }), user.id), "unauthenticated");
  assert.equal(await completeSelfRegistration(client({ wrongUser: true }), user.id), "unverified");
  assert.equal(await completeSelfRegistration(client({ confirmed: false }), user.id), "unverified");
  assert.equal(await completeSelfRegistration(client({ session: "invalid" }), user.id), "unauthenticated");
  assert.equal(calls, 0);
});
test("only the Auth-verified user and session reach service_role", async () => {
  calls = 0; serviceResult = { data: "created", error: null };
  assert.equal(await completeSelfRegistration(client(), user.id), "created");
  assert.equal(calls, 1);
});
test("service errors never report successful account creation", async () => {
  calls = 0; serviceResult = { data: null, error: { message: "protected" } };
  assert.equal(await completeSelfRegistration(client(), user.id), "error");
  assert.equal(calls, 1);
});
