import assert from "node:assert/strict";
import test from "node:test";
import { createNotificationInboxHandlers } from "../src/lib/notifications/inbox-route-handlers.ts";

const origin = "https://cueva.example";
const notificationId = "be000000-0000-4000-8000-000000000001";

function makeHarness(options = {}) {
  const state = {
    student: options.student === false ? null : { userId: "user-own" },
    marked: null,
    markResult: options.markResult ?? "updated",
    authCalls: 0,
  };
  const handlers = createNotificationInboxHandlers({
    sameOrigin: request => request.headers.get("origin") === origin,
    requireStudent: async () => {
      state.authCalls += 1;
      return state.student;
    },
    markRead: async (student, id) => {
      state.marked = { userId: student.userId, id };
      return state.markResult;
    },
  });
  return { handlers, state };
}

function request(body, requestOrigin = origin) {
  return new Request(origin + "/api/notifications/inbox", {
    method: "PATCH",
    headers: { origin: requestOrigin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("rechaza un origen externo antes de consultar la sesión", async () => {
  const { handlers, state } = makeHarness();
  const response = await handlers.PATCH(request({ id: notificationId }, "https://attacker.example"));
  assert.equal(response.status, 403);
  assert.equal(state.authCalls, 0);
});

test("rechaza identificadores inválidos", async () => {
  const { handlers, state } = makeHarness();
  assert.equal((await handlers.PATCH(request({ id: "not-a-uuid" }))).status, 400);
  assert.equal(state.authCalls, 0);
});

test("requiere un alumno autenticado", async () => {
  const { handlers, state } = makeHarness({ student: false });
  assert.equal((await handlers.PATCH(request({ id: notificationId }))).status, 403);
  assert.equal(state.marked, null);
});

test("marca como leído el identificador solicitado dentro del contexto autenticado", async () => {
  const { handlers, state } = makeHarness();
  const response = await handlers.PATCH(request({ id: notificationId }));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.read, true);
  assert.equal(typeof result.readAt, "string");
  assert.deepEqual(state.marked, { userId: "user-own", id: notificationId });
});

test("no revela avisos ajenos o inexistentes", async () => {
  const { handlers } = makeHarness({ markResult: "not_found" });
  assert.equal((await handlers.PATCH(request({ id: notificationId }))).status, 404);
});

test("mantiene los errores de base de datos como respuesta genérica", async () => {
  const { handlers } = makeHarness({ markResult: "error" });
  const response = await handlers.PATCH(request({ id: notificationId }));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { message: "No pudimos actualizar el aviso." });
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});
