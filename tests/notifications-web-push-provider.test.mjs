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
      if (name === "cueva_mark_notification_push_started") return { data: [{ started: true }], error: null };
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
  assert.equal(rpcCalls.filter(call => call.name === "cueva_mark_notification_push_started").length, 2);
  assert.equal(rpcCalls.filter(call => call.name === "cueva_finalize_notification_push_delivery").length, 2);
  assert.deepEqual(
    rpcCalls.filter(call => call.name === "cueva_finalize_notification_push_delivery").map(call => call.args.p_outcome).sort(),
    ["expired", "sent"],
  );
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
      if (name === "cueva_mark_notification_push_started") return { data: [{ started: true }], error: null };
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

test("sin suscripciones activas informa que no hay destino", async () => {
  const db = { from() { return { select() { return this; }, eq() { return this; }, is() { return this; }, then(resolve) { resolve({ data: [], error: null }); } }; } };
  const provider = createWebPushProvider(db, {
    ...vapidKeys(), subject: "mailto:admin@example.test",
    fetchImpl: async () => { throw new Error("must not fetch"); },
  });
  assert.deepEqual(await provider({
    notificationId: "notification-1", studentId: "student-1", studentName: "Alumno",
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
