import test from "node:test";
import assert from "node:assert/strict";
import { createECDH, generateKeyPairSync, hkdfSync, createDecipheriv, randomBytes } from "node:crypto";
import { encryptWebPushPayload, createWebPushProvider, isWebPushConfigurationAvailable } from "../src/lib/notifications/web-push-provider.ts";

function subscriptionKeys() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    ecdh,
    p256dh: ecdh.getPublicKey().toString("base64url"),
    auth_secret: randomBytes(16).toString("base64url"),
  };
}


function decryptWebPushPayload(encryptedValue, subscription) {
  const encrypted = Buffer.from(encryptedValue);
  const salt = encrypted.subarray(0, 16);
  const keyLength = encrypted[20];
  const serverPublicKey = encrypted.subarray(21, 21 + keyLength);
  const ciphertext = encrypted.subarray(21 + keyLength, -16);
  const tag = encrypted.subarray(-16);
  const sharedSecret = subscription.ecdh.computeSecret(serverPublicKey);
  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0"),
    Buffer.from(subscription.p256dh, "base64url"),
    serverPublicKey,
  ]);
  const ikm = Buffer.from(hkdfSync("sha256", sharedSecret, Buffer.from(subscription.auth_secret, "base64url"), keyInfo, 32));
  const cek = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const decipher = createDecipheriv("aes-128-gcm", cek, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).subarray(0, -1).toString("utf8");
}

function vapidKeys() {
  const pair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = pair.privateKey.export({ format: "jwk" });
  return {
    publicKey: Buffer.concat([
      Buffer.from([4]),
      Buffer.from(jwk.x, "base64url"),
      Buffer.from(jwk.y, "base64url"),
    ]).toString("base64url"),
    privateKey: Buffer.from(jwk.d, "base64url").toString("base64url"),
  };
}

test("cifra el payload Web Push con el formato aes128gcm y permite descifrarlo", () => {
  const keys = subscriptionKeys();
  const payload = Buffer.from(JSON.stringify({ title: "Aviso CUEVA" }));
  const encrypted = encryptWebPushPayload(payload, keys);

  const salt = encrypted.subarray(0, 16);
  const recordSize = encrypted.readUInt32BE(16);
  const keyLength = encrypted[20];
  const serverPublicKey = encrypted.subarray(21, 21 + keyLength);
  const ciphertext = encrypted.subarray(21 + keyLength, -16);
  const tag = encrypted.subarray(-16);
  const sharedSecret = keys.ecdh.computeSecret(serverPublicKey);
  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0"),
    Buffer.from(keys.p256dh, "base64url"),
    serverPublicKey,
  ]);
  const ikm = Buffer.from(hkdfSync("sha256", sharedSecret, Buffer.from(keys.auth_secret, "base64url"), keyInfo, 32));
  const cek = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const decipher = createDecipheriv("aes-128-gcm", cek, nonce);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  assert.equal(recordSize, 4096);
  assert.deepEqual(plaintext, Buffer.concat([payload, Buffer.from([2])]));
});

