"use client";
import { useState } from "react";
import type { Plan } from "@/lib/routines/types";
export function PlanView({ plan }: { plan?: Plan | null | undefined }) {
  const [selected, setSelected] = useState("");
  const days = plan?.version === 2 ? plan.days : [];
  const day = days.find(d => d.id === selected) ?? days[0];
  const blocks = plan?.version === 1 ? plan.blocks : day?.blocks ?? [];
  return <div className="routine-plan-view">
    {days.length > 0 && <label>Día de entrenamiento<select value={day?.id ?? ""} onChange={e => setSelected(e.target.value)}>{days.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>}
    {plan?.version === 1 && <p>Planificación anterior: se conservan las series originales por ejercicio.</p>}
    {blocks.map(block => <section key={block.id}><h3>{block.name}</h3>{"rounds" in block && <p>{block.rounds} vueltas · Hacé los ejercicios en orden y repetí el bloque antes de continuar.</p>}{block.exercises.length ? <ol>{block.exercises.map(item => <li key={item.id}><strong>{item.name}</strong><p>{"sets" in item ? `${item.sets} series · ${item.reps} repeticiones · ${item.weight_kg === null ? "Peso sin definir" : `${item.weight_kg} kg objetivo`}` : item.mode === "time" ? `${item.duration} ${item.unit === "seconds" ? "segundos" : "minutos"}` : `${item.reps} repeticiones · ${item.weight_kg === null ? "Peso sin definir" : `${item.weight_kg} kg objetivo`}`}</p>{item.note && <p>{item.note}</p>}<VideoLink id={item.exercise_id}/></li>)}</ol> : <p>Bloque sin ejercicios.</p>}</section>)}
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
