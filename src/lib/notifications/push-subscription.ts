import { createECDH } from "node:crypto";

export type ParsedPushSubscription = {
  endpoint: string;
  p256dh: string;
  authSecret: string;
  expiresAt: string | null;
};

const ALLOWED_HOSTS = new Set([
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
]);

function decodeKey(value: unknown, expectedLength: number): value is string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) return false;
  const decoded = Buffer.from(value, "base64url");
  return decoded.length === expectedLength && decoded.toString("base64url") === value;
}

export function parsePushEndpoint(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const endpoint = new URL(value);
    const hostname = endpoint.hostname.toLowerCase();
    const allowed = ALLOWED_HOSTS.has(hostname)
      || hostname.endsWith(".push.services.mozilla.com")
      || hostname.endsWith(".notify.windows.com");
    if (endpoint.protocol !== "https:" || !allowed || endpoint.username || endpoint.password
      || (endpoint.port !== "" && endpoint.port !== "443")
      || endpoint.hash || endpoint.href.length > 2048) return null;
    return endpoint.href;
  } catch {
    return null;
  }
}

export function parsePushSubscription(
  value: unknown,
  now = Date.now(),
): ParsedPushSubscription | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const endpoint = parsePushEndpoint(input.endpoint);
  const keys = input.keys;
  if (!endpoint || !keys || typeof keys !== "object" || Array.isArray(keys)) return null;
  const keyValues = keys as Record<string, unknown>;
  if (!decodeKey(keyValues.p256dh, 65) || !decodeKey(keyValues.auth, 16)) return null;
  const publicKey = Buffer.from(keyValues.p256dh, "base64url");
  if (publicKey[0] !== 4) return null;
  try {
    const validator = createECDH("prime256v1");
    validator.generateKeys();
    validator.computeSecret(publicKey);
  } catch {
    return null;
  }

  let expiresAt: string | null = null;
  if (input.expirationTime !== null && input.expirationTime !== undefined) {
    if (typeof input.expirationTime !== "number" || !Number.isFinite(input.expirationTime)
      || input.expirationTime <= now || input.expirationTime > now + 5 * 365 * 24 * 60 * 60 * 1000) return null;
    expiresAt = new Date(input.expirationTime).toISOString();
  }

  return {
    endpoint,
    p256dh: keyValues.p256dh,
    authSecret: keyValues.auth,
    expiresAt,
  };
}