test("entrega por dispositivo: conserva éxito y expiración de forma independiente", async () => {
  const keys = subscriptionKeys();
  const vapid = vapidKeys();
  const rows = [
    { id: "sub-1", endpoint: "https://push.example.test/one", ...keys, expires_at: null },
    { id: "sub-2", endpoint: "https://push.example.test/two", ...subscriptionKeys(), expires_at: null },
  ];
  const calls = [];
  const rpcCalls = [];
  const db = {
    from(table) {
      assert.equal(table, "cueva_push_subscriptions");
      return {
        select() { return this; },
        eq() { return this; },
        is() { return this; },
        then(resolve) { resolve({ data: rows, error: null }); },
      };
    },
    async rpc(name, args) {
      rpcCalls.push({ name, args });
      if (name === "cueva_claim_notification_push_delivery") {
        return { data: [{
          claimed: true,
          push_delivery_id: `delivery-${args.p_subscription_id}`,
          push_lease_token: `lease-${args.p_subscription_id}`,
          attempt_number: 1,
          delivery_status: "processing",
        }], error: null };
      }
      if (name === "cueva_mark_notification_push_started_with_balance") return { data: [{ started: true, balance_cents: "10000" }], error: null };
      if (name === "cueva_finalize_notification_push_delivery") {
        const status = args.p_outcome === "sent" ? "sent" : "expired";
        return { data: [{ finalized: true, delivery_status: status, attempt_number: 1 }], error: null };
      }
      throw new Error(`Unexpected RPC: ${name}`);
    },
  };
  const provider = createWebPushProvider(db, {
    ...vapid,
    subject: "mailto:admin@example.test",
    now: () => 1794355200000,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(null, { status: url.endsWith("/one") ? 201 : 410 });
    },
  });

  const result = await provider({
    notificationId: "notification-1",
    deliveryId: "parent-delivery",
    deliveryLeaseToken: "parent-lease",
    studentId: "student-1",
    studentName: "Alumno",
    destinationEmail: null,
    studentUserId: "user-1",
    periodMonth: "2026-11-01",
    dueOn: "2026-11-20",
    balanceCents: "75000",
    reminderDays: 5,
  });

  assert.deepEqual(result, {
    outcome: "sent",
    providerReference: "webpush:sent=1;unknown=0;expired=1",
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].init.headers["Content-Encoding"], "aes128gcm");
  assert.match(calls[0].init.headers.Authorization, /^vapid t=/);
  assert.equal(rpcCalls.filter(call => call.name === "cueva_claim_notification_push_delivery").length, 2);
  assert.equal(rpcCalls.filter(call => call.name === "cueva_mark_notification_push_started_with_balance").length, 2);
  assert.equal(rpcCalls.filter(call => call.name === "cueva_finalize_notification_push_delivery").length, 2);
  assert.deepEqual(
    rpcCalls.filter(call => call.name === "cueva_finalize_notification_push_delivery").map(call => call.args.p_outcome).sort(),
    ["expired", "sent"],
  );
});
 
test("un reintento selectivo no vuelve a enviar al dispositivo que ya aceptó", async () => {
  const vapid = vapidKeys();
  const rows = [
    { id: "sub-sent", endpoint: "https://push.example.test/sent", ...subscriptionKeys(), expires_at: null },
    { id: "sub-retry", endpoint: "https://push.example.test/retry", ...subscriptionKeys(), expires_at: null },
  ];
  const state = new Map(rows.map(row => [row.id, { status: "pending", attempt: 0 }]));
  const fetches = [];
  const db = {
    from() {
      return { select() { return this; }, eq() { return this; }, is() { return this; }, then(resolve) { resolve({ data: rows, error: null }); } };
    },
    async rpc(name, args) {
      if (name === "cueva_claim_notification_push_delivery") {
        const target = state.get(args.p_subscription_id);
        if (target.status !== "pending") return { data: [{
          claimed: false, push_delivery_id: `delivery-${args.p_subscription_id}`,
          push_lease_token: null, attempt_number: target.attempt, delivery_status: target.status,
        }], error: null };
        target.attempt += 1;
        target.status = "processing";
        return { data: [{
          claimed: true, push_delivery_id: `delivery-${args.p_subscription_id}`,
          push_lease_token: `lease-${args.p_subscription_id}-${target.attempt}`,
          attempt_number: target.attempt, delivery_status: "processing",
        }], error: null };
      }
      if (name === "cueva_mark_notification_push_started_with_balance") return { data: [{ started: true, balance_cents: "10000" }], error: null };
      if (name === "cueva_finalize_notification_push_delivery") {
        const id = args.p_push_delivery_id === "delivery-sub-sent" ? "sub-sent" : "sub-retry";
        const target = state.get(id);
        target.status = args.p_outcome === "sent" ? "sent" : "pending";
        return { data: [{
          finalized: true, delivery_status: target.status, attempt_number: target.attempt,
        }], error: null };
      }
      throw new Error(`Unexpected RPC: ${name}`);
    },
  };
  const provider = createWebPushProvider(db, {
    ...vapid, subject: "mailto:admin@example.test",
    fetchImpl: async url => {
      fetches.push(url);
      if (url.endsWith("/retry") && fetches.filter(item => item.endsWith("/retry")).length === 1) {
        return new Response(null, { status: 429 });
      }
      return new Response(null, { status: 201 });
    },
  });
  const context = {
    notificationId: "notification-retry",
    deliveryId: "parent-retry",
    deliveryLeaseToken: "parent-lease-first",
    studentId: "student-retry",
    studentName: "Alumno",
    destinationEmail: null,
    studentUserId: "user-retry",
    periodMonth: "2026-11-01",
    dueOn: "2026-11-20",
    balanceCents: "10000",
    reminderDays: 1,
  };

  assert.deepEqual(await provider(context), { outcome: "failed", errorCode: "push_unavailable" });
  assert.equal(state.get("sub-sent").status, "sent");
  assert.equal(state.get("sub-retry").status, "pending");

  assert.deepEqual(await provider({ ...context, deliveryLeaseToken: "parent-lease-second" }), {
    outcome: "sent",
    providerReference: "webpush:sent=2;unknown=0;expired=0",
  });
  assert.equal(fetches.filter(url => url.endsWith("/sent")).length, 1);
  assert.equal(fetches.filter(url => url.endsWith("/retry")).length, 2);
});

