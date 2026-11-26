"use client";

import { useEffect, useState } from "react";
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
  useEffect(() => {
    let active = true;
    let latestRequest = 0;
    const load = (refresh = false) => {
      const request = ++latestRequest;
      void requestWorkoutSummary(exerciseId, refresh).then(history => {
        if (active && request === latestRequest) setValue(latestValue(history));
      }).catch(() => {
        if (active && request === latestRequest) setValue("");
      });
    };
    load();
    const onUpdated = (event: Event) => {
      if ((event as CustomEvent<{ exerciseId?: string }>).detail?.exerciseId === exerciseId) load(true);
    };
    window.addEventListener("cueva-workout-updated", onUpdated);
    return () => {
      active = false;
      latestRequest++;
      window.removeEventListener("cueva-workout-updated", onUpdated);
    };
  }, [exerciseId]);

  if (!value) return null;
  return <span className="student-workout-exercise-summary" aria-label={`Último registro de ${exerciseName}: ${value}`}><span className="student-workout-exercise-summary-value">{value}</span></span>;
}
