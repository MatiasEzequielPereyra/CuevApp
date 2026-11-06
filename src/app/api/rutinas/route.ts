import { NextResponse } from "next/server";
import { studentAdmin } from "@/lib/students/server";
import { productConfig } from "@/lib/product-auth/server";
import { uuid } from "@/lib/routines/types";

const reply = (data: object, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(req: Request) {
  const client = await studentAdmin();
  if (!client) return reply({ message: "Acceso restringido." }, 403);
  const params = new URL(req.url).searchParams;
  const id = params.get("id") ?? "";
  if (!uuid.test(id)) return reply({ message: "Identificador inválido." }, 400);
  const template = params.get("kind") === "template";
  const { data, error } = await client.from(template ? "cueva_routine_templates" : "cueva_routine_drafts")
    .select(template ? "content,revision,title" : "content,revision").eq(template ? "id" : "student_id", id).maybeSingle();
  if (error) return reply({ message: "No pudimos cargar la revisión. Tu texto sigue en el editor." }, 503);
  return reply({ note: data ?? { content: "", revision: 0, ...(template ? { title: "" } : {}) } });
}

export async function POST(req: Request) {
  const cfg = productConfig();
  if (!cfg) return reply({ message: "Acceso no disponible." }, 404);
  if (req.headers.get("origin") !== cfg.origin) return reply({ message: "Solicitud no permitida." }, 403);
  const client = await studentAdmin();
  if (!client) return reply({ message: "Acceso restringido." }, 403);
  if (!req.headers.get("content-type")?.startsWith("application/json")) return reply({ message: "Formato inválido." }, 415);
  const reader = req.body?.getReader();
  if (!reader) return reply({ message: "Datos inválidos." }, 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 180000) { await reader.cancel(); return reply({ message: "Texto demasiado extenso." }, 413); }
    chunks.push(value);
  }
  let p;
  try { p = JSON.parse(new TextDecoder().decode(Buffer.concat(chunks))); }
  catch { return reply({ message: "Datos inválidos." }, 400); }
  if (!p || !["draft", "template", "publish"].includes(p.kind) || typeof p.id !== "string" || !uuid.test(p.id)
    || typeof p.operation !== "string" || !uuid.test(p.operation) || !Number.isInteger(p.revision) || p.revision < 0 || p.revision > 2147483646
    || typeof p.content !== "string" || p.content.length > 40000 || p.content.includes("\0")
    || (p.kind === "template" && (typeof p.title !== "string" || !p.title.trim() || p.title.length > 100 || p.title.includes("\0")))) {
    return reply({ message: "Revisá el contenido y el título (hasta 40.000 caracteres)." }, 400);
  }
  const { data, error } = await client.rpc("cueva_routine_write", {
    p_kind: p.kind, p_id: p.id, p_revision: p.revision, p_content: p.content,
    p_title: p.kind === "template" ? p.title : null, p_operation: p.operation,
  });
  if (error) {
    if (error.code === "40001") return reply({ message: "Hay cambios en otra ventana. Tu texto se conserva. Compará las versiones antes de guardar.", conflict: true }, 409);
    if (error.code === "42501") return reply({ message: "Acceso restringido." }, 403);
    if (error.code === "22023") return reply({ message: "No se pudo publicar o guardar: revisá los datos actuales." }, 400);
    return reply({ message: "No se pudo guardar. Tu texto sigue en el editor; reintentá sin cerrar esta página." }, 503);
  }
  return reply({ note: data });
}