test("un timeout de Web Push queda incierto y no se convierte en fallo reintentable", async () => {
  const vapid = vapidKeys();
  const rows = [{ id: "sub-timeout", endpoint: "https://push.example.test/timeout", ...subscriptionKeys(), expires_at: null }];
  const outcomes = [];
  const db = {
    from() {
      return { select() { return this; }, eq() { return this; }, is() { return this; }, then(resolve) { resolve({ data: rows, error: null }); } };
    },
    async rpc(name, args) {
      if (name === "cueva_claim_notification_push_delivery") return { data: [{
        claimed: true, push_delivery_id: "push-delivery-timeout", push_lease_token: "push-lease-timeout",
        attempt_number: 1, delivery_status: "processing",
      }], error: null };
      if (name === "cueva_mark_notification_push_started_with_balance") return { data: [{ started: true, balance_cents: "10000" }], error: null };
      if (name === "cueva_finalize_notification_push_delivery") {
        outcomes.push(args.p_outcome);
        return { data: [{ finalized: true, delivery_status: "unknown", attempt_number: 1 }], error: null };
      }
      throw new Error(`Unexpected RPC: ${name}`);
    },
  };
  const provider = createWebPushProvider(db, {
    ...vapid, subject: "mailto:admin@example.test",
    fetchImpl: async () => { throw new Error("socket timeout"); },
  });
  const result = await provider({
    notificationId: "notification-timeout",
    deliveryId: "parent-timeout",
    deliveryLeaseToken: "parent-timeout-lease",
    studentId: "student-timeout",
    studentName: "Alumno",
    destinationEmail: null,
    studentUserId: "user-timeout",
    periodMonth: "2026-11-01",
    dueOn: "2026-11-20",
    balanceCents: "10000",
    reminderDays: 1,
  });
  assert.deepEqual(result, { outcome: "unknown", errorCode: "push_result_unknown" });
  assert.deepEqual(outcomes, ["unknown"]);
});

test("clasifica HTTP 5xx como incierto y HTTP 4xx como rechazo conocido", async () => {
  const run = async (httpStatus) => {
    const vapid = vapidKeys();
    const rows = [{ id: `sub-${httpStatus}`, endpoint: `https://push.example.test/${httpStatus}`, ...subscriptionKeys(), expires_at: null }];
    let recordedOutcome = null;
    let recordedError = null;
    const db = {
      from() {
        return { select() { return this; }, eq() { return this; }, is() { return this; }, then(resolve) { resolve({ data: rows, error: null }); } };
      },
      async rpc(name, args) {
        if (name === "cueva_claim_notification_push_delivery") return { data: [{
          claimed: true, push_delivery_id: `push-delivery-${httpStatus}`, push_lease_token: `push-lease-${httpStatus}`,
          attempt_number: 1, delivery_status: "processing",
        }], error: null };
        if (name === "cueva_mark_notification_push_started_with_balance") return { data: [{ started: true, balance_cents: "10000" }], error: null };
        if (name === "cueva_finalize_notification_push_delivery") {
          recordedOutcome = args.p_outcome;
          recordedError = args.p_error_code;
          return { data: [{
            finalized: true,
            delivery_status: args.p_outcome === "unknown" ? "unknown" : "pending",
            attempt_number: 1,
          }], error: null };
        }
        throw new Error(`Unexpected RPC: ${name}`);
      },
    };
    const provider = createWebPushProvider(db, {
      ...vapid, subject: "mailto:admin@example.test",
      fetchImpl: async () => new Response(null, { status: httpStatus }),
    });
    const result = await provider({
      notificationId: `notification-${httpStatus}`,
      deliveryId: `parent-${httpStatus}`,
      deliveryLeaseToken: `parent-lease-${httpStatus}`,
      studentId: `student-${httpStatus}`,
      studentName: "Alumno",
      destinationEmail: null,
      studentUserId: `user-${httpStatus}`,
      periodMonth: "2026-11-01",
      dueOn: "2026-11-20",
      balanceCents: "10000",
      reminderDays: 1,
    });
    return { result, recordedOutcome, recordedError };
  };

  assert.deepEqual(await run(503), {
    result: { outcome: "unknown", errorCode: "push_result_unknown" },
    recordedOutcome: "unknown",
    recordedError: "push_result_unknown",
  });
  assert.deepEqual(await run(400), {
    result: { outcome: "failed", errorCode: "push_unavailable" },
    recordedOutcome: "failed",
    recordedError: "push_http_rejected",
  });
});

