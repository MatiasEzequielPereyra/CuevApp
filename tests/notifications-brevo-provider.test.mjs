import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBrevoEmailPayload,
  createBrevoEmailProvider,
} from "../src/lib/notifications/brevo-email-provider.ts";

const context = overrides => ({
  notificationId: "notification-1",
  studentId: "student-1",
  studentName: '<Alumno "Demo">',
  destinationEmail: "student@example.test",
  studentUserId: "user-1",
  periodMonth: "2026-11-01",
  dueOn: "2026-11-20",
  balanceCents: "75000",
  reminderDays: 5,
  ...overrides,
});

const configuration = overrides => ({
  apiKey: "test-api-key",
  senderEmail: "avisos@example.test",
  senderName: "CUEVA",
  ...overrides,
});

test("arma un correo transaccional y escapa el nombre en HTML", () => {
  const payload = buildBrevoEmailPayload(context(), {
    email: "avisos@example.test",
    name: "CUEVA",
  });

  assert.equal(payload.to[0].email, "student@example.test");
  assert.match(payload.subject, /noviembre de 2026/i);
  assert.match(payload.textContent, /750,00/);
  assert.match(payload.htmlContent, /&lt;Alumno &quot;Demo&quot;&gt;/);
  assert.doesNotMatch(payload.htmlContent, /<Alumno/);
});

test("envía mediante el endpoint transaccional de Brevo y conserva su referencia", async () => {
  let request;
  const provider = createBrevoEmailProvider(configuration({
    fetchImpl: async (url, init) => {
      request = { url, init };
      return Response.json({ messageId: "<message-123>" }, { status: 201 });
    },
  }));

  const result = await provider(context());

  assert.deepEqual(result, { outcome: "sent", providerReference: "brevo:<message-123>" });
  assert.equal(request.url, "https://api.brevo.com/v3/smtp/email");
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.headers["api-key"], "test-api-key");
  assert.equal(request.init.cache, "no-store");
  const body = JSON.parse(request.init.body);
  assert.equal(body.sender.email, "avisos@example.test");
  assert.equal(body.to[0].email, "student@example.test");
});

test("no realiza llamadas si falta el destinatario o la configuración", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return Response.json({ messageId: "unused" });
  };
  const missingDestination = createBrevoEmailProvider(configuration({ fetchImpl }));
  const missingConfiguration = createBrevoEmailProvider(configuration({ apiKey: "", fetchImpl }));

  assert.deepEqual(await missingDestination(context({ destinationEmail: null })), {
    outcome: "skipped", errorCode: "missing_destination",
  });
  assert.deepEqual(await missingConfiguration(context()), {
    outcome: "failed", errorCode: "brevo_unavailable",
  });
  assert.equal(calls, 0);
});

test("clasifica rechazos definitivos y fallos reintentables sin filtrar respuesta", async () => {
  const rejected = createBrevoEmailProvider(configuration({
    fetchImpl: async () => new Response("private provider detail", { status: 400 }),
  }));
  const throttled = createBrevoEmailProvider(configuration({
    fetchImpl: async () => new Response("private provider detail", { status: 429 }),
  }));
  const unavailable = createBrevoEmailProvider(configuration({
    fetchImpl: async () => new Response("private provider detail", { status: 503 }),
  }));
  const networkFailure = createBrevoEmailProvider(configuration({
    fetchImpl: async () => { throw new Error("private network detail"); },
  }));

  assert.deepEqual(await rejected(context()), { outcome: "failed", errorCode: "brevo_rejected" });
  assert.deepEqual(await throttled(context()), { outcome: "failed", errorCode: "brevo_unavailable" });
  assert.deepEqual(await unavailable(context()), { outcome: "failed", errorCode: "brevo_unavailable" });
  assert.deepEqual(await networkFailure(context()), { outcome: "failed", errorCode: "brevo_unavailable" });
});

test("una respuesta exitosa sin JSON utilizable no invalida el envío", async () => {
  const provider = createBrevoEmailProvider(configuration({
    fetchImpl: async () => new Response("accepted", { status: 202 }),
  }));

  assert.deepEqual(await provider(context()), { outcome: "sent" });
});
