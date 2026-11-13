type Student = { userId: string };

type Dependencies = {
  sameOrigin(request: Request): boolean;
  requireStudent(): Promise<Student | null>;
  markRead(student: Student, notificationId: string): Promise<"updated" | "not_found" | "error">;
};

const headers = { "Cache-Control": "private, no-store" };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function reply(data: object, status = 200) {
  return Response.json(data, { status, headers });
}

async function readNotificationId(request: Request): Promise<string | null> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return null;
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null
    && (!/^\\d+$/.test(declaredLength) || Number(declaredLength) > 256)) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;

  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 256) {
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
    const input: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!input || typeof input !== "object" || Array.isArray(input)) return null;
    const id = (input as Record<string, unknown>).id;
    return typeof id === "string" && uuidPattern.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function createNotificationInboxHandlers(dependencies: Dependencies) {
  return {
    async PATCH(request: Request) {
      if (!dependencies.sameOrigin(request)) {
        return reply({ message: "Solicitud no permitida." }, 403);
      }

      const notificationId = await readNotificationId(request);
      if (!notificationId) {
        return reply({ message: "Aviso inválido." }, 400);
      }

      try {
        const student = await dependencies.requireStudent();
        if (!student) return reply({ message: "Acceso restringido." }, 403);

        const result = await dependencies.markRead(student, notificationId);
        if (result === "not_found") return reply({ message: "Aviso no encontrado." }, 404);
        if (result === "error") return reply({ message: "No pudimos actualizar el aviso." }, 503);
        return reply({ read: true, readAt: new Date().toISOString() });
      } catch {
        return reply({ message: "No pudimos actualizar el aviso." }, 503);
      }
    },
  };
}