test("no reintenta un endpoint que ya agotó sus cinco intentos", async () => {
  const vapid = vapidKeys();
  const rows = [{ id: "sub-exhausted", endpoint: "https://push.example.test/exhausted", ...subscriptionKeys(), expires_at: null }];
  let fetchCount = 0;
  const db = {
    from() {
      return { select() { return this; }, eq() { return this; }, is() { return this; }, then(resolve) { resolve({ data: rows, error: null }); } };
    },
    async rpc(name) {
      if (name === "cueva_claim_notification_push_delivery") return { data: [{
        claimed: false, push_delivery_id: "push-exhausted", push_lease_token: null,
        attempt_number: 5, delivery_status: "failed",
      }], error: null };
      throw new Error(`Unexpected RPC: ${name}`);
    },
  };
  const provider = createWebPushProvider(db, {
    ...vapid, subject: "mailto:admin@example.test",
    fetchImpl: async () => { fetchCount += 1; return new Response(null, { status: 201 }); },
  });
  const result = await provider({
    notificationId: "notification-exhausted",
    deliveryId: "parent-exhausted",
    deliveryLeaseToken: "parent-exhausted-lease",
    studentId: "student-exhausted",
    studentName: "Alumno",
    destinationEmail: null,
    studentUserId: "user-exhausted",
    periodMonth: "2026-11-01",
    dueOn: "2026-11-20",
    balanceCents: "10000",
    reminderDays: 1,
  });
  assert.deepEqual(result, { outcome: "failed", errorCode: "push_retries_exhausted" });
  assert.equal(fetchCount, 0);
});

test("sin cuenta o sin claves VAPID no intenta enviar", async () => {
  let reads = 0;
  const db = { from() { reads += 1; throw new Error("must not read"); } };
  const provider = createWebPushProvider(db, {
    publicKey: "", privateKey: "", subject: "",
    fetchImpl: async () => { throw new Error("must not fetch"); },
  });
  const context = {
    notificationId: "notification-1", deliveryId: "parent-1", deliveryLeaseToken: "parent-lease-1",
    studentId: "student-1", studentName: "Alumno",
    destinationEmail: null, studentUserId: "user-1", periodMonth: "2026-11-01",
    dueOn: "2026-11-20", balanceCents: "75000", reminderDays: 5,
  };
  assert.deepEqual(await provider({ ...context, studentUserId: null }), {
    outcome: "skipped", errorCode: "missing_student_account",
  });
  assert.deepEqual(await provider(context), { outcome: "failed", errorCode: "push_unavailable" });
  assert.equal(reads, 0);
});

test("ignora suscripciones con expiración pasada sin reclamar ni enviar", async () => {
  const rows = [{
    id: "sub-expired",
    endpoint: "https://push.example.test/expired",
    ...subscriptionKeys(),
    expires_at: "2026-11-01T00:00:00.000Z",
  }];
  let rpcCalls = 0;
  let fetchCalls = 0;
  const db = {
    from() {
      return { select() { return this; }, eq() { return this; }, is() { return this; }, then(resolve) { resolve({ data: rows, error: null }); } };
    },
    async rpc() { rpcCalls += 1; throw new Error("an expired subscription must not be claimed"); },
  };
  const provider = createWebPushProvider(db, {
    ...vapidKeys(),
    subject: "mailto:admin@example.test",
    now: () => Date.parse("2026-11-12T12:00:00.000Z"),
    fetchImpl: async () => { fetchCalls += 1; return new Response(null, { status: 201 }); },
  });
  const result = await provider({
    notificationId: "notification-expired",
    deliveryId: "parent-expired",
    deliveryLeaseToken: "parent-expired-lease",
    studentId: "student-expired",
    studentName: "Alumno",
    destinationEmail: null,
    studentUserId: "user-expired",
    periodMonth: "2026-11-01",
    dueOn: "2026-11-20",
    balanceCents: "10000",
    reminderDays: 1,
  });
  assert.deepEqual(result, { outcome: "skipped", errorCode: "missing_push_subscription" });
  assert.equal(rpcCalls, 0);
  assert.equal(fetchCalls, 0);
});

