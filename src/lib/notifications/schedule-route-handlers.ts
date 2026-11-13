type Dependencies = {
  sameOrigin(request: Request): boolean;
  requireAdmin(): Promise<boolean>;
  updateSchedule(sendTime: string): Promise<string | null>;
};

const headers = { "Cache-Control": "private, no-store" };
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function reply(data: object, status = 200) {
  return Response.json(data, { status, headers });
}

async function readSendTime(request: Request): Promise<string | null> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return null;
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null
    && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > 256)) return null;
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
    const sendTime = (input as Record<string, unknown>).sendTime;
    return typeof sendTime === "string" && timePattern.test(sendTime) ? sendTime : null;
  } catch {
    return null;
  }
}

export function createNotificationScheduleHandlers(dependencies: Dependencies) {
  return {
    async PATCH(request: Request) {
      if (!dependencies.sameOrigin(request)) {
        return reply({ message: "Solicitud no permitida." }, 403);
      }
      const sendTime = await readSendTime(request);
      if (!sendTime) return reply({ message: "Horario inválido." }, 400);

      try {
        if (!await dependencies.requireAdmin()) {
          return reply({ message: "Acceso restringido." }, 403);
        }
        const updated = await dependencies.updateSchedule(sendTime);
        if (!updated) return reply({ message: "No pudimos actualizar el horario." }, 503);
        return reply({ sendTime: updated.slice(0, 5) });
      } catch {
        return reply({ message: "No pudimos actualizar el horario." }, 503);
      }
    },
  };
}
