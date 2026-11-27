import { NextResponse } from "next/server";
import { productConfig, userClient } from "@/lib/product-auth/server";
import { readRoutineJson } from "@/lib/routines/request";
import { uuid } from "@/lib/routines/types";

const reply = (data: object, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

async function sessionClient() {
  if (!productConfig()) return { client: null, status: 404, role: null as string | null };
  const client = await userClient(true);
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return { client: null, status: 401, role: null as string | null };
  const profile = await client.from("cueva_profiles").select("role").maybeSingle();
  if (profile.error || !["alumno", "admin"].includes(profile.data?.role ?? "")) {
    return { client: null, status: 403, role: null as string | null };
  }
  return { client, status: 200, role: profile.data!.role };
}

async function studentClient() {
  const session = await sessionClient();
  if (!session.client) return { client: null, status: session.status };
  if (session.role !== "alumno") return { client: null, status: 403 };
  return { client: session.client, status: 200 };
}

function validWeight(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
    && value >= 0 && value <= 2000 && Math.abs(value * 100 - Math.round(value * 100)) < 1e-8;
}

function validDuration(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= 86400;
}

export async function GET(req: Request) {
  const { client, status, role } = await sessionClient();
  if (!client) return reply({ message: "Acceso restringido." }, status);
  const params = new URL(req.url).searchParams;
  const studentId = params.get("student_id");
  if ((role === "admin" && (!studentId || !uuid.test(studentId)))
    || (role === "alumno" && studentId)) return reply({ message: "Alumno inválido o fuera del alcance de acceso." }, 400);
  const exerciseIds = [...new Set(params.getAll("exercise_id").flatMap(value => value.split(",")).filter(Boolean))];
  if (params.get("summary") === "1") {
    if (exerciseIds.length < 1 || exerciseIds.length > 100 || exerciseIds.some(id => !uuid.test(id))) return reply({ message: "Lista de ejercicios inválida." }, 400);
    const { data, error } = role === "admin"
      ? await client.rpc("cueva_workout_history_admin_batch", { p_student_id: studentId, p_exercise_ids: exerciseIds })
      : await client.rpc("cueva_workout_history_batch", { p_exercise_ids: exerciseIds });
    if (error) return reply({ message: "No pudimos cargar los últimos registros." }, error.code === "42501" ? 403 : 503);
    return reply({ histories: data });
  }
  const exerciseId = exerciseIds[0] ?? "";
  const offset = Number(params.get("offset") ?? 0), limit = Number(params.get("limit") ?? 3);
  if (!uuid.test(exerciseId)) return reply({ message: "Ejercicio inválido." }, 400);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 3) return reply({ message: "Página de historial inválida." }, 400);
  const { data, error } = role === "admin"
    ? await client.rpc("cueva_workout_history_admin", { p_student_id: studentId, p_exercise_id: exerciseId, p_limit: limit, p_offset: offset })
    : await client.rpc("cueva_workout_history", { p_exercise_id: exerciseId, p_limit: limit, p_offset: offset });
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
    || !["weight", "time"].includes(p.tracking_mode)
    || !Array.isArray(p.sets) || p.sets.length > 30) {
    return reply({ message: "Revisá los datos del registro." }, 400);
  }
  const trackingMode = p.tracking_mode as "weight" | "time";
  if (p.mode === "quick") {
    if (p.sets.length !== 0
      || (trackingMode === "weight" && (!validWeight(p.weight_kg) || p.duration_seconds !== null && p.duration_seconds !== undefined))
      || (trackingMode === "time" && (!validDuration(p.duration_seconds) || p.weight_kg !== null && p.weight_kg !== undefined))) {
      return reply({ message: trackingMode === "weight"
        ? "Ingresá un peso válido entre 0 y 2000 kg."
        : "Ingresá una duración válida entre 1 y 86400 segundos." }, 400);
    }
  } else {
    const invalidSet = p.sets.some((set: unknown) => {
      if (!set || typeof set !== "object") return true;
      const row = set as { reps?: unknown; weight_kg?: unknown; duration_seconds?: unknown };
      return trackingMode === "weight"
        ? !Number.isInteger(row.reps) || (row.reps as number) < 1 || (row.reps as number) > 1000 || !validWeight(row.weight_kg)
        : !validDuration(row.duration_seconds);
    });
    if (p.weight_kg !== null && p.weight_kg !== undefined
      || p.duration_seconds !== null && p.duration_seconds !== undefined
      || p.sets.length < 1 || invalidSet) {
      return reply({ message: trackingMode === "weight"
        ? "Cada serie debe tener repeticiones y un peso válido."
        : "Cada serie debe tener una duración válida en segundos." }, 400);
    }
  }
  const { data, error } = await client.rpc("cueva_workout_record", {
    p_id: p.id,
    p_publication_id: p.publication_id,
    p_exercise_id: p.exercise_id,
    p_target_id: p.target_id ?? null,
    p_mode: p.mode,
    p_tracking_mode: trackingMode,
    p_weight_kg: trackingMode === "weight" && p.mode === "quick" ? p.weight_kg : null,
    p_duration_seconds: trackingMode === "time" && p.mode === "quick" ? p.duration_seconds : null,
    p_sets: p.sets,
  });
  if (error) {
    if (error.code === "42501") return reply({ message: "La rutina cambió o no tenés permiso para registrar este ejercicio." }, 403);
    if (error.code === "22023" || error.code === "23514") return reply({ message: "Revisá el peso, la duración, las series y el ejercicio seleccionado." }, 400);
    return reply({ message: "No pudimos guardar el entrenamiento. Podés reintentar sin perder los datos." }, 503);
  }
  return reply({ result: data });
}


