import { NextResponse } from "next/server";
import { productConfig, userClient } from "@/lib/product-auth/server";
import { readRoutineJson } from "@/lib/routines/request";
import { uuid } from "@/lib/routines/types";

const reply = (data: object, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

async function studentClient() {
  if (!productConfig()) return { client: null, status: 404 };
  const client = await userClient(true);
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return { client: null, status: 401 };
  const profile = await client.from("cueva_profiles").select("role").maybeSingle();
  if (profile.error || profile.data?.role !== "alumno") return { client: null, status: 403 };
  return { client, status: 200 };
}

function validWeight(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
    && value >= 0 && value <= 2000 && Math.abs(value * 100 - Math.round(value * 100)) < 1e-8;
}

export async function GET(req: Request) {
  const { client, status } = await studentClient();
  if (!client) return reply({ message: "Acceso restringido." }, status);
  const exerciseId = new URL(req.url).searchParams.get("exercise_id") ?? "";
  if (!uuid.test(exerciseId)) return reply({ message: "Ejercicio inválido." }, 400);
  const { data, error } = await client.rpc("cueva_workout_history", { p_exercise_id: exerciseId });
  if (error) return reply({ message: "No pudimos cargar el historial del ejercicio." }, error.code === "42501" ? 403 : 503);
  return reply({ history: data });
}

export async function POST(req: Request) {
  const cfg = productConfig();
  if (!cfg) return reply({ message: "Acceso no disponible." }, 404);
  if (req.headers.get("origin") !== cfg.origin) return reply({ message: "Solicitud no permitida." }, 403);
  const { client, status } = await studentClient();
  if (!client) return reply({ message: "Acceso restringido." }, status);
  const p = await readRoutineJson(req, 12000);
  if (!p || typeof p.id !== "string" || !uuid.test(p.id)
    || typeof p.publication_id !== "string" || !uuid.test(p.publication_id)
    || typeof p.exercise_id !== "string" || !uuid.test(p.exercise_id)
    || !(p.target_id === null || p.target_id === undefined || (typeof p.target_id === "string" && uuid.test(p.target_id)))
    || !["quick", "sets"].includes(p.mode)
    || !Array.isArray(p.sets) || p.sets.length > 30) {
    return reply({ message: "Revisá los datos del registro." }, 400);
  }
  if (p.mode === "quick" && (!validWeight(p.weight_kg) || p.sets.length !== 0)) {
    return reply({ message: "Ingresá un peso válido entre 0 y 2000 kg." }, 400);
  }
  if (p.mode === "sets" && (p.weight_kg !== null || p.sets.length < 1
    || p.sets.some((set: unknown) => !set || typeof set !== "object"
      || !Number.isInteger((set as { reps?: unknown }).reps)
      || (set as { reps: number }).reps < 1 || (set as { reps: number }).reps > 1000
      || !validWeight((set as { weight_kg?: unknown }).weight_kg)))) {
    return reply({ message: "Cada serie debe tener repeticiones y un peso válido." }, 400);
  }
  const { data, error } = await client.rpc("cueva_workout_record", {
    p_id: p.id,
    p_publication_id: p.publication_id,
    p_exercise_id: p.exercise_id,
    p_target_id: p.target_id ?? null,
    p_mode: p.mode,
    p_weight_kg: p.mode === "quick" ? p.weight_kg : null,
    p_sets: p.sets,
  });
  if (error) {
    if (error.code === "42501") return reply({ message: "La rutina cambió o no tenés permiso para registrar este ejercicio." }, 403);
    if (error.code === "22023" || error.code === "23514") return reply({ message: "Revisá el peso, las series y el ejercicio seleccionado." }, 400);
    return reply({ message: "No pudimos guardar el entrenamiento. Podés reintentar sin perder los datos." }, 503);
  }
  return reply({ result: data });
}
