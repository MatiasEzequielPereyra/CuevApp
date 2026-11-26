import { productConfig } from "@/lib/product-auth/server";
import { studentAdmin } from "@/lib/students/server";
import { readJson } from "@/lib/notifications/push-route-handlers";
import { uuid } from "@/lib/routines/types";

const reply = (data: object, status: number) => Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(request: Request) {
  const config = productConfig();
  if (!config || request.headers.get("origin") !== config.origin) return reply({ message: "Solicitud no permitida." }, 403);

  const input = await readJson(request, 8192);
  if (!input || typeof input !== "object" || Array.isArray(input)) return reply({ message: "Revisá el título y el mensaje." }, 400);
  const { id, title, body } = input as Record<string, unknown>;
  if (typeof id !== "string" || !uuid.test(id) || typeof title !== "string" || !title.trim() || title.length > 120
    || typeof body !== "string" || !body.trim() || body.length > 500 || title.includes("\0") || body.includes("\0")) {
    return reply({ message: "Ingresá un título de hasta 120 caracteres y un mensaje de hasta 500." }, 400);
  }

  try {
    const client = await studentAdmin();
    if (!client) return reply({ message: "Acceso restringido." }, 403);
    const { data, error } = await client.rpc("cueva_send_student_broadcast", {
      p_request_id: id, p_title: title.trim(), p_body: body.trim(),
    });
    if (error?.code === "42501") return reply({ message: "Acceso restringido." }, 403);
    if (error?.code === "23505") return reply({ message: "Este intento ya corresponde a otro comunicado." }, 409);
    if (!error && Number.isSafeInteger(data?.recipients) && data.recipients >= 0
      && Number.isSafeInteger(data?.devices) && data.devices >= 0) {
      return reply({ recipients: data.recipients, devices: data.devices }, 202);
    }
  } catch { /* Leave the request eligible for an idempotent retry. */ }
  return reply({ message: "No pudimos confirmar el envío. Podés reintentar con el mismo mensaje." }, 503);
}
