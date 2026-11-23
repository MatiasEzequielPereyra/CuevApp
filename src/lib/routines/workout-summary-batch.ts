type HistoryEntry = {
  id: string;
  revision: number;
  performed_at: string;
  mode: "quick" | "sets";
  tracking_mode: "weight" | "time";
  weight_kg: number | null;
  duration_seconds: number | null;
  sets: { set_number: number; reps: number | null; weight_kg: number | null; duration_seconds: number | null }[];
};
export type WorkoutHistorySummary = {
  last_weight_kg: number | null;
  last_duration_seconds: number | null;
  entries: HistoryEntry[];
  has_more: boolean;
};

type PendingRequest = {
  resolve: (history: WorkoutHistorySummary) => void;
  reject: (error: Error) => void;
};
const pending = new Map<string, PendingRequest>();
const inFlight = new Map<string, Promise<WorkoutHistorySummary>>();
let scheduled = false;

function flush() {
  scheduled = false;
  const batch = [...pending.entries()];
  pending.clear();
  if (!batch.length) return;
  const params = new URLSearchParams();
  for (const [exerciseId] of batch) params.append("exercise_id", exerciseId);
  void fetch("/api/entrenamientos?" + params.toString(), { cache: "no-store" })
    .then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No pudimos cargar los últimos registros.");
      return data.histories as Record<string, WorkoutHistorySummary>;
    })
    .then(histories => {
      for (const [exerciseId, request] of batch) {
        const history = histories[exerciseId];
        if (!history) request.reject(new Error("No recibimos el resumen del ejercicio."));
        else request.resolve(history);
      }
    })
    .catch(cause => {
      const error = cause instanceof Error ? cause : new Error("No pudimos cargar los últimos registros.");
      for (const [, request] of batch) request.reject(error);
    })
    .finally(() => {
      for (const [exerciseId] of batch) inFlight.delete(exerciseId);
    });
}

export function requestWorkoutSummary(exerciseId: string): Promise<WorkoutHistorySummary> {
  const existing = inFlight.get(exerciseId);
  if (existing) return existing;
  let resolveRequest!: (history: WorkoutHistorySummary) => void;
  let rejectRequest!: (error: Error) => void;
  const promise = new Promise<WorkoutHistorySummary>((resolve, reject) => {
    resolveRequest = resolve;
    rejectRequest = reject;
  });
  inFlight.set(exerciseId, promise);
  pending.set(exerciseId, { resolve: resolveRequest, reject: rejectRequest });
  if (!scheduled) {
    scheduled = true;
    queueMicrotask(flush);
  }
  return promise;
}
