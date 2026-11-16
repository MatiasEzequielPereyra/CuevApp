import { NextResponse } from "next/server";
import { studentAdmin } from "@/lib/students/server";
import { productConfig } from "@/lib/product-auth/server";
import { readRoutineJson } from "@/lib/routines/request";
import { uuid } from "@/lib/routines/types";

const reply = (data: object, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(req: Request) {
  const client = await studentAdmin();
  if (!client) return reply({ message: "Acceso restringido." }, 403);
  const params = new URL(req.url).searchParams;
  if (params.get("templates") === "1") {
    const offset = Number(params.get("offset") ?? 0);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1000000) return reply({ message: "Página inválida." }, 400);
    const { data, error } = await client.from("cueva_routine_templates").select("id,title,content,revision,plan").order("title").order("id").range(offset, offset + 100);
    if (error) return reply({ message: "No pudimos cargar las plantillas." }, 503);
    const rows = data?.slice(0, 100) ?? [];
    const textResult = rows.length ? await client.from("cueva_routine_text_drafts")
      .select("owner_id,format,text_content,block_content,mentions")
      .eq("kind", "template").in("owner_id", rows.map(item => item.id)) : { data: [], error: null };
    if (textResult.error) return reply({ message: "No pudimos cargar las plantillas." }, 503);
    const textById = new Map((textResult.data ?? []).map(item => [item.owner_id, item]));
    const templates = rows.map(item => {
      const text = textById.get(item.id);
      return {
        ...item,
        content: text?.block_content ?? item.content,
        format: text?.format ?? "blocks",
        text_content: text?.text_content ?? "",
        mentions: text?.mentions ?? [],
      };
    });
    return reply({ templates, more: (data?.length ?? 0) > 100 });
  }
  const id = params.get("id") ?? "";
  if (!uuid.test(id)) return reply({ message: "Identificador inválido." }, 400);
  const template = params.get("kind") === "template";
  type RoutineRow = { content: string; revision: number; plan?: unknown; title?: string };
  const routineQuery = async (): Promise<{ data: RoutineRow | null; error: unknown }> => {
    if (template) {
      const result = await client.from("cueva_routine_templates")
        .select("content,revision,title,plan").eq("id", id).maybeSingle();
      return { data: result.data as RoutineRow | null, error: result.error };
    }
    const result = await client.from("cueva_routine_drafts")
      .select("content,revision,plan").eq("student_id", id).maybeSingle();
    return { data: result.data as RoutineRow | null, error: result.error };
  };
  const [routineResult, textResult] = await Promise.all([
    routineQuery(),
    client.from("cueva_routine_text_drafts")
      .select("format,text_content,block_content,mentions,revision")
      .eq("kind", template ? "template" : "draft").eq("owner_id", id).maybeSingle(),
  ]);
  if (routineResult.error || textResult.error) return reply({ message: "No pudimos cargar la revisión. Tu texto sigue en el editor." }, 503);
  const data = routineResult.data;
  const textDocument = textResult.data;
  return reply({ note: {
    ...(data ?? { content: "", revision: 0, ...(template ? { title: "" } : {}) }),
    content: textDocument?.block_content ?? data?.content ?? "",
    format: textDocument?.format ?? "blocks",
    text_content: textDocument?.text_content ?? "",
    mentions: textDocument?.mentions ?? [],
  } });
}

export async function POST(req: Request) {
  const cfg = productConfig();
  if (!cfg) return reply({ message: "Acceso no disponible." }, 404);
  if (req.headers.get("origin") !== cfg.origin) return reply({ message: "Solicitud no permitida." }, 403);
  const client = await studentAdmin();
  if (!client) return reply({ message: "Acceso restringido." }, 403);
  const p = await readRoutineJson(req);
  if (!p || !["draft", "template", "publish"].includes(p.kind) || typeof p.id !== "string" || !uuid.test(p.id)
    || typeof p.operation !== "string" || !uuid.test(p.operation) || !Number.isInteger(p.revision) || p.revision < 0 || p.revision > 2147483646
    || typeof p.content !== "string" || p.content.length > 40000 || p.content.includes("\0")
    || (p.kind === "template" && (typeof p.title !== "string" || !p.title.trim() || p.title.length > 100 || p.title.includes("\0")))) {
    return reply({ message: "Revisá el contenido y el título (hasta 40.000 caracteres)." }, 400);
  }
  const { data, error } = await client.rpc("cueva_routine_text_write", {
    p_kind: p.kind, p_id: p.id, p_revision: p.revision, p_content: p.content,
    p_title: p.kind === "template" ? p.title : null, p_operation: p.operation, p_plan: p.plan ?? null,
    p_format: p.format ?? "blocks", p_text_content: p.text_content ?? "", p_mentions: p.mentions ?? [],
  });
  if (error) {
    if (error.code === "40001") return reply({ message: "Hay cambios en otra ventana. Tu texto se conserva. Compará las versiones antes de guardar.", conflict: true }, 409);
    if (error.code === "42501") return reply({ message: "Acceso restringido." }, 403);
    if ((error.code.startsWith("22") || error.code === "23514")) return reply({ message: "Revisá días, vueltas (1–30), repeticiones (10 o 8-12), peso (0–2000 kg), tiempo y ejercicios activos. Tu borrador se conserva." }, 400);
    return reply({ message: "No se pudo guardar. Tu texto sigue en el editor; reintentá sin cerrar esta página." }, 503);
  }
  return reply({ note: data });
}
