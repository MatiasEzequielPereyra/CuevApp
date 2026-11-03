import { createHash, randomBytes, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { pendingUserClient, productConfig, serviceClient, userClient } from "@/lib/product-auth/server";

export const dynamic = "force-dynamic";
const fail = (status: number) => new Response("No se pudo completar la solicitud", { status, headers: { "Cache-Control": "no-store" } });
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);

export async function POST(req: Request, { params }: { params: Promise<{operation: string}> }) {
  const cfg = productConfig();
  if (!cfg) return fail(404);
  if (req.headers.get("origin") !== cfg.origin) return fail(403);
  const contentType = req.headers.get("content-type") ?? "";
  if (!/^(application\/x-www-form-urlencoded|multipart\/form-data)(?:\s*;|\s*$)/i.test(contentType)) return fail(415);
  const declared = req.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > 8192)) return fail(413);
  const reader = req.body?.getReader(), chunks: Uint8Array[] = [];
  let total = 0;
  if (reader) {
    try { while (true) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength; if (total > 8192) { await reader.cancel().catch(() => {}); return fail(413); } chunks.push(value); } }
    catch { return fail(400); } finally { reader.releaseLock(); }
  }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let form: FormData;
  try { form = await new Request(req.url, { method: "POST", headers: { "content-type": contentType }, body: bytes }).formData(); } catch { return fail(400); }
  const { operation } = await params;
  if (operation === "owner-invitacion") {
    if (!cfg.ownerTest || !cfg.expectedOwner) return fail(404);
    const accessToken = String(form.get("access_token") ?? ""), refreshToken = String(form.get("refresh_token") ?? "");
    const nonce = String(form.get("nonce") ?? ""), gen = form.get("generation");
    if (form.get("type") !== "invite" || gen !== "1" || !/^[0-9a-f]{64}$/i.test(nonce) || !accessToken || accessToken.length > 4096 || !refreshToken || refreshToken.length > 1024) return fail(400);
    try {
      const service = serviceClient();
      const nonceHash = createHash("sha256").update(nonce).digest("hex");
      const preflight = await service.rpc("cueva_preflight", { p_generation: 1, p_nonce_hash: nonceHash });
      if (preflight.error || preflight.data !== true) return fail(409);
      // Verify this exact JWT with Auth before reading its authentication method.
      // The service client is stateless: rejected tokens never become SSR cookies.
      const verified = await service.auth.getUser(accessToken);
      if (verified.error || !verified.data.user || verified.data.user.email?.toLowerCase() !== cfg.expectedOwner) return fail(401);
      let claims: { sub?: unknown; session_id?: unknown; amr?: unknown };
      try { claims = JSON.parse(Buffer.from(accessToken.split(".")[1] ?? "", "base64url").toString()); } catch { return fail(401); }
      if (claims.sub !== verified.data.user.id || !uuid(claims.session_id) || !Array.isArray(claims.amr) || claims.amr.length !== 1 || claims.amr[0]?.method !== "otp") return fail(401);
      const pending = await pendingUserClient();
      const established = await pending.auth.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      // Reject a refreshed/different JWT; never bind the incoming SID while saving
      // a different normalized SDK session. No pending cookies have been published.
      if (established.error || established.data.user?.id !== verified.data.user.id || established.data.user.email?.toLowerCase() !== cfg.expectedOwner || established.data.session?.access_token !== accessToken) return fail(401);
      const bound = await service.rpc("cueva_bind_session", { p_user: verified.data.user.id, p_generation: 1, p_session: claims.session_id, p_nonce_hash: nonceHash });
      if (bound.error) return fail(503);
      if (bound.data !== true) return fail(409);
      pending.commit();
      return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    } catch { return fail(503); }
  }
  const auth = await userClient();
  const redirect = (path: string) => NextResponse.redirect(new URL(path, cfg.origin), { status: 303, headers: { "Cache-Control": "no-store" } });
  if (operation === "ingresar") {
    const { error } = await auth.auth.signInWithPassword({ email: String(form.get("email") ?? ""), password: String(form.get("password") ?? "") });
    return error ? fail(401) : redirect("/cuenta");
  }
  if (operation === "salir") { const { error } = await auth.auth.signOut(); return error ? fail(503) : redirect("/ingresar"); }
  const service = serviceClient();
  if (operation === "admin-invitar" || operation === "admin-recuperar") {
    if (cfg.ownerOnly) return fail(503);
    const current = await auth.auth.getUser();
    if (current.error || !current.data.user) return fail(401);
    const own = await auth.from("cueva_profiles").select("role").maybeSingle();
    if (own.error || own.data?.role !== "admin") return fail(403);
    const nonce = randomBytes(32).toString("hex"), nonceHash = createHash("sha256").update(nonce).digest("hex");
    if (operation === "admin-invitar") {
      const email = String(form.get("email") ?? "").trim();
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(400);
      const url = new URL("/aceptar-invitacion", cfg.origin);
      url.search = new URLSearchParams({ nonce, generation: "1", type: "invite" }).toString();
      const invited = await service.auth.admin.inviteUserByEmail(email, { redirectTo: url.href });
      if (invited.error || !invited.data.user || !uuid(invited.data.user.id)) return fail(503);
      const prepared = await service.rpc("cueva_prepare_invitation", { p_user: invited.data.user.id, p_nonce_hash: nonceHash });
      // Ambiguous failures require trusted reconciliation; never resend blindly.
      return prepared.error || prepared.data !== true ? fail(503) : redirect("/cuenta");
    }
    const target = String(form.get("user_id") ?? "");
    if (!uuid(target)) return fail(400);
    const targetProfile = await service.from("cueva_profiles").select("role").eq("user_id", target).maybeSingle();
    if (targetProfile.error || targetProfile.data?.role !== "alumno") return fail(403);
    const op = randomUUID();
    const begin = await service.rpc("cueva_begin_operation", { p_user: target, p_operation: op, p_kind: "reset", p_session: null });
    if (begin.error || typeof begin.data !== "number") return fail(409);
    const prepared = await service.rpc("cueva_prepare_recovery", { p_user: target, p_operation: op, p_generation: begin.data, p_nonce_hash: nonceHash });
    if (prepared.error || prepared.data !== true) return fail(503);
    const targetUser = await service.auth.admin.getUserById(target);
    if (targetUser.error || !targetUser.data.user?.email) return fail(503);
    const url = new URL("/aceptar-invitacion", cfg.origin);
    url.search = new URLSearchParams({ nonce, generation: String(begin.data), type: "recovery" }).toString();
    const sent = await auth.auth.resetPasswordForEmail(targetUser.data.user.email, { redirectTo: url.href });
    if (sent.error) return fail(503);
    const done = await service.rpc("cueva_finish_operation", { p_user: target, p_operation: op, p_generation: begin.data, p_session: null });
    return done.error || done.data !== true ? fail(503) : redirect("/cuenta");
  }
  if (operation === "invitacion") {
    if (cfg.ownerOnly) return fail(404);
    const token = String(form.get("token") ?? ""), nonce = String(form.get("nonce") ?? ""), gen = String(form.get("generation") ?? ""), type = form.get("type");
    if (!/^[0-9a-f]{64}$/i.test(nonce) || !/^[1-9]\d{0,14}$/.test(gen) || (type !== "invite" && type !== "recovery")) return fail(400);
    const nonceHash = createHash("sha256").update(nonce).digest("hex");
    const preflight = await service.rpc("cueva_preflight", { p_generation: Number(gen), p_nonce_hash: nonceHash });
    if (preflight.error || preflight.data !== true) return new Response("El enlace aún no está disponible o venció. Volvé al correo y probá nuevamente en unos minutos.", { status: 409, headers: { "Cache-Control": "no-store" } });
    const verified = await auth.auth.verifyOtp({ token_hash: token, type });
    if (verified.error || !verified.data.user || !verified.data.session) return fail(400);
    let claims: { sub?: string; session_id?: string };
    try { claims = JSON.parse(Buffer.from(verified.data.session.access_token.split(".")[1] ?? "", "base64url").toString()); } catch { return fail(400); }
    if (claims.sub !== verified.data.user.id || !uuid(claims.session_id)) return fail(400);
    const bound = await service.rpc("cueva_bind_session", { p_user: verified.data.user.id, p_generation: Number(gen), p_session: claims.session_id, p_nonce_hash: nonceHash });
    if (bound.error || bound.data !== true) { await auth.auth.signOut(); return fail(400); }
    return redirect("/crear-contrasena");
  }
  if (operation !== "contrasena") return fail(404);
  const password = String(form.get("password") ?? "");
  if (password.length < 8 || password.length > 1024) return fail(400);
  const userResult = await auth.auth.getUser(), session = await auth.auth.getSession();
  const token = session.data.session?.access_token, user = userResult.data.user;
  if (userResult.error || !user || !token) return fail(401);
  let claims: { sub?: string; session_id?: string };
  try { claims = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString()); } catch { return fail(401); }
  if (claims.sub !== user.id || !uuid(claims.session_id)) return fail(401);
  const op = randomUUID();
  const begin = await service.rpc("cueva_begin_operation", { p_user: user.id, p_operation: op, p_kind: "activate", p_session: claims.session_id });
  if (begin.error || typeof begin.data !== "number") return fail(409);
  // Any failure after acquisition is deliberately left locked for trusted recovery.
  const changed = await auth.auth.updateUser({ password });
  if (changed.error || changed.data.user?.id !== user.id) return fail(503);
  const again = await auth.auth.getUser();
  if (again.error || again.data.user?.id !== user.id) return fail(503);
  const done = await service.rpc("cueva_finish_operation", { p_user: user.id, p_operation: op, p_generation: begin.data, p_session: claims.session_id });
  return done.error || done.data !== true ? fail(503) : redirect("/cuenta");
}
