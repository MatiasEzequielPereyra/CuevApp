import "server-only";
import { serviceClient } from "@/lib/product-auth/server";
import { createBrevoEmailProviderFromEnvironment } from "./brevo-email-provider.ts";
import { createInternalInboxProvider } from "./internal-inbox-provider.ts";
import { createSupabaseNotificationWorker } from "./supabase-worker.ts";
import { createWebPushProviderFromEnvironment } from "./web-push-provider.ts";

/**
 * Constructs the production worker from server-only credentials and adapters.
 * No provider credentials are read by browser code or returned to the caller.
 */
export async function runSupabaseNotificationWorker(now = new Date()) {
  const db = serviceClient();
  const providers = {
    sendEmail: createBrevoEmailProviderFromEnvironment(),
    createInternal: createInternalInboxProvider(db),
    sendPush: createWebPushProviderFromEnvironment(db),
  };
  return createSupabaseNotificationWorker(db, providers)(now);
}
