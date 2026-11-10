import {
  formatReminderContent,
} from "./core.ts";
import type { NotificationDeliveryContext, ProviderResult } from "./dispatcher.ts";

export type BrevoEmailConfiguration = {
  apiKey: string;
  senderEmail: string;
  senderName: string;
  fetchImpl?: typeof fetch;
};

type BrevoEmailPayload = {
  sender: { email: string; name: string };
  to: Array<{ email: string }>;
  subject: string;
  htmlContent: string;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

export function buildBrevoEmailPayload(
  context: NotificationDeliveryContext,
  sender: { email: string; name: string },
): BrevoEmailPayload | null {
  if (!context.destinationEmail?.trim()) return null;
  const content = formatReminderContent({
    dueOn: context.dueOn,
    periodMonth: context.periodMonth,
    balanceCents: context.balanceCents,
    studentActive: true,
  });
  return {
    sender,
    to: [{ email: context.destinationEmail.trim() }],
    subject: content.subject,
    htmlContent: `<p>Hola ${escapeHtml(context.studentName)},</p><p>${escapeHtml(content.body)}</p><p>Este es un aviso automático de CUEVA.</p>`,
  };
}

export function createBrevoEmailProvider(configuration: BrevoEmailConfiguration) {
  const fetchImpl = configuration.fetchImpl ?? fetch;

  return async (context: NotificationDeliveryContext): Promise<ProviderResult> => {
    if (!context.destinationEmail?.trim()) {
      return { outcome: "skipped", errorCode: "missing_destination" };
    }
    if (
      !configuration.apiKey.trim()
      || !configuration.senderEmail.trim()
      || !configuration.senderName.trim()
    ) {
      return { outcome: "failed", errorCode: "brevo_unavailable" };
    }

    try {
      const payload = buildBrevoEmailPayload(context, {
        email: configuration.senderEmail.trim(),
        name: configuration.senderName.trim(),
      });
      if (!payload) return { outcome: "skipped", errorCode: "missing_destination" };

      const response = await fetchImpl("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "accept": "application/json",
          "api-key": configuration.apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      });

      if (!response.ok) {
        return {
          outcome: "failed",
          errorCode: response.status === 429 || response.status >= 500
            ? "brevo_unavailable"
            : "brevo_rejected",
        };
      }

      let providerReference: string | undefined;
      try {
        const result: unknown = await response.json();
        if (
          result && typeof result === "object"
          && "messageId" in result
          && typeof result.messageId === "string"
        ) {
          const messageId = result.messageId.trim();
          if (messageId && messageId.length <= 190) providerReference = `brevo:${messageId}`;
        }
      } catch {
        // A successful provider response remains successful without a reference.
      }

      return { outcome: "sent", ...(providerReference ? { providerReference } : {}) };
    } catch {
      return { outcome: "failed", errorCode: "brevo_unavailable" };
    }
  };
}

export function createBrevoEmailProviderFromEnvironment(
  environment: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
) {
  return createBrevoEmailProvider({
    apiKey: environment.CUEVA_BREVO_API_KEY ?? "",
    senderEmail: environment.CUEVA_BREVO_SENDER_EMAIL ?? "",
    senderName: environment.CUEVA_BREVO_SENDER_NAME ?? "",
    fetchImpl,
  });
}
