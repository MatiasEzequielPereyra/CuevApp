import { NextResponse } from "next/server";
import { studentAdmin } from "@/lib/students/server";
import { productConfig } from "@/lib/product-auth/server";
import { readRoutineJson } from "@/lib/routines/request";
import { youtubeUrl } from "@/lib/routines/video";
import { uuid } from "@/lib/routines/types";
const reply = (data: object, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
export async function GET(req: Request) {
  const client = await studentAdmin();
  if (!client) return reply({ message: "Acceso restringido." }, 403);
  const params = new URL(req.url).searchParams;
  const q = (params.get("q") ?? "").trim().slice(0, 120).replace(/[\\%_]/g, "\\$&");
  const offset = Number(params.get("offset") ?? 0);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1000000) return reply({ message: "Página inválida." }, 400);
  let query = client.from("cueva_exercises").select("id,name,active,revision,description,video_url,video_path").order("name").order("id").range(offset, offset + 100);
  if (params.get("active") === "1") query = query.eq("active", true);
  if (q) query = query.ilike("name", `%${q}%`);
  const { data, error } = await query;
  return error ? reply({ message: "No pudimos cargar el catálogo." }, 503) : reply({ exercises: data?.slice(0, 100), next: (data?.length ?? 0) > 100 ? offset + 100 : null });
}
export async function POST(req: Request) {
  const cfg = productConfig();
  if (!cfg || req.headers.get("origin") !== cfg.origin) return reply({ message: "Solicitud no permitida." }, 403);
  const client = await studentAdmin();
  if (!client) return reply({ message: "Acceso restringido." }, 403);
  const p = await readRoutineJson(req, 12000);
  if (!p || typeof p.id !== "string" || !uuid.test(p.id) || typeof p.name !== "string" || !p.name.trim() || p.name.length > 120 || p.name.includes("\0") || typeof p.active !== "boolean" || !Number.isInteger(p.revision) || p.revision < 0 || p.revision > 2147483646) return reply({ message: "Revisá el nombre (hasta 120 caracteres)." }, 400);
  if (typeof p.description !== "string" || p.description.length > 2000 || p.description.includes("\0") || (p.video_url !== null && (typeof p.video_url !== "string" || !youtubeUrl(p.video_url)))) return reply({ message: "Revisá la descripción y el enlace HTTPS de YouTube sin parámetros adicionales." }, 400);
  if (p.video_path !== null && (typeof p.video_path !== "string" || p.video_path.length > 100)) return reply({ message: "Archivo inválido." }, 400);
  const { data, error } = await client.rpc("cueva_exercise_write", { p_id: p.id, p_name: p.name, p_active: p.active, p_revision: p.revision, p_description: p.description, p_video_url: p.video_url, p_video_path: p.video_path });
  if (error) return reply({ message: error.code === "23505" ? "Ya existe un ejercicio con ese nombre. Buscalo en el catálogo." : error.code === "40001" ? "El ejercicio cambió en otra ventana. Conservamos tu edición; consultá la versión actual antes de reemplazarla." : "No se pudo guardar el ejercicio. Tu edición se conserva." }, ["23505", "40001"].includes(error.code) ? 409 : error.code === "42501" ? 403 : error.code.startsWith("22") || error.code === "23514" ? 400 : 503);
  return reply({ exercise: data });
}
