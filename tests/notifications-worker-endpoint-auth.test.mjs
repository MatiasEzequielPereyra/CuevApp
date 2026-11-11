import assert from "node:assert/strict";
import test from "node:test";
import { isAuthorizedNotificationWorkerRequest } from "../src/lib/notifications/worker-endpoint-auth.ts";

const secret = "a".repeat(64);
const request = authorization => new Request("https://cueva.example/api/notifications/worker", {
  method: "POST",
  headers: authorization ? { authorization } : {},
});

test("accepts only the exact dedicated bearer secret", () => {
  assert.equal(isAuthorizedNotificationWorkerRequest(request(`Bearer ${secret}`), secret), true);
  assert.equal(isAuthorizedNotificationWorkerRequest(request(`bearer ${secret}`), secret), false);
  assert.equal(isAuthorizedNotificationWorkerRequest(request(`Bearer ${secret}x`), secret), false);
});

test("rejects missing, short, or whitespace-padded secrets", () => {
  assert.equal(isAuthorizedNotificationWorkerRequest(request(`Bearer ${secret}`), undefined), false);
  assert.equal(isAuthorizedNotificationWorkerRequest(request("Bearer short"), "short"), false);
  assert.equal(isAuthorizedNotificationWorkerRequest(request(`Bearer ${secret}`), ` ${secret}`), false);
});

test("rejects missing and malformed authorization headers", () => {
  assert.equal(isAuthorizedNotificationWorkerRequest(request(null), secret), false);
  assert.equal(isAuthorizedNotificationWorkerRequest(request(secret), secret), false);
  assert.equal(isAuthorizedNotificationWorkerRequest(request(`Bearer  ${secret}`), secret), false);
});
