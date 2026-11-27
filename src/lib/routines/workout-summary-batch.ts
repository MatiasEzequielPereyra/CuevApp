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
  exerciseId: string;
  studentId?: string;
  promise: Promise<WorkoutHistorySummary>;
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
  const groups = new Map<string, [string, PendingRequest][]>();
  for (const entry of batch) {
    const scope = entry[1].studentId ?? "";
    const group = groups.get(scope) ?? [];
    group.push(entry);
    groups.set(scope, group);
  }
  for (const [scope, requests] of groups) {
    // The authenticated endpoint deliberately accepts at most 100 UUIDs.
    // A routine can contain hundreds of mentions; each chunk settles independently.
    for (let offset = 0; offset < requests.length; offset += 100) {
      sendBatch(requests.slice(offset, offset + 100), scope || undefined);
    }
  }
}

function sendBatch(batch: [string, PendingRequest][], studentId?: string) {
  const params = new URLSearchParams();
  params.set("summary", "1");
  if (studentId) params.set("student_id", studentId);
  for (const [, request] of batch) params.append("exercise_id", request.exerciseId);
  void fetch("/api/entrenamientos?" + params.toString(), { cache: "no-store" })
    .then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No pudimos cargar los últimos registros.");
      return data.histories as Record<string, WorkoutHistorySummary>;
    })
    .then(histories => {
      for (const [, request] of batch) {
        const history = histories[request.exerciseId];
        if (!history) request.reject(new Error("No recibimos el resumen del ejercicio."));
        else request.resolve(history);
      }
    })
    .catch(cause => {
      const error = cause instanceof Error ? cause : new Error("No pudimos cargar los últimos registros.");
      for (const [, request] of batch) request.reject(error);
    })
    .finally(() => {
      // A forced refresh may have replaced this request while the older
      // network response was still pending. Never clear the newer promise.
      for (const [key, request] of batch) {
        if (inFlight.get(key) === request.promise) inFlight.delete(key);
      }
    });
}

export function requestWorkoutSummary(exerciseId: string, refresh = false, studentId?: string): Promise<WorkoutHistorySummary> {
  const requestKey = studentId ? `${studentId}:${exerciseId}` : exerciseId;
  const queued = pending.get(requestKey);
  if (queued) return queued.promise;
  const existing = inFlight.get(requestKey);
  if (existing && !refresh) return existing;
  if (refresh) inFlight.delete(requestKey);
  let resolveRequest!: (history: WorkoutHistorySummary) => void;
  let rejectRequest!: (error: Error) => void;
  const promise = new Promise<WorkoutHistorySummary>((resolve, reject) => {
    resolveRequest = resolve;
    rejectRequest = reject;
  });
  inFlight.set(requestKey, promise);
  pending.set(requestKey, { exerciseId, studentId, promise, resolve: resolveRequest, reject: rejectRequest });
  if (!scheduled) {
    scheduled = true;
    queueMicrotask(flush);
  }
  return promise;
}
