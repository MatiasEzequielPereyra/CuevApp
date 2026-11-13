"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { Exercise } from "@/lib/routines/types";
import { VideoLink } from "@/components/routines/plan-view";
export function ExerciseCatalog({ onSelectMany, capacity = 30, videosOnly = false }: { onSelectMany?: (exercises: Exercise[]) => void; capacity?: number; videosOnly?: boolean }) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Exercise[]>([]), [selected, setSelected] = useState<Exercise[]>([]);
  const [next, setNext] = useState<number | null>(null), [searched, setSearched] = useState("");
  const [loaded, setLoaded] = useState(false), [pending, setPending] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [name, setName] = useState(""), [description, setDescription] = useState(""), [video, setVideo] = useState("");
  const [active, setActive] = useState(true), [editing, setEditing] = useState<Exercise | null>(null), [message, setMessage] = useState("");
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const busy = useRef(false), newId = useRef<string | null>(null);
  const selectCurrent = useRef(onSelectMany), mounted = useRef(true);
  const editorDialog = useRef<HTMLDialogElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const editorTrigger = useRef<HTMLButtonElement>(null);
  const createButton = useRef<HTMLButtonElement>(null);
  const instanceId = useId();
  const editorTitleId = `${instanceId}-editor-title`;
  useEffect(() => { selectCurrent.current = onSelectMany; }, [onSelectMany]);
  const selecting = !!onSelectMany;
  const managing = !selecting && !videosOnly;
  const search = useCallback(async (q: string, offset = 0) => {
    if (busy.current) return;
    busy.current = true; setPending(true); setSearchError("");
    try {
      const r = await fetch(`/api/ejercicios?${new URLSearchParams({ q, offset: String(offset), ...(selecting ? { active: "1" } : {}), ...(videosOnly ? { videos: "1" } : {}) })}`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
      const data = await r.json();
      if (!mounted.current) return;
      if (!r.ok) { setSearchError(data.message || "No pudimos consultar el catálogo. Podés reintentar."); return; }
      setRows(previous => offset ? [...new Map([...previous, ...data.exercises].map((e: Exercise) => [e.id, e])).values()] : data.exercises); setNext(data.next); setSearched(q); setLoaded(true);
    } catch { if (mounted.current) setSearchError("No pudimos consultar el catálogo. Podés reintentar."); }
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
      setRows(previous => previous.some(row => row.id === e.id) ? previous.map(row => row.id === e.id ? e : row) : [...previous, e]); setMessage("Ejercicio guardado. Las rutinas conservan sus objetivos y nombres.");
      if (e.active && selectCurrent.current) setSelected(previous => [...previous.filter(x => x.id !== e.id), e]);
    } catch { setMessage("No recibimos confirmación. Reintentá con la misma identidad."); }
    finally { busy.current = false; setPending(false); }
  }
  function resetEditor(exercise: Exercise | null) {
    setEditing(exercise);
    setName(exercise?.name ?? "");
    setDescription(exercise?.description ?? "");
    setVideo(exercise?.video_url ?? "");
    setVideoPath(exercise?.video_path ?? null);
    setActive(exercise?.active ?? true);
    newId.current = null;
    setMessage("");
  }

  function canDiscard() {
    const hasChanges = name !== (editing?.name ?? "") || description !== (editing?.description ?? "") ||
      video !== (editing?.video_url ?? "") || active !== (editing?.active ?? true) ||
      videoPath !== (editing?.video_path ?? null);
    return !hasChanges || window.confirm("¿Descartar los cambios del ejercicio?");
  }

  function openEditor(exercise: Exercise | null, trigger: HTMLButtonElement) {
    resetEditor(exercise);
    editorTrigger.current = trigger;
    editorDialog.current?.showModal();
    nameInput.current?.focus();
  }

  function closeEditor() {
    if (busy.current || !canDiscard()) return;
    editorDialog.current?.close();
    const trigger = editorTrigger.current;
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    else createButton.current?.focus();
  }

  const editor = <form className="routine-catalog-form" onSubmit={event => {
    event.preventDefault();
    void save();
  }}>
    {!managing && <h3>{editing ? "Editar ejercicio" : "Crear ejercicio"}</h3>}
    <label>Nombre del ejercicio<input required maxLength={120} ref={nameInput} value={name} disabled={pending} onChange={event => setName(event.target.value)} /></label>
    <label>Descripción del ejercicio<textarea maxLength={2000} value={description} disabled={pending} onChange={event => setDescription(event.target.value)} /></label>
    <label>
      Video de YouTube (opcional)
      <input type="url" maxLength={200} value={video} placeholder="https://www.youtube.com/watch?v=…" disabled={pending}
        onChange={event => { setVideo(event.target.value); if (event.target.value) setVideoPath(null); }} />
    </label>
    <p>Usá un enlace HTTPS de YouTube sin parámetros adicionales.</p>
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
    {!selecting && <label><input type="checkbox" checked={active} disabled={pending} onChange={event => setActive(event.target.checked)} />Disponible para nuevas selecciones</label>}
    <div className="routine-actions">
      <button className={managing ? "exercise-primary" : undefined} disabled={pending}>{pending ? "Guardando ejercicio…" : "Guardar ejercicio"}</button>
      {!managing && editing && <button type="button" disabled={pending} onClick={() => { if (canDiscard()) resetEditor(null); }}>Nuevo ejercicio</button>}
    </div>
    {message && <p role="status">{message}</p>}
  </form>;

  return <section className={`exercise-catalog${selecting ? "" : " exercise-management"}`}
    aria-label={videosOnly ? "Biblioteca de videos" : selecting ? "Seleccionar ejercicios" : "Catálogo de ejercicios"}>
    <form className="routine-catalog-search" onSubmit={event => { event.preventDefault(); void search(query); }}>
      <label>Buscar ejercicio<input type="search" value={query} maxLength={120} onChange={event => setQuery(event.target.value)} /></label>
      <div className="exercise-search-actions">
        <button disabled={pending}>Buscar</button>
        {managing && <button type="button" className="exercise-primary" ref={createButton} disabled={pending}
          onClick={event => openEditor(null, event.currentTarget)}>Nuevo ejercicio</button>}
      </div>
    </form>
    {searchError && <p className="exercise-feedback" role="alert">{searchError}</p>}
    {!loaded && !searchError && <p className="exercise-feedback" role="status">Cargando {videosOnly ? "videos" : "ejercicios"}…</p>}
    {loaded && !rows.length && !searchError && <p className="exercise-feedback">{videosOnly
      ? (searched ? "No encontramos videos para esa búsqueda." : "Todavía no hay ejercicios con video. Podés agregar uno desde el catálogo.")
      : searched ? "No encontramos ejercicios para esa búsqueda." : "Todavía no hay ejercicios en el catálogo."}</p>}
    {rows.length > 0 && <ul className="exercise-results">
      {rows.map(exercise => {
        const statusId = `${instanceId}-${exercise.id}-status`;
        const descriptionId = `${instanceId}-${exercise.id}-description`;
        const details = [exercise.active ? "" : statusId, exercise.description ? descriptionId : ""].filter(Boolean).join(" ");
        const info = <>
          <strong>{exercise.name}</strong>
          {!exercise.active && <small id={statusId}>Inactivo</small>}
          {exercise.description && <span id={descriptionId} className="exercise-description">{exercise.description}</span>}
        </>;
        return <li key={exercise.id}>
          {managing ? <button type="button" className="exercise-open" aria-label={exercise.name} aria-describedby={details || undefined} aria-haspopup="dialog" disabled={pending}
            onClick={event => openEditor(exercise, event.currentTarget)}>{info}</button> : <div className="exercise-info">{info}</div>}
          <div className="exercise-row-actions">
            {exercise.video_url || exercise.video_path ? <VideoLink id={exercise.id} /> : <small>Sin video disponible.</small>}
            {selecting && <label>
              <input type="checkbox" checked={selected.some(item => item.id === exercise.id)}
                disabled={pending || !exercise.active || (selected.length >= capacity && !selected.some(item => item.id === exercise.id))}
                onChange={event => setSelected(previous => event.target.checked ? [...previous, exercise] : previous.filter(item => item.id !== exercise.id))} />
              Seleccionar {exercise.name}
            </label>}
          </div>
        </li>;
      })}
    </ul>}
    {next !== null && <button type="button" disabled={pending} onClick={() => void search(searched, next)}>Mostrar más {videosOnly ? "videos" : "ejercicios"}</button>}
    {selecting && <>
      <p>{selected.length} seleccionados. Se agregan en el orden de selección.</p>
      <button type="button" disabled={pending || !selected.length || selected.length > capacity} onClick={() => onSelectMany?.(selected)}>Agregar seleccionados al bloque</button>
    </>}
    {managing && <dialog ref={editorDialog} className="exercise-dialog" aria-labelledby={editorTitleId}
      onCancel={event => { event.preventDefault(); closeEditor(); }}>
      <header className="exercise-dialog-heading">
        <h2 id={editorTitleId}>{editing ? "Editar ejercicio" : "Nuevo ejercicio"}</h2>
        <button type="button" disabled={pending} onClick={closeEditor}>Cerrar</button>
      </header>
      {editor}
    </dialog>}
    {selecting && editor}
  </section>;
}
