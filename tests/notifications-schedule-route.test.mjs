import assert from "node:assert/strict";
import test from "node:test";
import { createNotificationScheduleHandlers } from "../src/lib/notifications/schedule-route-handlers.ts";

const origin = "https://cueva.example";

function makeHarness(options = {}) {
  const state = {
    admin: options.admin !== false,
    updated: null,
    updateResult: options.updateResult ?? "13:45:00",
    authCalls: 0,
  };
  const handlers = createNotificationScheduleHandlers({
    sameOrigin: request => request.headers.get("origin") === origin,
    requireAdmin: async () => {
      state.authCalls += 1;
      return state.admin;
    },
    updateSchedule: async value => {
      state.updated = value;
      return state.updateResult;
    },
  });
  return { handlers, state };
}

function request(body, requestOrigin = origin) {
  return new Request(origin + "/api/notifications/settings", {
    method: "PATCH",
    headers: { origin: requestOrigin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("rechaza orígenes externos antes de consultar la sesión", async () => {
  const { handlers, state } = makeHarness();
  assert.equal((await handlers.PATCH(request({ sendTime: "13:45" }, "https://attacker.example"))).status, 403);
  assert.equal(state.authCalls, 0);
});

test("valida el horario en formato HH:mm y rechaza valores fuera de rango", async () => {
  const { handlers, state } = makeHarness();
  assert.equal((await handlers.PATCH(request({ sendTime: "25:00" }))).status, 400);
  assert.equal((await handlers.PATCH(request({ sendTime: "9:30" }))).status, 400);
  assert.equal(state.authCalls, 0);
});

test("solo permite cambios a administradores autenticados", async () => {
  const { handlers, state } = makeHarness({ admin: false });
  assert.equal((await handlers.PATCH(request({ sendTime: "13:45" }))).status, 403);
  assert.equal(state.updated, null);
});

test("persiste el horario mediante la operación autorizada y normaliza la respuesta", async () => {
  const { handlers, state } = makeHarness();
  const response = await handlers.PATCH(request({ sendTime: "13:45" }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { sendTime: "13:45" });
  assert.equal(state.updated, "13:45");
});

test("devuelve un error genérico si falla la operación de base de datos", async () => {
  const { handlers } = makeHarness({ updateResult: null });
  const response = await handlers.PATCH(request({ sendTime: "13:45" }));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { message: "No pudimos actualizar el horario." });
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});
