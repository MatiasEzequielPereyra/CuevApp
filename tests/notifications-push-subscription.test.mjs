import test from "node:test";
import assert from "node:assert/strict";
import { createECDH } from "node:crypto";
import { parsePushEndpoint, parsePushSubscription } from "../src/lib/notifications/push-subscription.ts";

const keyPair = createECDH("prime256v1");
keyPair.generateKeys();
const publicKey = keyPair.getPublicKey().toString("base64url");
const auth = Buffer.alloc(16, 9).toString("base64url");
const valid = {
  endpoint: "https://fcm.googleapis.com/fcm/send/example-token",
  expirationTime: null,
  keys: { p256dh: publicKey, auth },
};

test("accepts known browser push services and validates cryptographic key lengths", () => {
  assert.equal(parsePushEndpoint(valid.endpoint), valid.endpoint);
  assert.equal(parsePushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/example"), "https://updates.push.services.mozilla.com/wpush/v2/example");
  assert.equal(parsePushEndpoint("https://web.push.apple.com/Qexample"), "https://web.push.apple.com/Qexample");
  assert.equal(parsePushSubscription(valid, 1000)?.p256dh, publicKey);
  assert.equal(parsePushSubscription(valid, 1000)?.authSecret, auth);
});

test("rejects arbitrary hosts, insecure endpoints, credentials, and nonstandard ports", () => {
  for (const endpoint of [
    "http://fcm.googleapis.com/fcm/send/token",
    "https://attacker.example/push",
    "https://fcm.googleapis.com.evil.example/send/token",
    "https://user:pass@fcm.googleapis.com/send/token",
    "https://fcm.googleapis.com:8443/send/token",
    "https://127.0.0.1/send/token",
  ]) assert.equal(parsePushEndpoint(endpoint), null, endpoint);
});

test("rejects malformed keys, wrong curve point prefix, and expired subscriptions", () => {
  assert.equal(parsePushSubscription({ ...valid, keys: { p256dh: "bad", auth } }, 1000), null);
  const wrongPoint = Buffer.alloc(65, 3).toString("base64url");
  assert.equal(parsePushSubscription({ ...valid, keys: { p256dh: wrongPoint, auth } }, 1000), null);
  assert.equal(parsePushSubscription({ ...valid, expirationTime: 999 }, 1000), null);
  assert.equal(parsePushSubscription({ ...valid, expirationTime: Number.NaN }, 1000), null);
});
