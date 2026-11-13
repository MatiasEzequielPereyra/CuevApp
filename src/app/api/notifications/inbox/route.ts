import { productConfig, userClient } from "@/lib/product-auth/server";
import { createNotificationInboxHandlers } from "@/lib/notifications/inbox-route-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StudentContext = { userId: string; auth: Awaited<ReturnType<typeof userClient>> };

async function requireStudent(): Promise<StudentContext | null> {
  if (!productConfig()) return null;
  const auth = await userClient();
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) return null;

  const profile = await auth.from("cueva_profiles").select("role").maybeSingle();
  if (profile.error || profile.data?.role !== "alumno") return null;
  return { userId: user.id, auth };
}

const handlers = createNotificationInboxHandlers({
  sameOrigin(request) {
    const configuration = productConfig();
    return !!configuration && request.headers.get("origin") === configuration.origin;
  },
  requireStudent,
  async markRead(student, notificationId) {
    const context = student as StudentContext;
    // The authenticated client and inbox RLS are the authorization boundary.
    const { data, error } = await context.auth
      .from("cueva_notification_inbox")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .eq("user_id", context.userId)
      .select("id")
      .maybeSingle();
    if (error) return "error";
    return data ? "updated" : "not_found";
  },
});

export const PATCH = handlers.PATCH;
