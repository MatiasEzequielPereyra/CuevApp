"use client";
import { useState } from "react";
import { ExerciseCatalog } from "@/components/routines/exercise-catalog";
import type { Block, Plan } from "@/lib/routines/types";
function moved<T>(items: T[], index: number, offset: number) {
  const source = items[index], target = items[index + offset];
  if (source === undefined || target === undefined) return items;
  const next = [...items]; next[index] = target; next[index + offset] = source; return next;
}
export function PlanBuilder({ plan, onChange, disabled }: { plan?: Plan | null; onChange: (plan: Plan) => void; disabled: boolean }) {
  const [adding, setAdding] = useState<string | null>(null);
  const blocks = plan?.blocks ?? [];
  function update(index: number, block: Block) { onChange({ version: 1, blocks: blocks.map((b, i) => i === index ? block : b) }); }
  return <fieldset className="routine-builder" disabled={disabled}><legend>Bloques y ejercicios</legend>
    {!blocks.length && <p>Agregá un bloque para comenzar. Las notas anteriores se conservan abajo; no se convierten en ejercicios.</p>}
    {blocks.map((block, index) => <section className="routine-block" key={block.id} aria-label={`Bloque ${index + 1}`}>
      <label>Nombre del bloque {index + 1}<input value={block.name} maxLength={80} onChange={event => update(index, { ...block, name: event.target.value })}/></label>
      <div className="routine-actions"><button type="button" disabled={index === 0} onClick={() => onChange({ version: 1, blocks: moved(blocks, index, -1) })}>Subir bloque {index + 1}</button><button type="button" disabled={index === blocks.length - 1} onClick={() => onChange({ version: 1, blocks: moved(blocks, index, 1) })}>Bajar bloque {index + 1}</button><button type="button" onClick={() => { if (block.exercises.length && !window.confirm("¿Quitar este bloque y sus ejercicios del borrador? La publicación se conserva.")) return; onChange({ version: 1, blocks: blocks.filter(b => b.id !== block.id) }); }}>Quitar bloque {index + 1}</button></div>
      {block.exercises.map((item, position) => <fieldset className="routine-target" key={item.id}><legend>{item.name}</legend>
        <div className="routine-target-fields">
          <label>Series<input type="number" min={1} max={30} step={1} value={item.sets || ""} onChange={event => update(index, { ...block, exercises: block.exercises.map(e => e.id === item.id ? { ...e, sets: Number(event.target.value) } : e) })}/></label>
          <label>Repeticiones<input maxLength={7} value={item.reps} placeholder="10 o 8-12" onChange={event => update(index, { ...block, exercises: block.exercises.map(e => e.id === item.id ? { ...e, reps: event.target.value } : e) })}/></label>
          <label>Peso objetivo (kg)<input type="number" min={0} max={2000} step="0.01" placeholder="Sin definir" value={item.weight_kg ?? ""} onChange={event => update(index, { ...block, exercises: block.exercises.map(e => e.id === item.id ? { ...e, weight_kg: event.target.value === "" ? null : Number(event.target.value) } : e) })}/></label>
        </div>
        <label>Observación del ejercicio<input maxLength={300} value={item.note} onChange={event => update(index, { ...block, exercises: block.exercises.map(e => e.id === item.id ? { ...e, note: event.target.value } : e) })}/></label>
        <div className="routine-actions"><button type="button" disabled={position === 0} onClick={() => update(index, { ...block, exercises: moved(block.exercises, position, -1) })}>Subir ejercicio {position + 1}</button><button type="button" disabled={position === block.exercises.length - 1} onClick={() => update(index, { ...block, exercises: moved(block.exercises, position, 1) })}>Bajar ejercicio {position + 1}</button><button type="button" onClick={() => update(index, { ...block, exercises: block.exercises.filter(e => e.id !== item.id) })}>Quitar ejercicio {position + 1}</button></div>
      </fieldset>)}
      <button type="button" disabled={block.exercises.length >= 30} onClick={() => setAdding(adding === block.id ? null : block.id)}>{adding === block.id ? "Cerrar catálogo" : `Agregar ejercicio al bloque ${index + 1}`}</button>
      {adding === block.id && <ExerciseCatalog onSelect={exercise => { update(index, { ...block, exercises: [...block.exercises, { id: crypto.randomUUID(), exercise_id: exercise.id, name: exercise.name, sets: 3, reps: "10", weight_kg: null, note: "" }] }); setAdding(null); }}/>}
    </section>)}
    <button type="button" disabled={blocks.length >= 20} onClick={() => onChange({ version: 1, blocks: [...blocks, { id: crypto.randomUUID(), name: `Día ${blocks.length + 1}`, exercises: [] }] })}>+ Agregar bloque</button>
    <p>Hasta 20 bloques, 30 ejercicios por bloque y 300 apariciones. Los valores son objetivos, no resultados realizados.</p>
  </fieldset>;
}
