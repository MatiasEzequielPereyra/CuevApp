import { parsePushEndpoint, parsePushSubscription } from "./push-subscription.ts";

type Student = { studentId: string; auth: unknown; db: unknown };
type Dependencies = {
  sameOrigin(request: Request): boolean;
  requireStudent(): Promise<Student | null>;
  readPreference(student: Student): Promise<{ pushEnabled: boolean } | null>;
  updatePreference(student: Student, enabled: boolean): Promise<boolean>;
  registerSubscription(student: Student, subscription: NonNullable<ReturnType<typeof parsePushSubscription>>): Promise<"registered" | "updated" | "limit_reached" | "endpoint_in_use" | "student_not_found" | "error">;
  removeSubscription(student: Student, endpoint: string): Promise<"removed" | "error">;
  isAvailable(): boolean;
  publicKey(): string;
};

const headers = { "Cache-Control": "private, no-store" };
const reply = (data: object, status = 200) => Response.json(data, { status, headers });

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

export function createPushRouteHandlers(deps: Dependencies) {
  return {
    async GET() {
      try {
        const student = await deps.requireStudent();
        if (!student) return reply({ message: "Acceso restringido." }, 403);
        const preference = await deps.readPreference(student);
        if (!preference) return reply({ message: "No pudimos cargar las preferencias." }, 503);
        const available = deps.isAvailable();
        return reply({
          pushEnabled: preference.pushEnabled !== false,
          available,
          publicKey: available ? deps.publicKey() : null,
        });
      } catch {
        return reply({ message: "No pudimos cargar las preferencias." }, 503);
      }
    },

    async PUT(request: Request) {
      if (!deps.sameOrigin(request)) return reply({ message: "Solicitud no permitida." }, 403);
      const input = await readJson(request, 256);
      if (!input || typeof input !== "object" || Array.isArray(input)
        || typeof (input as Record<string, unknown>).enabled !== "boolean") {
        return reply({ message: "Preferencia inválida." }, 400);
      }
      try {
        const student = await deps.requireStudent();
        if (!student) return reply({ message: "Acceso restringido." }, 403);
        const updated = await deps.updatePreference(student, (input as { enabled: boolean }).enabled);
        if (!updated) return reply({ message: "No pudimos actualizar la preferencia." }, 503);
        return reply({ pushEnabled: (input as { enabled: boolean }).enabled });
      } catch {
        return reply({ message: "No pudimos actualizar la preferencia." }, 503);
      }
    },

    async POST(request: Request) {
      if (!deps.sameOrigin(request)) return reply({ message: "Solicitud no permitida." }, 403);
      const input = await readJson(request, 8192);
      const parsed = parsePushSubscription(input);
      if (!parsed) return reply({ message: "La suscripción del dispositivo no es válida." }, 400);
      try {
        const student = await deps.requireStudent();
        if (!student) return reply({ message: "Acceso restringido." }, 403);
        const outcome = await deps.registerSubscription(student, parsed);
        if (outcome === "limit_reached") return reply({ message: "Alcanzaste el máximo de dispositivos registrados." }, 409);
        if (outcome === "endpoint_in_use") return reply({ message: "Este dispositivo ya está vinculado a otra cuenta." }, 409);
        if (outcome === "student_not_found" || outcome === "error") return reply({ message: "No pudimos registrar el dispositivo." }, 503);
        if (outcome !== "registered" && outcome !== "updated") return reply({ message: "No pudimos registrar el dispositivo." }, 503);
        if (!await deps.updatePreference(student, true)) {
          return reply({ message: "El dispositivo quedó registrado, pero no pudimos activar la preferencia." }, 503);
        }
        return reply({ registered: true });
      } catch {
        return reply({ message: "No pudimos registrar el dispositivo." }, 503);
      }
    },

    async DELETE(request: Request) {
      if (!deps.sameOrigin(request)) return reply({ message: "Solicitud no permitida." }, 403);
      const input = await readJson(request, 4096);
      const endpoint = input && typeof input === "object" && !Array.isArray(input)
        ? parsePushEndpoint((input as Record<string, unknown>).endpoint)
        : null;
      if (!endpoint) return reply({ message: "Dispositivo inválido." }, 400);
      try {
        const student = await deps.requireStudent();
        if (!student) return reply({ message: "Acceso restringido." }, 403);
        const outcome = await deps.removeSubscription(student, endpoint);
        return outcome === "error"
          ? reply({ message: "No pudimos desvincular el dispositivo." }, 503)
          : reply({ removed: true });
      } catch {
        return reply({ message: "No pudimos desvincular el dispositivo." }, 503);
      }
    },
  };
}