test("sin suscripciones activas informa que no hay destino", async () => {
  const db = { from() { return { select() { return this; }, eq() { return this; }, is() { return this; }, then(resolve) { resolve({ data: [], error: null }); } }; } };
  const provider = createWebPushProvider(db, {
    ...vapidKeys(), subject: "mailto:admin@example.test",
    fetchImpl: async () => { throw new Error("must not fetch"); },
  });
  assert.deepEqual(await provider({
    notificationId: "notification-1", deliveryId: "parent-1", deliveryLeaseToken: "parent-lease-1",
    studentId: "student-1", studentName: "Alumno",
    destinationEmail: null, studentUserId: "user-1", periodMonth: "2026-11-01",
    dueOn: "2026-11-20", balanceCents: "75000", reminderDays: 5,
  }), { outcome: "skipped", errorCode: "missing_push_subscription" });
});

test("declara Push disponible solo con claves VAPID completas y coincidentes", () => {
  const keys = vapidKeys();
  const otherKeys = vapidKeys();
  assert.equal(isWebPushConfigurationAvailable({
    ...keys,
    subject: "mailto:admin@example.test",
  }), true);
  assert.equal(isWebPushConfigurationAvailable({
    publicKey: keys.publicKey,
    privateKey: "",
    subject: "mailto:admin@example.test",
  }), false);
  assert.equal(isWebPushConfigurationAvailable({
    publicKey: keys.publicKey,
    privateKey: otherKeys.privateKey,
    subject: "mailto:admin@example.test",
  }), false);
  assert.equal(isWebPushConfigurationAvailable({
    ...keys,
    subject: "admin@example.test",
  }), false);
});


test("each push device receives the balance captured at its own provider-start boundary", async () => {
  const vapid = vapidKeys();
  const rows = [
    { id: "sub-current-a", endpoint: "https://push.example.test/current-a", ...subscriptionKeys(), expires_at: null },
    { id: "sub-current-b", endpoint: "https://push.example.test/current-b", ...subscriptionKeys(), expires_at: null },
  ];
  const requests = [];
  let startedCount = 0;
  const db = {
    from() {
      return {
        select() { return this; }, eq() { return this; }, is() { return this; },
        then(resolve) { resolve({ data: rows, error: null }); },
      };
    },
    async rpc(name, args) {
      if (name === "cueva_claim_notification_push_delivery") {
        return { data: [{ claimed: true, push_delivery_id: `push-${args.p_subscription_id}`,
          push_lease_token: `lease-${args.p_subscription_id}`, attempt_number: 1, delivery_status: "processing" }], error: null };
      }
      if (name === "cueva_mark_notification_push_started_with_balance") {
        startedCount += 1;
        return { data: [{ started: true, balance_cents: startedCount === 1 ? "75000" : "50000" }], error: null };
      }
      if (name === "cueva_finalize_notification_push_delivery") {
        return { data: [{ finalized: true, delivery_status: "sent", attempt_number: 1 }], error: null };
      }
      throw new Error(`Unexpected RPC: ${name}`);
    },
  };
  const provider = createWebPushProvider(db, {
    ...vapid,
    subject: "mailto:admin@example.test",
    fetchImpl: async (url, init) => {
      requests.push({ url, body: init.body });
      return new Response(null, { status: 201 });
    },
  });

  const result = await provider({
    notificationId: "notification-current-balance",
    deliveryId: "parent-current-balance",
    deliveryLeaseToken: "parent-current-balance-lease",
    studentId: "student-current-balance",
    studentName: "Alumno",
    destinationEmail: null,
    studentUserId: "user-current-balance",
    periodMonth: "2026-11-01",
    dueOn: "2026-11-20",
    balanceCents: "120000",
    reminderDays: 1,
  });

  assert.equal(result.outcome, "sent");
  assert.equal(requests.length, 2);
  const bodies = requests.map(request => {
    const row = rows.find(item => item.endpoint === request.url);
    return decryptWebPushPayload(request.body, row);
  }).sort();
  assert.match(bodies[0], /500/);
  assert.match(bodies[1], /750/);
  assert.equal(startedCount, 2);
});
