"use client";
import { useEffect, useRef, useState } from "react";
import type { Exercise } from "@/lib/routines/types";

export function ExerciseCatalog({ onSelect }: { onSelect?: (exercise: Exercise) => void }) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Exercise[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const busy = useRef(false), newId = useRef<string | null>(null);
  const selectCurrent = useRef(onSelect), mounted = useRef(true);
  useEffect(() => { selectCurrent.current = onSelect; }, [onSelect]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function search() {
    if (busy.current) return;
    busy.current = true; setPending(true); setMessage("");
    try {
      const response = await fetch(`/api/ejercicios?${new URLSearchParams({ q: query, ...(onSelect ? { active: "1" } : {}) })}`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      if (!response.ok) { setMessage(data.message); return; }
      setRows(data.exercises); setLoaded(true);
    } catch { setMessage("No pudimos consultar el catálogo. Tu rutina se conserva."); }
    finally { busy.current = false; setPending(false); }
  }
  async function save() {
    if (busy.current) return;
    busy.current = true; setPending(true); setMessage("");
    newId.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/ejercicios", { method: "POST", signal: AbortSignal.timeout(15000), headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing?.id ?? newId.current, name, active, revision: editing?.revision ?? 0 }) });
      const result = await response.json();
      if (!response.ok) { setMessage(result.message); return; }
      const exercise: Exercise = result.exercise;
      if (!mounted.current) return;
      setEditing(exercise); setName(exercise.name); setActive(exercise.active);
      setRows(previous => [...previous.filter(e => e.id !== exercise.id), exercise]);
      setMessage("Ejercicio guardado. Las rutinas existentes conservan sus objetivos y nombres.");
      if (exercise.active) selectCurrent.current?.(exercise);
    } catch { setMessage("No recibimos confirmación. Tu edición se conserva; podés reintentar con la misma identidad."); }
    finally { busy.current = false; setPending(false); }
  }
  function open(exercise: Exercise | null) {
    if (pending) return;
    if ((name !== (editing?.name ?? "") || active !== (editing?.active ?? true)) && !window.confirm("¿Descartar la edición del ejercicio para abrir otra ficha?")) return;
    setEditing(exercise); setName(exercise?.name ?? ""); setActive(exercise?.active ?? true); newId.current = null; setMessage("");
  }
  return <section className="exercise-catalog" aria-label={onSelect ? "Seleccionar ejercicio" : "Catálogo de ejercicios"}>
    <form className="routine-catalog-search" onSubmit={event => { event.preventDefault(); void search(); }}><label>Buscar ejercicio<input value={query} maxLength={120} onChange={event => setQuery(event.target.value)}/></label><button disabled={pending}>Buscar ejercicios</button></form>
    {loaded && !rows.length && <p>No encontramos ejercicios. Podés crear uno abajo.</p>}
    <ul className="exercise-results">{rows.slice(0, 100).map(e => <li key={e.id}><span><strong>{e.name}</strong>{!e.active && <small> · Inactivo</small>}</span><button type="button" disabled={pending || (!!onSelect && !e.active)} onClick={() => onSelect ? onSelect(e) : open(e)}>{onSelect ? `Agregar ${e.name}` : `Editar ${e.name}`}</button></li>)}</ul>
    {rows.length > 100 && <p>Mostramos los primeros 100. Refiná la búsqueda.</p>}
    <form className="routine-catalog-form" onSubmit={event => { event.preventDefault(); void save(); }}>
      <h3>{editing ? "Editar ejercicio" : "Crear ejercicio"}</h3><label>Nombre del ejercicio<input value={name} maxLength={120} required disabled={pending} onChange={event => setName(event.target.value)}/></label>
      {!onSelect && <label className="exercise-active"><input type="checkbox" checked={active} disabled={pending} onChange={event => setActive(event.target.checked)}/>Disponible para nuevas selecciones</label>}
      <p>Nombre único, sin distinguir mayúsculas ni espacios repetidos. No se borran ejercicios con referencias.</p>
      <div className="routine-actions"><button disabled={pending}>{pending ? "Guardando ejercicio…" : onSelect ? "Crear y agregar ejercicio" : "Guardar ejercicio"}</button>{editing && <button type="button" disabled={pending} onClick={() => open(null)}>Nuevo ejercicio</button>}</div>
    </form>
    {message && <p role="status">{message}</p>}
  </section>;
}
