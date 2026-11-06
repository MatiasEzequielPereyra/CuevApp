"use client";
import { useEffect, useRef, useState } from "react";
import { ExerciseCatalog } from "@/components/routines/exercise-catalog";
import { PlanView, VideoLink } from "@/components/routines/plan-view";
import { adaptLegacy, type Block, type Day, type Plan, type PlanV2, type Target } from "@/lib/routines/types";
function moved<T>(items: T[], index: number, offset: number) {
  if (index + offset < 0 || index + offset >= items.length) return items;
  const next = [...items]; [next[index], next[index + offset]] = [next[index + offset]!, next[index]!]; return next;
}
export function PlanBuilder({ plan, onChange, disabled }: { plan?: Plan | null; onChange: (plan: Plan) => void; disabled: boolean }) {
  const [adding, setAdding] = useState<string | null>(null);
  const latest = useRef(plan); useEffect(() => { latest.current = plan; }, [plan]);
  if (plan?.version === 1) return <fieldset className="routine-builder" disabled={disabled}><legend>Planificación anterior</legend><PlanView plan={plan}/><p>Para editar días, convertí una copia del borrador. Los grupos con series distintas se separarán, conservando orden, objetivos y notas. Revisá los bloques antes de publicar.</p><button type="button" onClick={() => { if (window.confirm("¿Convertir el borrador a días y bloques? La publicación anterior se conserva. Revisá los bloques separados según sus series originales.")) onChange(adaptLegacy(plan)); }}>Convertir borrador a días</button></fieldset>;
  const days = plan?.days ?? [];
  const emit = (next: Day[]) => onChange({ version: 2, days: next });
  const updateDay = (id: string, next: Day) => emit(days.map(d => d.id === id ? next : d));
  const updateBlock = (day: Day, id: string, next: Block) => updateDay(day.id, { ...day, blocks: day.blocks.map(b => b.id === id ? next : b) });
  const updateTarget = (day: Day, block: Block, id: string, next: Target) => updateBlock(day, block.id, { ...block, exercises: block.exercises.map(e => e.id === id ? next : e) });
  return <fieldset className="routine-builder" disabled={disabled}><legend>Días, bloques y ejercicios</legend>
    {!days.length && <p>Agregá un día con el nombre que prefieras. Las notas anteriores se conservan.</p>}
    {days.map((day, di) => <section className="routine-day" key={day.id} aria-label={`Día ${di + 1}`}>
      <label>Nombre del día {di + 1}<input maxLength={80} value={day.name} onChange={e => updateDay(day.id, { ...day, name: e.target.value })}/></label>
      <div className="routine-actions"><button type="button" disabled={!di} onClick={() => emit(moved(days, di, -1))}>Subir día {di + 1}</button><button type="button" disabled={di === days.length - 1} onClick={() => emit(moved(days, di, 1))}>Bajar día {di + 1}</button><button type="button" onClick={() => { if (!day.blocks.length || window.confirm("¿Quitar este día y sus bloques del borrador?")) emit(days.filter(d => d.id !== day.id)); }}>Quitar día {di + 1}</button></div>
      {day.blocks.map((block, bi) => <section className="routine-block" key={block.id} aria-label={`Bloque ${bi + 1} de ${day.name}`}>
        <label>Nombre del bloque {bi + 1}<input maxLength={80} value={block.name} onChange={e => updateBlock(day, block.id, { ...block, name: e.target.value })}/></label>
        <label>Vueltas del bloque<input type="number" min={1} max={30} step={1} value={block.rounds || ""} onChange={e => updateBlock(day, block.id, { ...block, rounds: Number(e.target.value) })}/></label>
        <p>Hacé los ejercicios en orden y repetí estas vueltas antes de pasar al siguiente bloque.</p>
        <div className="routine-actions"><button type="button" disabled={!bi} onClick={() => updateDay(day.id, { ...day, blocks: moved(day.blocks, bi, -1) })}>Subir bloque {bi + 1}</button><button type="button" disabled={bi === day.blocks.length - 1} onClick={() => updateDay(day.id, { ...day, blocks: moved(day.blocks, bi, 1) })}>Bajar bloque {bi + 1}</button><button type="button" onClick={() => { if (!block.exercises.length || window.confirm("¿Quitar este bloque y sus ejercicios?")) updateDay(day.id, { ...day, blocks: day.blocks.filter(b => b.id !== block.id) }); }}>Quitar bloque {bi + 1}</button></div>
        {block.exercises.map((item, ei) => <fieldset className="routine-target" key={item.id}><legend>{item.name}</legend>
          <label>Modo del objetivo<select value={item.mode} onChange={e => updateTarget(day, block, item.id, { id: item.id, exercise_id: item.exercise_id, name: item.name, note: item.note, ...(e.target.value === "time" ? { mode: "time", duration: 30, unit: "seconds" } : { mode: "weight", reps: "10", weight_kg: null }) })}><option value="weight">Peso y repeticiones</option><option value="time">Tiempo</option></select></label>
          <div className="routine-target-fields">{item.mode === "time" ? <><label>Duración<input type="number" min={1} max={86400} step={1} value={item.duration || ""} onChange={e => updateTarget(day, block, item.id, { ...item, duration: Number(e.target.value) })}/></label><label>Unidad de tiempo<select value={item.unit} onChange={e => updateTarget(day, block, item.id, { ...item, unit: e.target.value as "seconds" | "minutes" })}><option value="seconds">Segundos</option><option value="minutes">Minutos</option></select></label></> : <><label>Repeticiones<input maxLength={7} value={item.reps} onChange={e => updateTarget(day, block, item.id, { ...item, reps: e.target.value })}/></label><label>Peso objetivo (kg)<input type="number" min={0} max={2000} step="0.01" value={item.weight_kg ?? ""} placeholder="Sin definir" onChange={e => updateTarget(day, block, item.id, { ...item, weight_kg: e.target.value === "" ? null : Number(e.target.value) })}/></label></>}</div>
          <label>Observación del ejercicio<input maxLength={300} value={item.note} onChange={e => updateTarget(day, block, item.id, { ...item, note: e.target.value })}/></label><VideoLink id={item.exercise_id}/>
          <div className="routine-actions"><button type="button" disabled={!ei} onClick={() => updateBlock(day, block.id, { ...block, exercises: moved(block.exercises, ei, -1) })}>Subir ejercicio {ei + 1}</button><button type="button" disabled={ei === block.exercises.length - 1} onClick={() => updateBlock(day, block.id, { ...block, exercises: moved(block.exercises, ei, 1) })}>Bajar ejercicio {ei + 1}</button><button type="button" onClick={() => updateBlock(day, block.id, { ...block, exercises: block.exercises.filter(e => e.id !== item.id) })}>Quitar ejercicio {ei + 1}</button></div>
        </fieldset>)}
        <button type="button" disabled={block.exercises.length >= 30} onClick={() => setAdding(adding === block.id ? null : block.id)}>{adding === block.id ? "Cerrar catálogo" : `Agregar ejercicios al bloque ${bi + 1}`}</button>
        {adding === block.id && <ExerciseCatalog capacity={30 - block.exercises.length} onSelectMany={exercises => {
          // A delayed catalogue response must use the most recent plan.
          const current = latest.current as PlanV2;
          onChange({ ...current, days: current.days.map(d => ({ ...d, blocks: d.blocks.map(b => b.id !== block.id ? b : { ...b, exercises: [...b.exercises, ...exercises.slice(0, 30 - b.exercises.length).map(e => ({ id: crypto.randomUUID(), exercise_id: e.id, name: e.name, mode: "weight" as const, reps: "10", weight_kg: null, note: "" }))] }) })) });
          setAdding(null);
        }}/>}
      </section>)}
      <button type="button" disabled={day.blocks.length >= 300} onClick={() => updateDay(day.id, { ...day, blocks: [...day.blocks, { id: crypto.randomUUID(), name: `Bloque ${day.blocks.length + 1}`, rounds: 3, exercises: [] }] })}>+ Agregar bloque</button>
    </section>)}
    <button type="button" disabled={days.length >= 30} onClick={() => emit([...days, { id: crypto.randomUUID(), name: `Día ${days.length + 1}`, blocks: [] }])}>+ Agregar día</button>
    <p>Hasta 30 días, 300 bloques y 300 apariciones en total; 30 ejercicios por bloque. Son objetivos, no resultados realizados.</p>
  </fieldset>;
}
