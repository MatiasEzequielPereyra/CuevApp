"use client";

import { useId, useState } from "react";
import type { LegacyTarget, Plan, Target } from "@/lib/routines/types";
import { ExerciseMention } from "@/components/routines/exercise-mention";
import { StudentWorkoutExerciseSummary } from "@/components/routines/student-workout-exercise-summary";

type ExerciseMetadata = { id: string; name: string; description: string | null; has_video: boolean; video_kind?: "youtube" | "file" | null };

function ExerciseDetails({ exercise, publicationId, description, videoAvailability, videoKind, availableExercises }: {
  exercise: Target | LegacyTarget;
  publicationId: string;
  description: string | null;
  videoAvailability: "available" | "unavailable" | "unknown";
  videoKind: "youtube" | "file" | null;
  availableExercises: { id: string; name: string; tracking_mode: "weight" | "time"; targetId?: string }[];
}) {
  const trackingMode = "mode" in exercise ? exercise.mode : "weight";
  return (
    <span className="my-routine-exercise-detail">
      <ExerciseMention
        exerciseId={exercise.exercise_id}
        name={exercise.name}
        description={description}
        videoAvailability={videoAvailability}
        text={exercise.name}
        publicationId={publicationId}
        trackingMode={trackingMode}
        videoKind={videoKind}
        availableExercises={availableExercises}
        targetId={exercise.id}
      />
      <span className="my-routine-targets">
        {"sets" in exercise && <span>{exercise.sets} {exercise.sets === 1 ? "serie" : "series"}</span>}
        {"reps" in exercise
          ? <><span>{exercise.reps} {exercise.reps === "1" ? "repetición" : "repeticiones"}</span><span>{exercise.weight_kg === null ? "Peso sin definir" : `${exercise.weight_kg} kg`}</span></>
          : <span>{exercise.duration} {exercise.unit === "seconds" ? (exercise.duration === 1 ? "segundo" : "segundos") : (exercise.duration === 1 ? "minuto" : "minutos")}</span>}
      </span>
      {exercise.note && <span className="my-routine-exercise-note">{exercise.note}</span>}
      <StudentWorkoutExerciseSummary exerciseId={exercise.exercise_id} exerciseName={exercise.name} />
    </span>
  );
}

export function StudentPlan({ plan, publicationId, videoIds, videosAvailable = true, exerciseMetadata }: {
  plan: Plan;
  publicationId: string;
  videoIds: string[];
  videosAvailable?: boolean;
  exerciseMetadata: ExerciseMetadata[];
}) {
  const [selected, setSelected] = useState("");
  const dayContent = useId();
  const days = plan.version === 2 ? plan.days : [];
  const day = days.find(value => value.id === selected) ?? days[0];
  const blocks = plan.version === 1 ? plan.blocks : day?.blocks ?? [];
  const videos = new Set(videoIds);
  const metadata = new Map(exerciseMetadata.map(item => [item.id, item]));

  return (
    <>
      {days.length > 0 && (
        <div className="my-routine-days" role="group" aria-label="Día de entrenamiento">
          {days.map(item => (
            <button key={item.id} type="button" aria-controls={dayContent} aria-pressed={item.id === day?.id}
              onClick={() => setSelected(item.id)}>{item.name}</button>
          ))}
        </div>
      )}
      <div className="my-routine-blocks" id={dayContent}>
        {plan.version === 1 && <p className="my-routine-muted">Planificación anterior. Las series figuran en cada ejercicio.</p>}
        {day && <h2>{day.name}</h2>}
        {!blocks.length && <p className="my-routine-muted">{day ? "Este día todavía no tiene bloques." : "Esta rutina todavía no tiene bloques."}</p>}
        {blocks.map((block, index) => (
          <section className="my-routine-block" key={block.id}>
            <header>
              {day ? <h3>{block.name || `Bloque ${index + 1}`}</h3> : <h2>{block.name || `Bloque ${index + 1}`}</h2>}
              {"rounds" in block && <span>{block.rounds} {block.rounds === 1 ? "vuelta" : "vueltas"}</span>}
            </header>
            {block.exercises.length > 0 ? (
              <ol role="list">
                {block.exercises.map((exercise, exerciseIndex) => {
                  const detail = metadata.get(exercise.exercise_id);
                  const videoAvailability = !videosAvailable ? "unknown" : videos.has(exercise.exercise_id) ? "available" : "unavailable";
                  return (
                    <li key={exercise.id} className="my-routine-exercise-item">
                      <div className="my-routine-exercise">
                        <span className="my-routine-exercise-order" aria-hidden="true">{exerciseIndex + 1}</span>
                        <ExerciseDetails exercise={exercise} publicationId={publicationId}
                          description={detail?.description ?? null} videoAvailability={videoAvailability}
                        videoKind={detail?.video_kind ?? null}
                        availableExercises={block.exercises.map(candidate => ({
                          id: candidate.exercise_id, targetId: candidate.id, name: candidate.name,
                          tracking_mode: "mode" in candidate && candidate.mode === "time" ? "time" : "weight",
                        }))} />
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : <p className="my-routine-empty-block">Bloque sin ejercicios.</p>}
          </section>
        ))}
      </div>
    </>
  );
}
