"use client";

import { useState } from "react";
import { StudentWorkoutLogger } from "@/components/routines/student-workout-logger";

type RowExercise = {
  id: string;
  name: string;
  tracking_mode: "weight" | "time";
};

export function StudentWorkoutRowLogger({ exercises, publicationId, embedded = false, studentId }: {
  exercises: RowExercise[];
  publicationId: string;
  embedded?: boolean;
  studentId?: string;
}) {
  const unique = exercises.filter((exercise, index) =>
    exercises.findIndex(item => item.id === exercise.id) === index
  );
  const [selectedId, setSelectedId] = useState(unique[0]?.id ?? "");
  const selected = unique.find(item => item.id === selectedId) ?? unique[0];
  if (!selected) return null;

  return (
    <div className="student-workout-row">
      <StudentWorkoutLogger publicationId={publicationId} exerciseId={selected.id}
        exerciseName={selected.name} trackingMode={selected.tracking_mode}
        availableExercises={unique} onExerciseChange={exercise => setSelectedId(exercise.id)} embedded={embedded} {...(studentId ? { studentId } : {})} />
    </div>
  );
}
