import { serviceClient, productConfig, userClient } from "@/lib/product-auth/server";
import { isWebPushConfigurationAvailable } from "@/lib/notifications/web-push-provider";
import { createPushRouteHandlers } from "@/lib/notifications/push-route-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StudentContext = {
  auth: Awaited<ReturnType<typeof userClient>>;
  db: ReturnType<typeof serviceClient>;
  studentId: string;
};

async function requireStudent(): Promise<StudentContext | null> {
  if (!productConfig()) return null;
  const auth = await userClient(true);
  const { data: { user }, error: authError } = await auth.auth.getUser();
  if (authError || !user) return null;

  const profile = await auth.from("cueva_profiles").select("role").maybeSingle();
  if (profile.error || profile.data?.role !== "alumno") return null;

  // The preference table's RLS exposes only the current alumno's row. This
  // resolves the student link without granting the service role extra access
  // to invitation or student records.
  const ownPreference = await auth.from("cueva_notification_preferences")
    .select("student_id")
    .maybeSingle();
  if (ownPreference.error || !ownPreference.data?.student_id) return null;

  return { auth, db: serviceClient(), studentId: ownPreference.data.student_id as string };
}

const handlers = createPushRouteHandlers({
  sameOrigin(request) {
    const cfg = productConfig();
    return !!cfg && request.headers.get("origin") === cfg.origin;
  },
  requireStudent,
  async readPreference(student) {
    const context = student as StudentContext;
    const { data, error } = await context.auth.from("cueva_notification_preferences")
      .select("push_enabled")
      .eq("student_id", context.studentId)
      .maybeSingle();
    return error || !data ? null : { pushEnabled: data.push_enabled !== false };
  },
  async updatePreference(student, enabled) {
    const context = student as StudentContext;
    const { data, error } = await context.db.from("cueva_notification_preferences")
      .update({ push_enabled: enabled })
      .eq("student_id", context.studentId)
      .select("push_enabled")
      .maybeSingle();
    return !error && !!data && data.push_enabled === enabled;
  },
  async registerSubscription(student, subscription) {
    const context = student as StudentContext;
    const { data, error } = await context.db.rpc("cueva_register_push_subscription", {
      p_student_id: context.studentId,
      p_endpoint: subscription.endpoint,
      p_p256dh: subscription.p256dh,
      p_auth_secret: subscription.authSecret,
      p_expires_at: subscription.expiresAt,
    });
    if (error) return "error";
    const result = Array.isArray(data) ? data[0] : null;
    return result?.outcome ?? "error";
  },
  async removeSubscription(student, endpoint) {
    const context = student as StudentContext;
    const existing = await context.db.from("cueva_push_subscriptions")
      .select("id")
      .eq("endpoint", endpoint)
      .eq("student_id", context.studentId)
      .maybeSingle();
    if (existing.error) return "error";
    if (!existing.data) return "removed";

    const { error } = await context.db.from("cueva_push_subscriptions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", existing.data.id)
      .eq("student_id", context.studentId)
      .is("revoked_at", null);
    return error ? "error" : "removed";
  },
  isAvailable() {
    const configuration = {
      publicKey: process.env.CUEVA_VAPID_PUBLIC_KEY ?? "",
      privateKey: process.env.CUEVA_VAPID_PRIVATE_KEY ?? "",
      subject: process.env.CUEVA_VAPID_SUBJECT ?? "",
    };
    return isWebPushConfigurationAvailable(configuration);
  },
  publicKey() {
    return process.env.CUEVA_VAPID_PUBLIC_KEY ?? "";
  },
});

export const GET = handlers.GET;
export const PUT = handlers.PUT;
export const POST = handlers.POST;
export const DELETE = handlers.DELETE;
