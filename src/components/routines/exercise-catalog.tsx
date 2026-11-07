"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Exercise } from "@/lib/routines/types";
import { VideoLink } from "@/components/routines/plan-view";
export function ExerciseCatalog({ onSelectMany, capacity = 30, videosOnly = false }: { onSelectMany?: (exercises: Exercise[]) => void; capacity?: number; videosOnly?: boolean }) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Exercise[]>([]), [selected, setSelected] = useState<Exercise[]>([]);
  const [next, setNext] = useState<number | null>(null), [searched, setSearched] = useState("");
  const [loaded, setLoaded] = useState(false), [pending, setPending] = useState(false);
  const [name, setName] = useState(""), [description, setDescription] = useState(""), [video, setVideo] = useState("");
  const [active, setActive] = useState(true), [editing, setEditing] = useState<Exercise | null>(null), [message, setMessage] = useState("");
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const busy = useRef(false), newId = useRef<string | null>(null);
  const selectCurrent = useRef(onSelectMany), mounted = useRef(true);
  useEffect(() => { selectCurrent.current = onSelectMany; }, [onSelectMany]);
  const selecting = !!onSelectMany;
  const search = useCallback(async (q: string, offset = 0) => {
    if (busy.current) return;
    busy.current = true; setPending(true); setMessage("");
    try {
      const r = await fetch(`/api/ejercicios?${new URLSearchParams({ q, offset: String(offset), ...(selecting ? { active: "1" } : {}), ...(videosOnly ? { videos: "1" } : {}) })}`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
      const data = await r.json();
      if (!mounted.current) return;
      if (!r.ok) { setMessage(data.message); return; }
      setRows(previous => offset ? [...new Map([...previous, ...data.exercises].map((e: Exercise) => [e.id, e])).values()] : data.exercises); setNext(data.next); setSearched(q); setLoaded(true);
    } catch { if (mounted.current) setMessage("No pudimos consultar el catálogo. Podés reintentar."); }
    finally { busy.current = false; if (mounted.current) setPending(false); }
  }, [selecting, videosOnly]);
  useEffect(() => { mounted.current = true; const timer = setTimeout(() => { void search(""); }, 0); return () => { clearTimeout(timer); mounted.current = false; }; }, [search]);
  async function save() {
    if (busy.current) return;
    busy.current = true; setPending(true); setMessage(""); newId.current ??= crypto.randomUUID();
    try {
      const r = await fetch("/api/ejercicios", { method: "POST", signal: AbortSignal.timeout(15000), headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing?.id ?? newId.current, name, description, video_url: video || null, video_path: videoPath, active, revision: editing?.revision ?? 0 }) });
      const data = await r.json(); if (!mounted.current) return;
      if (!r.ok) { setMessage(data.message); return; }
      const e: Exercise = data.exercise; setEditing(e); setName(e.name); setDescription(e.description); setVideo(e.video_url ?? ""); setVideoPath(e.video_path); setActive(e.active);
      setRows(previous => [...previous.filter(x => x.id !== e.id), e]); setMessage("Ejercicio guardado. Las rutinas conservan sus objetivos y nombres.");
      if (e.active && selectCurrent.current) setSelected(previous => [...previous.filter(x => x.id !== e.id), e]);
    } catch { setMessage("No recibimos confirmación. Reintentá con la misma identidad."); }
    finally { busy.current = false; setPending(false); }
  }
  function open(e: Exercise | null) {
    if (name !== (editing?.name ?? "") || description !== (editing?.description ?? "") || video !== (editing?.video_url ?? "") || active !== (editing?.active ?? true) || videoPath !== (editing?.video_path ?? null)) if (!window.confirm("¿Descartar la edición del ejercicio para abrir otra ficha?")) return;
    setEditing(e); setName(e?.name ?? ""); setDescription(e?.description ?? ""); setVideo(e?.video_url ?? ""); setVideoPath(e?.video_path ?? null); setActive(e?.active ?? true); newId.current = null; setMessage("");
  }
  return <section className="exercise-catalog" aria-label={videosOnly ? "Biblioteca de videos" : selecting ? "Seleccionar ejercicios" : "Catálogo de ejercicios"}>
    <form className="routine-catalog-search" onSubmit={e => { e.preventDefault(); void search(query); }}><label>Buscar ejercicio<input value={query} maxLength={120} onChange={e => setQuery(e.target.value)}/></label><button disabled={pending}>Buscar ejercicios</button></form>
    {!loaded && !message && <p>Cargando {videosOnly ? "videos" : "ejercicios"}…</p>}
    {loaded && !rows.length && <p>{videosOnly
      ? (searched ? "No encontramos videos para esa búsqueda." : "Todavía no hay ejercicios con video. Podés agregar uno desde el catálogo.")
      : "No encontramos ejercicios. Podés crear uno abajo."}</p>}
    <ul className="exercise-results">{rows.map(e => <li key={e.id}><div><strong>{e.name}</strong>{!e.active && <small> · Inactivo</small>}{e.description && <p>{e.description}</p>}{(e.video_url || e.video_path) ? <VideoLink id={e.id}/> : <p>Sin video disponible.</p>}</div>{selecting ? <label><input type="checkbox" checked={selected.some(x => x.id === e.id)} disabled={pending || !e.active || (selected.length >= capacity && !selected.some(x => x.id === e.id))} onChange={ev => setSelected(previous => ev.target.checked ? [...previous, e] : previous.filter(x => x.id !== e.id))}/>Seleccionar {e.name}</label> : !videosOnly && <button type="button" disabled={pending} onClick={() => open(e)}>Editar {e.name}</button>}</li>)}</ul>
    {next !== null && <button type="button" disabled={pending} onClick={() => void search(searched, next)}>Mostrar más {videosOnly ? "videos" : "ejercicios"}</button>}
    {selecting && <><p>{selected.length} seleccionados. Se agregan en el orden de selección.</p><button type="button" disabled={pending || !selected.length || selected.length > capacity} onClick={() => onSelectMany?.(selected)}>Agregar seleccionados al bloque</button></>}
    {!videosOnly && <>
    <label>Subir video desde la galería (hasta 50 MB)<input type="file" accept="video/mp4,video/quicktime,video/webm" disabled={pending} onChange={async event => {
      const file = event.target.files?.[0]; event.target.value = "";
      if (!file || busy.current) return;
      if (!file.size || file.size > 50 * 1024 * 1024 || !["video/mp4", "video/quicktime", "video/webm"].includes(file.type)) { setMessage("Elegí un MP4, MOV o WebM de hasta 50 MB."); return; }
      busy.current = true; setPending(true); setMessage("Subiendo video…"); newId.current ??= crypto.randomUUID();
      try {
        const prepared = await fetch("/api/ejercicios/video/upload", { method: "POST", signal: AbortSignal.timeout(15000), headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing?.id ?? newId.current, type: file.type, size: file.size }) });
        const upload = await prepared.json(); if (!prepared.ok) { setMessage(upload.message); return; }
        const sent = await fetch(upload.url, { method: "PUT", signal: AbortSignal.timeout(180000), headers: { "Content-Type": file.type, "x-upsert": "false" }, body: file });
        if (!sent.ok) { setMessage("La carga falló. Reintentá; el video anterior se conserva."); return; }
        setVideoPath(upload.path); setVideo(""); setMessage("Video cargado. Guardá el ejercicio para asociarlo.");
      } catch { setMessage("No se confirmó la carga. Reintentá; el ejercicio se conserva."); } finally { busy.current = false; setPending(false); }
    }}/></label>{videoPath && <p>Video de la galería preparado.<button type="button" disabled={pending} onClick={() => setVideoPath(null)}>Quitar asociación de video</button></p>}
    <form className="routine-catalog-form" onSubmit={e => { e.preventDefault(); void save(); }}><h3>{editing ? "Editar ejercicio" : "Crear ejercicio"}</h3>
      <label>Nombre del ejercicio<input required maxLength={120} value={name} disabled={pending} onChange={e => setName(e.target.value)}/></label>
      <label>Descripción del ejercicio<textarea maxLength={2000} value={description} disabled={pending} onChange={e => setDescription(e.target.value)}/></label>
      <label>Video de YouTube (opcional)<input type="url" maxLength={200} value={video} placeholder="https://www.youtube.com/watch?v=…" disabled={pending} onChange={e => { setVideo(e.target.value); if (e.target.value) setVideoPath(null); }}/></label><p>Usá un enlace HTTPS al video, sin parámetros adicionales. Sin video, dejá el campo vacío.</p>
      {!selecting && <label><input type="checkbox" checked={active} disabled={pending} onChange={e => setActive(e.target.checked)}/>Disponible para nuevas selecciones</label>}
      <p>Nombre e instrucciones reutilizables. Los objetivos se configuran en cada rutina.</p>
      <div className="routine-actions"><button disabled={pending}>{pending ? "Guardando ejercicio…" : "Guardar ejercicio"}</button>{editing && <button type="button" disabled={pending} onClick={() => open(null)}>Nuevo ejercicio</button>}</div>
    </form>
    </>}
    {message && <p role="status">{message}</p>}
  </section>;
}
