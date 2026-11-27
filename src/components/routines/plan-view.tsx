"use client";
import { useState } from "react";
import type { Plan } from "@/lib/routines/types";
import { ExerciseMention } from "@/components/routines/exercise-mention";
import { StudentWorkoutExerciseSummary } from "@/components/routines/student-workout-exercise-summary";
export function PlanView({ plan, studentId }: { plan?: Plan | null | undefined; studentId?: string }) {
  const [selected, setSelected] = useState("");
  const days = plan?.version === 2 ? plan.days : [];
  const day = days.find(d => d.id === selected) ?? days[0];
  const blocks = plan?.version === 1 ? plan.blocks : day?.blocks ?? [];
  return <div className="routine-plan-view">
    {days.length > 0 && <label>Día de entrenamiento<select value={day?.id ?? ""} onChange={e => setSelected(e.target.value)}>{days.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>}
    {plan?.version === 1 && <p>Planificación anterior: se conservan las series originales por ejercicio.</p>}
    {blocks.map(block => <section key={block.id}><h3>{block.name}</h3>{"rounds" in block && <p>{block.rounds} vueltas · Hacé los ejercicios en orden y repetí el bloque antes de continuar.</p>}{block.exercises.length ? <ol>{block.exercises.map(item => <li key={item.id}><strong>{studentId ? <ExerciseMention exerciseId={item.exercise_id} name={item.name} description={null} videoAvailability="unknown" text={item.name} publicationId="" trackingMode={"mode" in item && item.mode === "time" ? "time" : "weight"} targetId={item.id} studentId={studentId} availableExercises={block.exercises.map(candidate => ({ id: candidate.exercise_id, targetId: candidate.id, name: candidate.name, tracking_mode: "mode" in candidate && candidate.mode === "time" ? "time" : "weight" }))} /> : item.name}</strong><p>{"sets" in item ? `${item.sets} series · ${item.reps} repeticiones · ${item.weight_kg === null ? "Peso sin definir" : `${item.weight_kg} kg objetivo`}` : item.mode === "time" ? `${item.duration} ${item.unit === "seconds" ? "segundos" : "minutos"}` : `${item.reps} repeticiones · ${item.weight_kg === null ? "Peso sin definir" : `${item.weight_kg} kg objetivo`}`}</p>{item.note && <p>{item.note}</p>}{studentId && <StudentWorkoutExerciseSummary exerciseId={item.exercise_id} exerciseName={item.name} studentId={studentId} />}</li>)}</ol> : <p>Bloque sin ejercicios.</p>}</section>)}
  </div>;
}
export function VideoLink({ id }: { id: string }) {
  const [message, setMessage] = useState("");
  const [available, setAvailable] = useState(false);
  return <><a href={`/api/ejercicios/video?id=${id}`} target="_blank" rel="noopener noreferrer" onClick={async event => {
    event.preventDefault();
    // Open only after server authorization. The ordinary href remains usable without JS.
    try { const r = await fetch(`/api/ejercicios/video?id=${id}&check=1`, { cache: "no-store" }); const data = await r.json(); setMessage(r.ok ? "Video disponible: abrilo con el enlace siguiente." : data.message); setAvailable(r.ok); } catch { setMessage("No pudimos consultar el video. Reintentá."); }
  }}>Consultar video</a>{message && <span role="status">{message}</span>}{available && <a href={`/api/ejercicios/video?id=${id}`} target="_blank" rel="noopener noreferrer">Abrir video explicativo</a>}</>;
}
