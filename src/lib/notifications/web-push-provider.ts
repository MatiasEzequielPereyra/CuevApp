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
  // Derive the public point from the private scalar. A JWK containing x/y/d
  // does not prove that the supplied public coordinates correspond to d.
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(privateBytes);
  if (!ecdh.getPublicKey().equals(publicBytes)) {
    throw new TypeError("VAPID public and private keys do not match");
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

/**
 * Returns true only when the complete server-side VAPID configuration can
 * produce valid authorization headers. The public key alone is insufficient.
 */
export function isWebPushConfigurationAvailable(
  configuration: Pick<WebPushConfiguration, "publicKey" | "privateKey" | "subject">,
): boolean {
  if (!configuration.publicKey.trim() || !configuration.privateKey.trim()
    || !/^mailto:.+@.+\..+$/.test(configuration.subject)) {
    return false;
  }
  try {
    vapidPrivateKey(configuration as WebPushConfiguration);
    return true;
  } catch {
    return false;
  }
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

type PushClaimRow = {
  claimed: boolean;
  push_delivery_id: string | null;
  push_lease_token: string | null;
  attempt_number: number | null;
  delivery_status: string;
};

type PushStartRow = { started: boolean; balance_cents: string | null };

type PushFinalizeRow = {
  finalized: boolean;
  delivery_status: string;
  attempt_number: number;
};

type PushTargetResult = {
  status: string;
  attemptNumber: number;
};

function firstRpcRow<T>(data: unknown): T | null {
  return Array.isArray(data) && data.length > 0 ? data[0] as T : null;
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
    if (!isWebPushConfigurationAvailable(configuration)) {
      return { outcome: "failed", errorCode: "push_unavailable" };
    }
    if (!context.deliveryId || !context.deliveryLeaseToken) {
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
      const subscriptions = (data as PushSubscriptionRow[]).filter(subscription =>
        subscription.expires_at === null || Date.parse(subscription.expires_at) > now(),
      );
      if (subscriptions.length === 0) {
        return { outcome: "skipped", errorCode: "missing_push_subscription" };
      }

      const results = await Promise.all(subscriptions.map(async (subscription: PushSubscriptionRow): Promise<PushTargetResult> => {
        try {
          const claimResponse = await db.rpc("cueva_claim_notification_push_delivery", {
            p_delivery_id: context.deliveryId,
            p_parent_lease_token: context.deliveryLeaseToken,
            p_subscription_id: subscription.id,
            p_lease_seconds: 120,
          });
          if (claimResponse.error) return { status: "failed", attemptNumber: 0 };
          const claim = firstRpcRow<PushClaimRow>(claimResponse.data);
          if (!claim) return { status: "failed", attemptNumber: 0 };
          if (!claim.claimed || !claim.push_delivery_id || !claim.push_lease_token) {
            return { status: claim.delivery_status, attemptNumber: Number(claim.attempt_number ?? 0) };
          }

          const startedResponse = await db.rpc("cueva_mark_notification_push_started_with_balance", {
            p_push_delivery_id: claim.push_delivery_id,
            p_push_lease_token: claim.push_lease_token,
            p_delivery_id: context.deliveryId,
            p_parent_lease_token: context.deliveryLeaseToken,
          });
          if (startedResponse.error) {
            return { status: "failed", attemptNumber: Number(claim.attempt_number ?? 0) };
          }
          const started = firstRpcRow<PushStartRow>(startedResponse.data);
          if (!started?.started) {
            return { status: "cancelled", attemptNumber: Number(claim.attempt_number ?? 0) };
          }
          if (typeof started.balance_cents !== "string" || !/^[1-9][0-9]*$/.test(started.balance_cents)) {
            return { status: "failed", attemptNumber: Number(claim.attempt_number ?? 0) };
          }
          const payload = buildPushPayload({ ...context, balanceCents: started.balance_cents });

          let outcome: "sent" | "failed" | "unknown" | "expired";
          let errorCode: string | null = null;
          let providerReference: string | null = null;
          try {
            const endpoint = new URL(subscription.endpoint);
            if (endpoint.protocol !== "https:") {
              outcome = "failed";
              errorCode = "push_endpoint_rejected";
            } else {
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
                body: new Uint8Array(body),
                cache: "no-store",
                redirect: "error",
                signal: AbortSignal.timeout(10000),
              });
              providerReference = `http:${response.status}`;
              if (response.status === 404 || response.status === 410) {
                outcome = "expired";
                errorCode = "push_subscription_expired";
              } else if (response.ok) {
                outcome = "sent";
              } else if (response.status >= 500) {
                outcome = "unknown";
                errorCode = "push_result_unknown";
              } else {
                outcome = "failed";
                errorCode = response.status === 429 ? "push_http_429" : "push_http_rejected";
              }
            }
          } catch {
            // A network error or timeout can happen after the push service accepted
            // the request. Never retry that endpoint automatically.
            outcome = "unknown";
            errorCode = "push_result_unknown";
          }

          const finalizedResponse = await db.rpc("cueva_finalize_notification_push_delivery", {
            p_push_delivery_id: claim.push_delivery_id,
            p_push_lease_token: claim.push_lease_token,
            p_outcome: outcome,
            p_provider_reference: providerReference,
            p_error_code: errorCode,
          });
          if (finalizedResponse.error) {
            return { status: outcome === "sent" || outcome === "unknown" ? "unknown" : "failed", attemptNumber: Number(claim.attempt_number ?? 0) };
          }
          const finalized = firstRpcRow<PushFinalizeRow>(finalizedResponse.data);
          if (!finalized?.finalized) {
            return { status: outcome === "sent" || outcome === "unknown" ? "unknown" : "failed", attemptNumber: Number(claim.attempt_number ?? 0) };
          }
          return { status: finalized.delivery_status, attemptNumber: Number(finalized.attempt_number ?? claim.attempt_number ?? 0) };
        } catch {
          return { status: "failed", attemptNumber: 0 };
        }
      }));

      const sent = results.filter(result => result.status === "sent").length;
      const unknown = results.filter(result => result.status === "unknown").length;
      const expired = results.filter(result => result.status === "expired").length;
      const terminalFailed = results.some(result => result.status === "failed" && result.attemptNumber >= 5);
      const retryable = results.some(result =>
        result.status === "processing"
        || result.status === "stale"
        || result.status === "failed" && result.attemptNumber < 5
        || result.status === "pending" && result.attemptNumber < 5,
      );

      if (retryable) return { outcome: "failed", errorCode: "push_unavailable" };
      if (sent > 0) {
        return {
          outcome: "sent",
          providerReference: `webpush:sent=${sent};unknown=${unknown};expired=${expired}`,
        };
      }
      if (unknown > 0) return { outcome: "unknown", errorCode: "push_result_unknown" };
      if (terminalFailed) return { outcome: "failed", errorCode: "push_retries_exhausted" };
      if (results.every(result => result.status === "expired")) {
        return { outcome: "skipped", errorCode: "push_subscription_expired" };
      }
      if (results.every(result => result.status === "cancelled" || result.status === "expired")) {
        return { outcome: "skipped", errorCode: "notification_not_relevant" };
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