export async function PATCH(req: Request) {
  const cfg = productConfig();
  if (!cfg) return reply({ message: "Acceso no disponible." }, 404);
  if (req.headers.get("origin") !== cfg.origin) return reply({ message: "Solicitud no permitida." }, 403);
  const { client, status, role } = await sessionClient();
  if (!client) return reply({ message: "Acceso restringido." }, status);
  const p = await readRoutineJson(req, 12000);
  const studentId = p?.student_id;
  if ((role === "admin" && (typeof studentId !== "string" || !uuid.test(studentId)))
    || (role === "alumno" && studentId !== undefined)) return reply({ message: "Alumno inválido o fuera del alcance de acceso." }, 400);
  if (!p || typeof p.entry_id !== "string" || !uuid.test(p.entry_id)
    || !Number.isSafeInteger(p.revision) || p.revision < 1 || p.revision > 2147483646
    || !["quick", "sets"].includes(p.mode)
    || !["weight", "time"].includes(p.tracking_mode)
    || !Array.isArray(p.sets) || p.sets.length > 30) {
    return reply({ message: "Revisá los datos del registro que querés editar." }, 400);
  }
  const trackingMode = p.tracking_mode as "weight" | "time";
  if (p.mode === "quick") {
    if (p.sets.length !== 0
      || (trackingMode === "weight" && (!validWeight(p.weight_kg) || p.duration_seconds !== null && p.duration_seconds !== undefined))
      || (trackingMode === "time" && (!validDuration(p.duration_seconds) || p.weight_kg !== null && p.weight_kg !== undefined))) {
      return reply({ message: "Revisá el peso o la duración del registro." }, 400);
    }
  } else {
    const invalidSet = p.sets.some((set: unknown) => {
      if (!set || typeof set !== "object") return true;
      const row = set as { reps?: unknown; weight_kg?: unknown; duration_seconds?: unknown };
      return trackingMode === "weight"
        ? !Number.isInteger(row.reps) || (row.reps as number) < 1 || (row.reps as number) > 1000 || !validWeight(row.weight_kg)
        : !validDuration(row.duration_seconds);
    });
    if (p.weight_kg !== null && p.weight_kg !== undefined
      || p.duration_seconds !== null && p.duration_seconds !== undefined
      || p.sets.length < 1 || invalidSet) {
      return reply({ message: "Revisá los valores de cada serie." }, 400);
    }
  }
  const { data, error } = role === "admin"
    ? await client.rpc("cueva_workout_update_admin", {
        p_student_id: studentId, p_id: p.entry_id, p_revision: p.revision,
        p_mode: p.mode, p_tracking_mode: trackingMode,
        p_weight_kg: trackingMode === "weight" && p.mode === "quick" ? p.weight_kg : null,
        p_duration_seconds: trackingMode === "time" && p.mode === "quick" ? p.duration_seconds : null,
        p_sets: p.sets,
      })
    : await client.rpc("cueva_workout_update", {
    p_id: p.entry_id,
    p_revision: p.revision,
    p_mode: p.mode,
    p_tracking_mode: trackingMode,
    p_weight_kg: trackingMode === "weight" && p.mode === "quick" ? p.weight_kg : null,
    p_duration_seconds: trackingMode === "time" && p.mode === "quick" ? p.duration_seconds : null,
    p_sets: p.sets,
  });
  if (error) {
    if (error.code === "42501") return reply({ message: "No tenés permiso para editar este registro." }, 403);
    if (error.code === "40001") return reply({ message: "El registro cambió desde que abriste el historial. Actualizalo e intentá nuevamente." }, 409);
    if (error.code === "22023" || error.code === "23514") return reply({ message: "Revisá el peso, la duración y las series." }, 400);
    return reply({ message: "No pudimos actualizar el registro." }, 503);
  }
  return reply({ result: data });
}


export async function DELETE(req: Request) {
  const cfg = productConfig();
  if (!cfg) return reply({ message: "Acceso no disponible." }, 404);
  if (req.headers.get("origin") !== cfg.origin) return reply({ message: "Solicitud no permitida." }, 403);
  const { client, status } = await studentClient();
  if (!client) return reply({ message: "Acceso restringido." }, status);
  const p = await readRoutineJson(req, 2000);
  if (!p || typeof p.entry_id !== "string" || !uuid.test(p.entry_id)
    || !Number.isSafeInteger(p.revision) || p.revision < 1 || p.revision > 2147483647) {
    return reply({ message: "Revisá el registro que querés eliminar." }, 400);
  }
  const { data, error } = await client.rpc("cueva_workout_delete", {
    p_id: p.entry_id,
    p_revision: p.revision,
  });
  if (error) {
    if (error.code === "42501") return reply({ message: "No tenés permiso para eliminar este registro." }, 403);
    if (error.code === "40001") return reply({ message: "El registro cambió. Actualizá el historial e intentá nuevamente." }, 409);
    if (error.code === "22023") return reply({ message: "El registro seleccionado no es válido." }, 400);
    return reply({ message: "No pudimos eliminar el registro." }, 503);
  }
  return reply({ result: data });
}
