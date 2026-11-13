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
  try {
    const body = await request.text();
    if (body.length > 256) return null;
    const input: unknown = JSON.parse(body);
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
