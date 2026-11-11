import { serviceClient, productConfig, userClient } from "@/lib/product-auth/server";
import { parsePushEndpoint, parsePushSubscription } from "@/lib/notifications/push-subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store" };
const reply = (data: object, status = 200) => Response.json(data, { status, headers });

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

async function readJson(request: Request, maxBytes: number): Promise<unknown | null> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return null;
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return null;
  }
}

function sameOrigin(request: Request): boolean {
  const cfg = productConfig();
  return !!cfg && request.headers.get("origin") === cfg.origin;
}

export async function GET() {
  try {
    const student = await requireStudent();
    if (!student) return reply({ message: "Acceso restringido." }, 403);
    const { data, error } = await student.auth.from("cueva_notification_preferences")
      .select("push_enabled")
      .eq("student_id", student.studentId)
      .maybeSingle();
    if (error || !data) return reply({ message: "No pudimos cargar las preferencias." }, 503);

    const publicKey = process.env.CUEVA_VAPID_PUBLIC_KEY ?? "";
    const validPublicKey = /^[A-Za-z0-9_-]+$/.test(publicKey)
      && Buffer.from(publicKey, "base64url").length === 65
      && Buffer.from(publicKey, "base64url")[0] === 4;
    return reply({
      pushEnabled: data.push_enabled !== false,
      available: validPublicKey,
      publicKey: validPublicKey ? publicKey : null,
    });
  } catch {
    return reply({ message: "No pudimos cargar las preferencias." }, 503);
  }
}

export async function PUT(request: Request) {
  if (!sameOrigin(request)) return reply({ message: "Solicitud no permitida." }, 403);
  const input = await readJson(request, 256);
  if (!input || typeof input !== "object" || Array.isArray(input)
    || typeof (input as Record<string, unknown>).enabled !== "boolean") {
    return reply({ message: "Preferencia inválida." }, 400);
  }
  try {
    const student = await requireStudent();
    if (!student) return reply({ message: "Acceso restringido." }, 403);
    const enabled = (input as { enabled: boolean }).enabled;
    const { data, error } = await student.db.from("cueva_notification_preferences")
      .update({ push_enabled: enabled })
      .eq("student_id", student.studentId)
      .select("push_enabled")
      .maybeSingle();
    if (error || !data) return reply({ message: "No pudimos actualizar la preferencia." }, 503);
    return reply({ pushEnabled: data.push_enabled === true });
  } catch {
    return reply({ message: "No pudimos actualizar la preferencia." }, 503);
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply({ message: "Solicitud no permitida." }, 403);
  const input = await readJson(request, 8192);
  const parsed = parsePushSubscription(input);
  if (!parsed) return reply({ message: "La suscripción del dispositivo no es válida." }, 400);

  try {
    const student = await requireStudent();
    if (!student) return reply({ message: "Acceso restringido." }, 403);

    const existing = await student.db.from("cueva_push_subscriptions")
      .select("id,student_id")
      .eq("endpoint", parsed.endpoint)
      .maybeSingle();
    if (existing.error) return reply({ message: "No pudimos registrar el dispositivo." }, 503);
    if (existing.data && existing.data.student_id !== student.studentId) {
      return reply({ message: "Este dispositivo ya está vinculado a otra cuenta." }, 409);
    }

    if (existing.data) {
      const { error } = await student.db.from("cueva_push_subscriptions")
        .update({
          p256dh: parsed.p256dh,
          auth_secret: parsed.authSecret,
          expires_at: parsed.expiresAt,
          revoked_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.data.id)
        .eq("student_id", student.studentId);
      if (error) return reply({ message: "No pudimos actualizar el dispositivo." }, 503);
    } else {
      const active = await student.db.from("cueva_push_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("student_id", student.studentId)
        .is("revoked_at", null);
      if (active.error) return reply({ message: "No pudimos validar los dispositivos registrados." }, 503);
      if ((active.count ?? 0) >= 10) return reply({ message: "Alcanzaste el máximo de dispositivos registrados." }, 409);

      const inserted = await student.db.from("cueva_push_subscriptions").insert({
        student_id: student.studentId,
        endpoint: parsed.endpoint,
        p256dh: parsed.p256dh,
        auth_secret: parsed.authSecret,
        expires_at: parsed.expiresAt,
      });
      if (inserted.error?.code === "23505") {
        const raced = await student.db.from("cueva_push_subscriptions")
          .select("id,student_id")
          .eq("endpoint", parsed.endpoint)
          .maybeSingle();
        if (raced.error || !raced.data || raced.data.student_id !== student.studentId) {
          return reply({ message: "Este dispositivo ya está vinculado a otra cuenta." }, 409);
        }
        const updated = await student.db.from("cueva_push_subscriptions")
          .update({
            p256dh: parsed.p256dh,
            auth_secret: parsed.authSecret,
            expires_at: parsed.expiresAt,
            revoked_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", raced.data.id)
          .eq("student_id", student.studentId);
        if (updated.error) return reply({ message: "No pudimos actualizar el dispositivo." }, 503);
      } else if (inserted.error) {
        return reply({ message: "No pudimos registrar el dispositivo." }, 503);
      }
    }

    const preference = await student.db.from("cueva_notification_preferences")
      .update({ push_enabled: true })
      .eq("student_id", student.studentId);
    if (preference.error) return reply({ message: "El dispositivo quedó registrado, pero no pudimos activar la preferencia." }, 503);
    return reply({ registered: true });
  } catch {
    return reply({ message: "No pudimos registrar el dispositivo." }, 503);
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return reply({ message: "Solicitud no permitida." }, 403);
  const input = await readJson(request, 4096);
  const endpoint = input && typeof input === "object" && !Array.isArray(input)
    ? parsePushEndpoint((input as Record<string, unknown>).endpoint)
    : null;
  if (!endpoint) return reply({ message: "Dispositivo inválido." }, 400);

  try {
    const student = await requireStudent();
    if (!student) return reply({ message: "Acceso restringido." }, 403);
    const existing = await student.db.from("cueva_push_subscriptions")
      .select("id")
      .eq("endpoint", endpoint)
      .eq("student_id", student.studentId)
      .maybeSingle();
    if (existing.error) return reply({ message: "No pudimos desvincular el dispositivo." }, 503);
    if (!existing.data) return reply({ removed: true });

    const { error } = await student.db.from("cueva_push_subscriptions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", existing.data.id)
      .eq("student_id", student.studentId)
      .is("revoked_at", null);
    return error ? reply({ message: "No pudimos desvincular el dispositivo." }, 503) : reply({ removed: true });
  } catch {
    return reply({ message: "No pudimos desvincular el dispositivo." }, 503);
  }
}
