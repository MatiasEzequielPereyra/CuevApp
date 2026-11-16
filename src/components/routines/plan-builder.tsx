"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ExerciseCatalog, type BlockSettings } from "@/components/routines/exercise-catalog";
import { PlanView, VideoLink } from "@/components/routines/plan-view";
import { adaptLegacy, type Block, type Day, type Exercise, type Plan, type Target } from "@/lib/routines/types";

function moved<T>(items: T[], index: number, offset: number) {
  const destination = index + offset;
  if (destination < 0 || destination >= items.length) return items;
  const result = [...items];
  [result[index], result[destination]] = [result[destination]!, result[index]!];
  return result;
}

function targetSummary(target: Target) {
  if (target.mode === "time") return `${target.duration} ${target.unit === "seconds" ? "s" : "min"}`;
  return `${target.reps} reps${target.weight_kg === null ? "" : ` · ${target.weight_kg} kg`}`;
}

function TargetFields({ item, update }: { item: Target; update: (value: Target) => void }) {
  return <>
    <label>Tipo de objetivo
      <select value={item.mode} onChange={event => {
        const { id, exercise_id, name, note } = item;
        update({ id, exercise_id, name, note, ...(event.target.value === "time"
          ? { mode: "time", duration: 30, unit: "seconds" }
          : { mode: "weight", reps: "10", weight_kg: null }) });
      }}>
        <option value="weight">Peso y repeticiones</option>
        <option value="time">Tiempo</option>
      </select>
    </label>
    <div className="routine-target-fields">
      {item.mode === "time" ? <>
        <label>Duración<input type="number" min={1} max={86400} step={1} value={item.duration || ""}
          onChange={event => update({ ...item, duration: Number(event.target.value) })} /></label>
        <label>Unidad de tiempo<select value={item.unit}
          onChange={event => update({ ...item, unit: event.target.value === "minutes" ? "minutes" : "seconds" })}>
          <option value="seconds">Segundos</option>
          <option value="minutes">Minutos</option>
        </select></label>
      </> : <>
        <label>Repeticiones<input maxLength={7} value={item.reps} onChange={event => update({ ...item, reps: event.target.value })} /></label>
        <label>Peso objetivo (kg)<input type="number" min={0} max={2000} step="0.01" value={item.weight_kg ?? ""} placeholder="Sin definir"
          onChange={event => update({ ...item, weight_kg: event.target.value === "" ? null : Number(event.target.value) })} /></label>
      </>}
    </div>
    <label>Observación del ejercicio<input maxLength={300} value={item.note}
      onChange={event => update({ ...item, note: event.target.value })} /></label>
    <VideoLink id={item.exercise_id} />
  </>;
}

type Selection = { dayId: string; blockId?: string };

