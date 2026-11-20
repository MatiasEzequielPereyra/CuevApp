import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const state = { enabled: true, otpCalls: 0, signupVerified: true, enrollment: "created", rpcCalls: 0 };
const origin = "https://cueva.example";
const auth = {
  auth: { verifyOtp: async payload => {
    state.otpCalls++;
    assert.equal(payload.type, "signup");
    return {
      data: {
        session: state.signupVerified ? { access_token: "fixture" } : null,
        user: state.signupVerified ? { id: "fixture", email_confirmed_at: "2026-11-20" } : null,
      }, error: state.signupVerified ? null : { message: "bad token" },
    };
  } },
  rpc: async name => {
    state.rpcCalls++;
    assert.equal(name, "cueva_complete_self_registration");
    return { data: state.enrollment, error: null };
  },
};
const { outputText } = ts.transpileModule(readFileSync("src/app/confirmar-registro/route.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const mod = { exports: {} };
new Function("require", "module", "exports", outputText)(name => {
  if (name === "next/server") return {
    NextResponse: { redirect: (url, init) => new Response(null, {
      status: init.status, headers: { location: String(url), ...init.headers },
    }) },
  };
  if (name === "@/lib/product-auth/server") return {
    productConfig: () => ({
      origin, selfRegistrationEnabled: state.enabled, ownerOnly: false,
    }),
    userClient: async () => auth,
  };
  throw Error("Unexpected dependency " + name);
}, mod, mod.exports);
const { GET } = mod.exports;
function reset() {
  state.enabled = true; state.otpCalls = 0; state.signupVerified = true;
  state.enrollment = "created"; state.rpcCalls = 0;
}
const link = origin + "/confirmar-registro?type=signup&token_hash=" + "a".repeat(64);
test("invalid or missing token never invokes Supabase Auth", async () => {
  reset();
  const result = await GET(new Request(origin + "/confirmar-registro?type=signup"));
  assert.equal(result.status, 303);
  assert.equal(result.headers.get("location"), origin + "/registrarse?estado=enlace-invalido");
  assert.equal(state.otpCalls, 0);
});
test("feature disabled rejects callback", async () => {
  reset(); state.enabled = false;
  assert.equal((await GET(new Request(link))).status, 404);
  assert.equal(state.otpCalls, 0);
});
test("confirmed signup creates only the user's new student association", async () => {
  reset();
  const response = await GET(new Request(link));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), origin + "/cuenta");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(state.otpCalls, 1);
  assert.equal(state.rpcCalls, 1);
});
test("invalid verification cannot call the enrollment RPC", async () => {
  reset(); state.signupVerified = false;
  const response = await GET(new Request(link));
  assert.equal(response.headers.get("location"), origin + "/registrarse?estado=enlace-invalido");
  assert.equal(state.rpcCalls, 0);
});
test("existing student collision never opens a profile", async () => {
  reset(); state.enrollment = "needs_review";
  const response = await GET(new Request(link));
  assert.equal(response.headers.get("location"), origin + "/registro-pendiente");
  assert.equal(state.rpcCalls, 1);
});
