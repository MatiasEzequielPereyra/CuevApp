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
  const q = (params.get("q") ?? "").trim().slice(0, 120).replace(/[\\%_]/g, "\\$&");
  let query = client.from("cueva_exercises").select("id,name,active,revision").order("name").limit(101);
  if (params.get("active") === "1") query = query.eq("active", true);
  if (q) query = query.ilike("name", `%${q}%`);
  const { data, error } = await query;
  return error ? reply({ message: "No pudimos cargar el catálogo." }, 503) : reply({ exercises: data });
}
export async function POST(req: Request) {
  const cfg = productConfig();
  if (!cfg || req.headers.get("origin") !== cfg.origin) return reply({ message: "Solicitud no permitida." }, 403);
  const client = await studentAdmin();
  if (!client) return reply({ message: "Acceso restringido." }, 403);
  const p = await readRoutineJson(req, 4096);
  if (!p || typeof p.id !== "string" || !uuid.test(p.id) || typeof p.name !== "string" || !p.name.trim() || p.name.length > 120 || p.name.includes("\0") || typeof p.active !== "boolean" || !Number.isInteger(p.revision) || p.revision < 0 || p.revision > 2147483646) return reply({ message: "Revisá el nombre (hasta 120 caracteres)." }, 400);
  const { data, error } = await client.rpc("cueva_exercise_write", { p_id: p.id, p_name: p.name, p_active: p.active, p_revision: p.revision });
  if (error) return reply({ message: error.code === "23505" ? "Ya existe un ejercicio con ese nombre. Buscalo en el catálogo." : error.code === "40001" ? "El ejercicio cambió en otra ventana. Conservamos tu edición; consultá la versión actual antes de reemplazarla." : "No se pudo guardar el ejercicio. Tu edición se conserva." }, ["23505", "40001"].includes(error.code) ? 409 : error.code === "42501" ? 403 : 503);
  return reply({ exercise: data });
}
