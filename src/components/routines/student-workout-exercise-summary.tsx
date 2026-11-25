"use client";

import { useCallback, useEffect, useState } from "react";
import { requestWorkoutSummary, type WorkoutHistorySummary } from "@/lib/routines/workout-summary-batch";

function latestValue(history: WorkoutHistorySummary) {
  const entry = history.entries[0];
  if (!entry) return "";
  if (entry.mode === "quick") {
    if (entry.tracking_mode === "weight") return entry.weight_kg === null ? "" : `${entry.weight_kg.toLocaleString("es-AR", { maximumFractionDigits: 2 })} kg`;
    return entry.duration_seconds === null ? "" : `${entry.duration_seconds} seg`;
  }
  const lastSet = entry.sets.at(-1);
  if (!lastSet) return "";
  if (entry.tracking_mode === "weight") return lastSet.weight_kg === null ? "" : `${lastSet.weight_kg.toLocaleString("es-AR", { maximumFractionDigits: 2 })} kg`;
  return lastSet.duration_seconds === null ? "" : `${lastSet.duration_seconds} seg`;
}

export function StudentWorkoutExerciseSummary({ exerciseId, exerciseName }: { exerciseId: string; exerciseName: string }) {
  const [value, setValue] = useState("");
  const refresh = useCallback(() => {
    let active = true;
    void requestWorkoutSummary(exerciseId).then(history => {
      if (active) setValue(latestValue(history));
    }).catch(() => {
      if (active) setValue("");
    });
    return () => { active = false; };
  }, [exerciseId]);

  useEffect(() => {
    const cancel = refresh();
    const onUpdated = (event: Event) => {
      if ((event as CustomEvent<{ exerciseId?: string }>).detail?.exerciseId === exerciseId) {
        const cleanup = refresh();
        // The request is allowed to settle; a subsequent event supersedes it.
        void cleanup;
      }
    };
    window.addEventListener("cueva-workout-updated", onUpdated);
    return () => {
      cancel();
      window.removeEventListener("cueva-workout-updated", onUpdated);
    };
  }, [exerciseId, refresh]);

  if (!value) return null;
  return <span className="student-workout-exercise-summary" aria-label={`Último registro de ${exerciseName}: ${value}`}>{value}</span>;
}
