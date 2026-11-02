import { NextResponse } from "next/server";
import pg from "pg";
import { client, config } from "@/lib/lab-auth/server";

export const dynamic = "force-dynamic";
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
const fail = (status: number, text: string) => new Response(text, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request, { params }: { params: Promise<{operation: string}> }) {
  const cfg = config();
  if (!cfg) return fail(404, "No disponible");
  if (req.headers.get("origin") !== cfg.origin) return fail(403, "Acceso denegado");
  const length = Number(req.headers.get("content-length") ?? "0");
  if (!Number.isFinite(length) || length > 8192) return fail(413, "Solicitud demasiado grande");
  const { operation } = await params;
  const form = await req.formData();
  const auth = await client();
  const redirect = (path: string) => NextResponse.redirect(new URL(path, cfg.origin), { status: 303, headers: { "Cache-Control": "no-store" } });
  if (operation === "invite") {
    const { error } = await auth.auth.verifyOtp({ type: "invite", token_hash: String(form.get("token") ?? "") });
    return error ? fail(400, "Invitación inválida o vencida") : redirect("/laboratorio/password");
  }
  if (operation === "login") {
    const { error } = await auth.auth.signInWithPassword({ email: String(form.get("email") ?? ""), password: String(form.get("password") ?? "") });
    return redirect(error ? "/laboratorio/error" : "/laboratorio/data");
  }
  if (operation === "logout") { const { error } = await auth.auth.signOut(); return error ? fail(503, "No se pudo cerrar sesión") : redirect("/laboratorio/login"); }
  if (operation !== "password") return fail(404, "No disponible");
  const password = String(form.get("password") ?? "");
  if (password.length < 8 || password.length > 1024) return fail(400, "Contraseña inválida");
  const userResult = await auth.auth.getUser();
  const sessionResult = await auth.auth.getSession();
  const token = sessionResult.data.session?.access_token;
  const user = userResult.data.user;
  if (userResult.error || !user || !uuid(user.id) || !token) return fail(401, "Sesión inválida");
  let claims: { sub?: string; session_id?: string };
  try { claims = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString()); } catch { return fail(401, "Sesión inválida"); }
  if (claims.sub !== user.id || !uuid(claims.session_id)) return fail(401, "Sesión inválida");
  const db = new pg.Client({ host: "127.0.0.1", port: cfg.port, database: "postgres", user: "cueva_coordinator", password: cfg.password, connectionTimeoutMillis: 5000 });
  try {
    await db.connect();
    await db.query("select pg_advisory_lock(hashtextextended($1,42))", [user.id]);
    const again = await auth.auth.getUser();
    if (again.error || again.data.user?.id !== user.id) return fail(401, "Sesión inválida");
    const pending = await db.query("select private.pending($1) as generation", [user.id]);
    if (!pending.rows[0]?.generation) return fail(409, "Solicitud ya utilizada");
    const changed = await auth.auth.updateUser({ password });
    if (changed.error || changed.data.user?.id !== user.id) return fail(400, "No se pudo guardar la contraseña");
    const still = await auth.auth.getUser();
    if (still.error || still.data.user?.id !== user.id) return fail(401, "Sesión inválida");
    const activated = await db.query("select private.activate($1,$2,$3) as ok", [user.id, pending.rows[0].generation, claims.session_id]);
    return activated.rows[0]?.ok ? redirect("/laboratorio/data") : fail(409, "Acceso no habilitado");
  } catch { return fail(503, "Servicio no disponible"); } finally { await db.end().catch(() => {}); }
}
