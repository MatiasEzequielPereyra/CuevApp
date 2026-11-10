import "server-only";
import { createCipheriv, createECDH, createPrivateKey, hkdfSync, randomBytes, sign } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatReminderContent } from "./core.ts";
import type { NotificationDeliveryContext, ProviderResult } from "./dispatcher.ts";

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth_secret: string;
  expires_at: string | null;
};

export type WebPushConfiguration = {
  publicKey: string;
  privateKey: string;
  subject: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

const b64url = (value: Buffer | Uint8Array | string) =>
  Buffer.from(value).toString("base64url");

function decodeBase64Url(value: string): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new TypeError("Invalid push key");
  return Buffer.from(value, "base64url");
}

function vapidPrivateKey(configuration: WebPushConfiguration) {
  const publicBytes = decodeBase64Url(configuration.publicKey);
  const privateBytes = decodeBase64Url(configuration.privateKey);
  if (publicBytes.length !== 65 || publicBytes[0] !== 4 || privateBytes.length !== 32) {
    throw new TypeError("Invalid VAPID key pair");
  }
  return createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      x: b64url(publicBytes.subarray(1, 33)),
      y: b64url(publicBytes.subarray(33, 65)),
      d: b64url(privateBytes),
    },
    format: "jwk",
  });
}

function createVapidAuthorization(
  endpoint: string,
  configuration: WebPushConfiguration,
  now: number,
): string {
  const audience = new URL(endpoint).origin;
  const header = b64url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const claims = b64url(JSON.stringify({
    aud: audience,
    exp: Math.floor(now / 1000) + 12 * 60 * 60,
    sub: configuration.subject,
  }));
  const input = `${header}.${claims}`;
  const signature = sign("sha256", Buffer.from(input), {
    key: vapidPrivateKey(configuration),
    dsaEncoding: "ieee-p1363",
  });
  return `vapid t=${input}.${b64url(signature)}, k=${configuration.publicKey}`;
}

export function encryptWebPushPayload(
  payload: Uint8Array,
  subscription: Pick<PushSubscriptionRow, "p256dh" | "auth_secret">,
): Buffer {
  const userPublicKey = decodeBase64Url(subscription.p256dh);
  const authSecret = decodeBase64Url(subscription.auth_secret);
  if (userPublicKey.length !== 65 || userPublicKey[0] !== 4 || authSecret.length !== 16) {
    throw new TypeError("Invalid push subscription keys");
  }

  const serverECDH = createECDH("prime256v1");
  serverECDH.generateKeys();
  const serverPublicKey = serverECDH.getPublicKey();
  const sharedSecret = serverECDH.computeSecret(userPublicKey);
  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0", "utf8"),
    userPublicKey,
    serverPublicKey,
  ]);
  const inputKeyMaterial = Buffer.from(hkdfSync("sha256", sharedSecret, authSecret, keyInfo, 32));
  const salt = randomBytes(16);
  const contentKey = Buffer.from(hkdfSync(
    "sha256",
    inputKeyMaterial,
    salt,
    Buffer.from("Content-Encoding: aes128gcm\0", "utf8"),
    16,
  ));
  const nonce = Buffer.from(hkdfSync(
    "sha256",
    inputKeyMaterial,
    salt,
    Buffer.from("Content-Encoding: nonce\0", "utf8"),
    12,
  ));

  const cipher = createCipheriv("aes-128-gcm", contentKey, nonce);
  const plaintext = Buffer.concat([Buffer.from(payload), Buffer.from([2])]);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096, 0);
  return Buffer.concat([
    salt,
    recordSize,
    Buffer.from([serverPublicKey.length]),
    serverPublicKey,
    ciphertext,
  ]);
}

function buildPushPayload(context: NotificationDeliveryContext): Buffer {
  const content = formatReminderContent({
    dueOn: context.dueOn,
    periodMonth: context.periodMonth,
    balanceCents: context.balanceCents,
    studentActive: true,
  });
  return Buffer.from(JSON.stringify({
    title: content.title,
    body: content.body,
    tag: `cueva-${context.notificationId}`,
  }), "utf8");
}

export function createWebPushProvider(
  db: SupabaseClient,
  configuration: WebPushConfiguration,
) {
  const fetchImpl = configuration.fetchImpl ?? fetch;
  const now = configuration.now ?? Date.now;

  return async (context: NotificationDeliveryContext): Promise<ProviderResult> => {
    if (!context.studentUserId) {
      return { outcome: "skipped", errorCode: "missing_student_account" };
    }
    if (!configuration.publicKey.trim() || !configuration.privateKey.trim()
      || !/^mailto:.+@.+\..+$/.test(configuration.subject)) {
      return { outcome: "failed", errorCode: "push_unavailable" };
    }

    try {
      const { data, error } = await db
        .from("cueva_push_subscriptions")
        .select("id,endpoint,p256dh,auth_secret,expires_at")
        .eq("student_id", context.studentId)
        .is("revoked_at", null);
      if (error || !Array.isArray(data)) {
        return { outcome: "failed", errorCode: "push_unavailable" };
      }
      const subscriptions = data as PushSubscriptionRow[];
      if (subscriptions.length === 0) {
        return { outcome: "skipped", errorCode: "missing_push_subscription" };
      }

      const payload = buildPushPayload(context);
      const results = await Promise.all(subscriptions.map(async subscription => {
        try {
          if (subscription.expires_at && Date.parse(subscription.expires_at) <= now()) {
            await db.from("cueva_push_subscriptions")
              .update({ revoked_at: new Date(now()).toISOString() })
              .eq("id", subscription.id)
              .is("revoked_at", null);
            return "expired" as const;
          }
          const endpoint = new URL(subscription.endpoint);
          if (endpoint.protocol !== "https:") return "failed" as const;

          const body = encryptWebPushPayload(payload, subscription);
          const response = await fetchImpl(subscription.endpoint, {
            method: "POST",
            headers: {
              "Authorization": createVapidAuthorization(subscription.endpoint, configuration, now()),
              "Content-Encoding": "aes128gcm",
              "Content-Type": "application/octet-stream",
              "TTL": "86400",
              "Urgency": "normal",
            },
            body,
            cache: "no-store",
            signal: AbortSignal.timeout(10000),
          });

          if (response.status === 404 || response.status === 410) {
            await db.from("cueva_push_subscriptions")
              .update({ revoked_at: new Date(now()).toISOString() })
              .eq("id", subscription.id)
              .is("revoked_at", null);
            return "expired" as const;
          }
          return response.ok ? "sent" as const : "failed" as const;
        } catch {
          return "failed" as const;
        }
      }));

      const sent = results.filter(result => result === "sent").length;
      if (sent > 0) return { outcome: "sent", providerReference: `webpush:${sent}` };
      if (results.every(result => result === "expired")) {
        return { outcome: "skipped", errorCode: "push_subscription_expired" };
      }
      return { outcome: "failed", errorCode: "push_unavailable" };
    } catch {
      return { outcome: "failed", errorCode: "push_unavailable" };
    }
  };
}

export function createWebPushProviderFromEnvironment(
  db: SupabaseClient,
  environment: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
) {
  return createWebPushProvider(db, {
    publicKey: environment.CUEVA_VAPID_PUBLIC_KEY ?? "",
    privateKey: environment.CUEVA_VAPID_PRIVATE_KEY ?? "",
    subject: environment.CUEVA_VAPID_SUBJECT ?? "",
    fetchImpl,
  });
}
