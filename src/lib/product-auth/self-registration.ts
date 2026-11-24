import "server-only";
import { serviceClient, type userClient } from "@/lib/product-auth/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Provision only the user authenticated by GoTrue in the current session.
 * The privileged RPC cannot be invoked by anon/authenticated PostgREST roles.
 */
export async function completeSelfRegistration(
  auth: Awaited<ReturnType<typeof userClient>>,
  expectedUserId: string,
): Promise<string> {
  const session = await auth.auth.getSession();
  const token = session.data.session?.access_token;
  if (session.error || !token) return "unauthenticated";

  const verified = await auth.auth.getUser(token);
  if (verified.error || verified.data.user?.id !== expectedUserId
    || !verified.data.user?.email_confirmed_at) return "unverified";

  let claims: { sub?: unknown; session_id?: unknown };
  try {
    claims = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString());
  } catch {
    return "unauthenticated";
  }
  if (claims.sub !== expectedUserId || typeof claims.session_id !== "string"
    || !uuid.test(claims.session_id)) return "unauthenticated";

  // The only service_role use is behind both server-side Auth verification
  // and the database's exact Auth user/session checks. No automatic claim of
  // a previously existing gym student by email is possible.
  const linked = await serviceClient().rpc("cueva_complete_self_registration", {
    p_user: expectedUserId, p_session: claims.session_id,
  });
  return linked.error ? "error" : String(linked.data);
}