export function PlanBuilder({ plan, onChange, disabled }: { plan?: Plan | null; onChange: (plan: Plan) => void; disabled: boolean }) {
  const [activeDay, setActiveDay] = useState("");
  const [creatingDay, setCreatingDay] = useState(false);
  const [newDayName, setNewDayName] = useState("");
  const [activeTarget, setActiveTarget] = useState("");
  const [selection, setSelection] = useState<Selection | null>(null);
  const picker = useRef<HTMLDialogElement>(null);
  const pickerTitle = useRef<HTMLHeadingElement>(null);
  const pickerTrigger = useRef<HTMLButtonElement>(null);
  const dayNameInput = useRef<HTMLInputElement>(null);
  const addDay = useRef<HTMLButtonElement>(null);
  const addBlock = useRef<HTMLButtonElement>(null);
  const prefix = useId();

  useEffect(() => {
    if (!selection || !picker.current || picker.current.open) return;
    picker.current.showModal();
    pickerTitle.current?.focus();
  }, [selection]);
  useEffect(() => { if (creatingDay) dayNameInput.current?.focus(); }, [creatingDay]);

  if (plan?.version === 1) return <fieldset className="routine-builder" disabled={disabled}>
    <legend>Planificación anterior</legend>
    <PlanView plan={plan} />
    <p>Para editar días, convertí una copia del borrador. Los grupos con series distintas se separarán, conservando orden, objetivos y notas. Revisá los bloques antes de publicar.</p>
    <button type="button" onClick={() => {
      if (window.confirm("¿Convertir el borrador a días y bloques? La publicación anterior se conserva. Revisá los bloques separados según sus series originales.")) onChange(adaptLegacy(plan));
    }}>Convertir borrador a días</button>
  </fieldset>;

  const days = plan?.days ?? [];
  const day = days.find(item => item.id === activeDay) ?? days[0];
  const dayIndex = days.findIndex(item => item.id === day?.id);
  const blocks = days.flatMap(item => item.blocks);
  const available = 300 - blocks.reduce((total, block) => total + block.exercises.length, 0);
  const selectedBlock = blocks.find(block => block.id === selection?.blockId);
  const capacity = Math.max(0, Math.min(available, 30 - (selectedBlock?.exercises.length ?? 0)));
  const emit = (next: Day[]) => onChange({ version: 2, days: next });
  const updateDay = (next: Day) => emit(days.map(item => item.id === next.id ? next : item));
  const updateBlock = (owner: Day, next: Block) => updateDay({ ...owner, blocks: owner.blocks.map(item => item.id === next.id ? next : item) });

  function createDay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newDayName.trim();
    if (!name || days.length >= 30) return;
    const id = crypto.randomUUID();
    emit([...days, { id, name, blocks: [] }]);
    setActiveDay(id);
    setCreatingDay(false);
    requestAnimationFrame(() => addBlock.current?.focus());
  }

  function openPicker(trigger: HTMLButtonElement, dayId: string, blockId?: string) {
    pickerTrigger.current = trigger;
    setSelection(blockId ? { dayId, blockId } : { dayId });
  }

  function closePicker() {
    picker.current?.close();
    setSelection(null);
    pickerTrigger.current?.focus({ preventScroll: true });
  }

  function addExercises(exercises: Exercise[], { rounds, weightsKg }: BlockSettings) {
    if (!selection || disabled || !exercises.length || exercises.length > capacity) return;
    const owner = days.find(item => item.id === selection.dayId);
    if (!owner || (selection.blockId && !selectedBlock) || (!selection.blockId && blocks.length >= 300)) return;
    const targets: Target[] = exercises.map(exercise => ({
      id: crypto.randomUUID(), exercise_id: exercise.id, name: exercise.name,
      mode: "weight", reps: "10", weight_kg: weightsKg.get(exercise.id) ?? null, note: "",
    }));
    if (selectedBlock) updateBlock(owner, { ...selectedBlock, exercises: [...selectedBlock.exercises, ...targets] });
    else {
      let number = owner.blocks.length + 1;
      while (owner.blocks.some(item => item.name === `Bloque ${number}`)) number++;
      updateDay({ ...owner, blocks: [...owner.blocks, { id: crypto.randomUUID(), name: `Bloque ${number}`, rounds, exercises: targets }] });
    }
    closePicker();
  }

  return <fieldset className="routine-builder routine-workspace" disabled={disabled}>
    <legend>Días y bloques</legend>
    <div className="routine-day-picker" role="group" aria-label="Días de entrenamiento">
      {days.map((item, index) => <button key={item.id} type="button" aria-pressed={item.id === day?.id}
        onClick={() => { setActiveDay(item.id); setActiveTarget(""); setCreatingDay(false); }}>{item.name || `Día ${index + 1}`}</button>)}
      <button ref={addDay} type="button" aria-expanded={creatingDay} disabled={days.length >= 30}
        onClick={() => { setNewDayName(""); setCreatingDay(true); }}>+ Día</button>
    </div>
    {creatingDay && <form className="routine-new-day" onSubmit={createDay}>
      <label>Nombre del nuevo día<input ref={dayNameInput} maxLength={80} required value={newDayName} placeholder="Ej. Empuje"
        onChange={event => setNewDayName(event.target.value)} /></label>
      <div className="routine-actions">
        <button type="submit" className="routine-primary" disabled={!newDayName.trim()}>Agregar día</button>
        <button type="button" onClick={() => { setCreatingDay(false); addDay.current?.focus(); }}>Cancelar</button>
      </div>
    </form>}
    {!day && !creatingDay && <p>Agregá el primer día para armar sus bloques.</p>}
    {day && <section className="routine-day routine-day-active" aria-labelledby={`${prefix}-active-day`}>
      <header className="routine-day-heading">
        <h3 id={`${prefix}-active-day`}>{day.name || `Día ${dayIndex + 1}`}</h3>
        <details className="routine-options" key={day.id}>
          <summary aria-label="Opciones del día">⋯</summary>
          <div className="routine-options-panel">
            <label>Nombre del día<input maxLength={80} value={day.name}
              onChange={event => updateDay({ ...day, name: event.target.value })} /></label>
            <div className="routine-actions">
              <button type="button" disabled={dayIndex === 0} onClick={() => emit(moved(days, dayIndex, -1))}>Subir día</button>
              <button type="button" disabled={dayIndex === days.length - 1} onClick={() => emit(moved(days, dayIndex, 1))}>Bajar día</button>
              <button type="button" onClick={() => {
                if (day.blocks.length && !window.confirm("¿Quitar este día y sus bloques del borrador?")) return;
                const next = days.filter(item => item.id !== day.id);
                setActiveDay((next[dayIndex] ?? next.at(-1))?.id ?? "");
                setActiveTarget("");
                emit(next);
                requestAnimationFrame(() => addDay.current?.focus());
              }}>Quitar día</button>
            </div>
          </div>
        </details>
      </header>
      {!day.blocks.length && <p>Agregá un bloque y elegí los ejercicios que vas a combinar.</p>}
      <div className="routine-block-list">
        {day.blocks.map((block, blockIndex) => <section className="routine-block routine-block-card" key={block.id}
          aria-label={block.name || `Bloque ${blockIndex + 1}`}>
          <header className="routine-block-heading">
            <h4>{block.name || `Bloque ${blockIndex + 1}`}</h4>
            <details className="routine-options">
              <summary aria-label={`Opciones de ${block.name || `bloque ${blockIndex + 1}`}`}>⋯</summary>
              <div className="routine-options-panel">
                <label>Nombre del bloque<input maxLength={80} value={block.name}
                  onChange={event => updateBlock(day, { ...block, name: event.target.value })} /></label>
                <label>Vueltas del bloque<input type="number" min={1} max={30} step={1} value={block.rounds || ""}
                  onChange={event => updateBlock(day, { ...block, rounds: Number(event.target.value) })} /></label>
                <div className="routine-actions">
                  <button type="button" disabled={blockIndex === 0} onClick={() => updateDay({ ...day, blocks: moved(day.blocks, blockIndex, -1) })}>Subir bloque</button>
                  <button type="button" disabled={blockIndex === day.blocks.length - 1} onClick={() => updateDay({ ...day, blocks: moved(day.blocks, blockIndex, 1) })}>Bajar bloque</button>
                  <button type="button" disabled={available <= 0 || block.exercises.length >= 30}
                    aria-haspopup="dialog" onClick={event => openPicker(event.currentTarget, day.id, block.id)}>Agregar ejercicios</button>
                  <button type="button" onClick={() => {
                    if (block.exercises.length && !window.confirm("¿Quitar este bloque y sus ejercicios?")) return;
                    updateDay({ ...day, blocks: day.blocks.filter(item => item.id !== block.id) });
                    requestAnimationFrame(() => addBlock.current?.focus());
                  }}>Quitar bloque</button>
                </div>
              </div>
            </details>
            <span className="routine-rounds">{block.rounds} {block.rounds === 1 ? "vuelta" : "vueltas"}</span>
          </header>
          {!!block.exercises.length && <ol className="routine-exercises">
            {block.exercises.map((item, index) => <li key={item.id}>
              <button type="button" className="routine-exercise-row" aria-expanded={activeTarget === item.id}
                onClick={() => setActiveTarget(activeTarget === item.id ? "" : item.id)}>
                <strong>{item.name}</strong><span>{targetSummary(item)}</span>
              </button>
              {activeTarget === item.id && <div className="routine-target routine-target-expanded">
                <TargetFields item={item} update={next => updateBlock(day, { ...block, exercises: block.exercises.map(target => target.id === item.id ? next : target) })} />
                <div className="routine-actions">
                  <button type="button" disabled={index === 0}
                    onClick={() => updateBlock(day, { ...block, exercises: moved(block.exercises, index, -1) })}>Subir ejercicio</button>
                  <button type="button" disabled={index === block.exercises.length - 1}
                    onClick={() => updateBlock(day, { ...block, exercises: moved(block.exercises, index, 1) })}>Bajar ejercicio</button>
                  <button type="button" onClick={() => {
                    updateBlock(day, { ...block, exercises: block.exercises.filter(target => target.id !== item.id) });
                    setActiveTarget("");
                    requestAnimationFrame(() => addBlock.current?.focus());
                  }}>Quitar ejercicio</button>
                </div>
              </div>}
            </li>)}
          </ol>}
          {!block.exercises.length && <button type="button" disabled={available <= 0} aria-haspopup="dialog"
            onClick={event => openPicker(event.currentTarget, day.id, block.id)}>Agregar ejercicios</button>}
        </section>)}
      </div>
      <button type="button" ref={addBlock} className="routine-add-block" aria-haspopup="dialog"
        disabled={available <= 0 || blocks.length >= 300} onClick={event => openPicker(event.currentTarget, day.id)}>+ Bloque</button>
      {(available <= 0 || blocks.length >= 300) && <p>Alcanzaste el límite de 300 bloques o ejercicios por rutina.</p>}
    </section>}
    {selection && <dialog className="routine-picker-dialog" ref={picker} aria-labelledby={`${prefix}-picker-title`}
      onCancel={event => { event.preventDefault(); closePicker(); }}>
      <div className="routine-picker-body">
        <header>
          <h3 id={`${prefix}-picker-title`} ref={pickerTitle} tabIndex={-1}>{selection.blockId ? "Agregar ejercicios" : "Nuevo bloque"}</h3>
          <button type="button" onClick={closePicker}>Cerrar</button>
        </header>
        <ExerciseCatalog capacity={capacity} onSelectMany={addExercises} compactPicker configureRounds={!selection.blockId} />
      </div>
    </dialog>}
  </fieldset>;
}
