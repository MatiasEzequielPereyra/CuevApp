import assert from "node:assert/strict";
import test from "node:test";
import { createECDH } from "node:crypto";
import { createPushRouteHandlers } from "../src/lib/notifications/push-route-handlers.ts";

const origin = "https://cueva.example";
const keyPair = createECDH("prime256v1");
keyPair.generateKeys();
const subscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/http-test-device",
  expirationTime: null,
  keys: {
    p256dh: keyPair.getPublicKey().toString("base64url"),
    auth: Buffer.alloc(16, 7).toString("base64url"),
  },
};

function makeHarness(options = {}) {
  const state = {
    student: options.authenticated === false ? null : { studentId: "student-own", auth: {}, db: {} },
    preference: options.pushEnabled ?? false,
    registeredFor: null,
    removedFor: null,
    registerOutcome: options.registerOutcome ?? "registered",
    removeOutcome: options.removeOutcome ?? "removed",
    updateFails: false,
    registerCalls: 0,
  };
  const handlers = createPushRouteHandlers({
    sameOrigin: request => request.headers.get("origin") === origin,
    requireStudent: async () => state.student,
    readPreference: async () => ({ pushEnabled: state.preference }),
    updatePreference: async (student, enabled) => {
      if (state.updateFails) return false;
      state.preference = enabled;
      return true;
    },
    registerSubscription: async (student, parsed) => {
      state.registerCalls += 1;
      state.registeredFor = { studentId: student.studentId, endpoint: parsed.endpoint };
      return state.registerOutcome;
    },
    removeSubscription: async (student, endpoint) => {
      state.removedFor = { studentId: student.studentId, endpoint };
      return state.removeOutcome;
    },
    isAvailable: () => true,
    publicKey: () => "public-vapid-key",
  });
  return { handlers, state };
}

function request(method, body, requestOrigin = origin) {
  return new Request(`${origin}/api/notifications/push`, {
    method,
    headers: {
      origin: requestOrigin,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function json(response) {
  return { status: response.status, body: await response.json() };
}

test("GET rejects unauthenticated users and never exposes a public key to them", async () => {
  const { handlers } = makeHarness({ authenticated: false });
  const response = await handlers.GET();
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("GET returns the caller preference and only publishes a configured VAPID public key", async () => {
  const { handlers } = makeHarness({ pushEnabled: false });
  const response = await handlers.GET();
  assert.deepEqual(await response.json(), {
    pushEnabled: false,
    available: true,
    publicKey: "public-vapid-key",
  });
});

test("PUT rejects a foreign Origin before authentication or preference changes", async () => {
  const { handlers, state } = makeHarness();
  const response = await handlers.PUT(request("PUT", { enabled: true }, "https://attacker.example"));
  assert.equal(response.status, 403);
  assert.equal(state.preference, false);
});

test("PUT rejects malformed preference bodies and requires an authenticated alumno", async () => {
  const malformed = makeHarness();
  assert.equal((await malformed.handlers.PUT(request("PUT", { enabled: "true" }))).status, 400);
  const unauthenticated = makeHarness({ authenticated: false });
  assert.equal((await unauthenticated.handlers.PUT(request("PUT", { enabled: true }))).status, 403);
});

test("PUT allows the alumno to disable and re-enable push", async () => {
  const { handlers, state } = makeHarness({ pushEnabled: true });
  assert.deepEqual(await json(await handlers.PUT(request("PUT", { enabled: false }))), {
    status: 200, body: { pushEnabled: false },
  });
  assert.equal(state.preference, false);
  assert.deepEqual(await json(await handlers.PUT(request("PUT", { enabled: true }))), {
    status: 200, body: { pushEnabled: true },
  });
  assert.equal(state.preference, true);
});

test("POST rejects foreign Origin, unauthenticated users, and malformed subscriptions", async () => {
  const foreign = makeHarness();
  assert.equal((await foreign.handlers.POST(request("POST", subscription, "https://attacker.example"))).status, 403);
  assert.equal(foreign.state.registerCalls, 0);

  const unauthenticated = makeHarness({ authenticated: false });
  assert.equal((await unauthenticated.handlers.POST(request("POST", subscription))).status, 403);

  const malformed = makeHarness();
  assert.equal((await malformed.handlers.POST(request("POST", { ...subscription, endpoint: "https://attacker.example/push" }))).status, 400);
  assert.equal(malformed.state.registerCalls, 0);
});

test("POST binds registration to the authenticated alumno, ignores a spoofed student id, and enables push", async () => {
  const { handlers, state } = makeHarness({ pushEnabled: false });
  const response = await handlers.POST(request("POST", { ...subscription, studentId: "student-victim" }));
  assert.deepEqual(await response.json(), { registered: true });
  assert.equal(response.status, 200);
  assert.equal(state.registeredFor.studentId, "student-own");
  assert.equal(state.preference, true);
});

test("POST reports the atomic device cap and cross-account endpoint conflicts without enabling push", async () => {
  const limit = makeHarness({ registerOutcome: "limit_reached" });
  assert.equal((await limit.handlers.POST(request("POST", subscription))).status, 409);
  assert.equal(limit.state.preference, false);

  const conflict = makeHarness({ registerOutcome: "endpoint_in_use" });
  assert.equal((await conflict.handlers.POST(request("POST", subscription))).status, 409);
  assert.equal(conflict.state.preference, false);
});

test("POST returns a controlled error if registration or preference activation fails", async () => {
  const failedRegistration = makeHarness({ registerOutcome: "error" });
  assert.equal((await failedRegistration.handlers.POST(request("POST", subscription))).status, 503);

  const failedPreference = makeHarness();
  failedPreference.state.updateFails = true;
  const response = await failedPreference.handlers.POST(request("POST", subscription));
  assert.equal(response.status, 503);
  assert.equal(failedPreference.state.registerCalls, 1);
});

test("DELETE is scoped to the authenticated alumno and treats another account's endpoint as absent", async () => {
  const { handlers, state } = makeHarness();
  const response = await handlers.DELETE(request("DELETE", { endpoint: subscription.endpoint }));
  assert.deepEqual(await response.json(), { removed: true });
  assert.equal(state.removedFor.studentId, "student-own");
  assert.equal(state.removedFor.endpoint, subscription.endpoint);
});

test("DELETE rejects foreign Origin, unauthenticated users, and invalid endpoints", async () => {
  const foreign = makeHarness();
  assert.equal((await foreign.handlers.DELETE(request("DELETE", { endpoint: subscription.endpoint }, "https://attacker.example"))).status, 403);
  const unauthenticated = makeHarness({ authenticated: false });
  assert.equal((await unauthenticated.handlers.DELETE(request("DELETE", { endpoint: subscription.endpoint }))).status, 403);
  const invalid = makeHarness();
  assert.equal((await invalid.handlers.DELETE(request("DELETE", { endpoint: "https://attacker.example/push" }))).status, 400);
});

test("all responses are non-cacheable and provider/database failures remain generic", async () => {
  const { handlers } = makeHarness({ removeOutcome: "error" });
  const response = await handlers.DELETE(request("DELETE", { endpoint: subscription.endpoint }));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await response.json(), { message: "No pudimos desvincular el dispositivo." });
});
