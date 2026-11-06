"use client";

import { useEffect, useRef, useState } from "react";
import { PlanBuilder } from "@/components/routines/plan-builder";
import { PlanView } from "@/components/routines/plan-view";
import { planKey, hasExercises } from "@/lib/routines/types";
import type { Note, Publication, Template } from "@/lib/routines/types";

type Status = "clean" | "dirty" | "saving" | "saved" | "error" | "conflict";
const same = (a: Note, b: Note) => a.content === b.content && a.title === b.title && planKey(a.plan) === planKey(b.plan);

export function NoteEditor({ id, initial, template = false, templates = [], publication = null }: {
  id: string; initial: Note; template?: boolean; templates?: Template[]; publication?: Publication | null;
}) {
  const [local, setLocal] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [status, setStatus] = useState<Status>("clean");
  const [message, setMessage] = useState("");
  const [remote, setRemote] = useState<Note | null>(null);
  const [published, setPublished] = useState(publication);
  const [publishing, setPublishing] = useState(false);
  const [selected, setSelected] = useState("");
  const current = useRef(local);
  const busy = useRef(false);
  const publishAttempt = useRef<{ revision: number; operation: string } | null>(null);
  const labels: Record<Status, string> = { clean: "Sin cambios", dirty: "Cambios pendientes de guardar", saving: "Guardando…", saved: "Borrador guardado", error: "Error de guardado", conflict: "Conflicto entre versiones" };
  const unsaved = !same(local, saved);

  function edit(next: Note) {
    current.current = next;
    setLocal(next);
    setStatus(previous => previous === "conflict" ? previous : busy.current ? "saving" : same(next, saved) ? "clean" : "dirty");
    setMessage("");
  }

  async function save() {
    if (busy.current || status === "conflict" || same(current.current, saved)) return;
    if (template && !current.current.title?.trim()) { setStatus("error"); setMessage("Escribí un título para guardar la plantilla."); return; }
    busy.current = true;
    const snapshot = { ...current.current };
    setStatus("saving"); setMessage("");
    try {
      const response = await fetch("/api/rutinas", { method: "POST", signal: AbortSignal.timeout(15000), headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        kind: template ? "template" : "draft", id, revision: saved.revision, content: snapshot.content, plan: snapshot.plan ?? null, title: snapshot.title, operation: crypto.randomUUID(),
      }) });
      const result = await response.json();
      if (!response.ok) { setStatus(result.conflict ? "conflict" : "error"); setMessage(result.message); return; }
      const confirmed: Note = { content: result.note.content, plan: result.note.plan, revision: result.note.revision, ...(template ? { title: result.note.title } : {}) };
      setSaved(confirmed);
      if (template && saved.revision === 0) window.history.replaceState(null, "", `/rutinas/plantillas?id=${id}`);
      setStatus(same(current.current, snapshot) ? "saved" : "dirty");
    } catch { setStatus("error"); setMessage("No recibimos confirmación. Tu borrador se conserva; reintentá o compará la versión guardada."); }
    finally { busy.current = false; }
  }

  // One request at a time. Responses update only the confirmed base, never the
  // local text; edits made in flight are saved subsequently against that base.
  useEffect(() => {
    if (status !== "dirty" || !unsaved) return;
    const timer = setTimeout(() => { void save(); }, 650);
    return () => clearTimeout(timer);
  });
  useEffect(() => {
    if (!unsaved && !publishing && status !== "saving" && status !== "conflict") return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    const navigate = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest("a") : null;
      if (!anchor || anchor.target === "_blank" || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const target = new URL(anchor.href);
      if (target.pathname === window.location.pathname && target.search === window.location.search) return;
      if (!window.confirm("Hay cambios sin confirmar. ¿Salir de esta página y descartar lo que todavía no se guardó?")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("click", navigate, true); };
  }, [unsaved, publishing, status]);

  async function compare() {
    if (busy.current) return;
    busy.current = true;
    try {
      const response = await fetch(`/api/rutinas?id=${id}&kind=${template ? "template" : "draft"}`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
      const result = await response.json();
      if (!response.ok) { setMessage(result.message); return; }
      setRemote(result.note);
    } catch { setMessage("No pudimos consultar la revisión. Tu borrador se conserva."); }
    finally { busy.current = false; }
  }

  async function publish() {
    if (busy.current || unsaved || !["saved", "clean"].includes(status) || !saved.revision || (!saved.content.trim() && !hasExercises(saved.plan))) return;
    busy.current = true; setPublishing(true); setMessage("");
    if (publishAttempt.current?.revision !== saved.revision) publishAttempt.current = { revision: saved.revision, operation: crypto.randomUUID() };
    try {
      const response = await fetch("/api/rutinas", { method: "POST", signal: AbortSignal.timeout(15000), headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "publish", id, revision: saved.revision, content: saved.content, plan: saved.plan ?? null, operation: publishAttempt.current.operation }) });
      const result = await response.json();
      if (!response.ok) { if (result.conflict) setStatus("conflict"); setMessage(result.message); return; }
      setPublished(result.note);
      setMessage("Rutina publicada. El alumno ya puede consultarla.");
    } catch { setMessage("No recibimos confirmación de publicación. Reintentá: no se duplicará la versión."); }
    finally { busy.current = false; setPublishing(false); }
  }

  function applyTemplate() {
    const chosen = templates.find(item => item.id === selected);
    if (!chosen || publishing || status === "conflict") return;
    if ((local.content || local.plan?.blocks.length) && !window.confirm("¿Reemplazar el texto del borrador con esta plantilla? La publicación actual se conserva.")) return;
    edit({ ...local, content: chosen.content, plan: chosen.plan ? { version: 1, blocks: chosen.plan.blocks.map(b => ({ ...b, id: crypto.randomUUID(), exercises: b.exercises.map(e => ({ ...e, id: crypto.randomUUID() })) })) } : null });
  }

  return <section className="routine-editor" aria-label={template ? "Editor de plantilla" : "Editor de rutina"}>
    <div className="routine-editor-heading"><div><p className="dash-kicker">{template ? "PLANTILLA DE RUTINA" : "BORRADOR PRIVADO"}</p><h2>{template ? "Editá tu plantilla" : "Armá la rutina por bloques"}</h2></div><span role="status" aria-live="polite">{labels[status]}</span></div>
    <p>{template ? "Se guarda automáticamente. Las copias ya aplicadas no se modifican." : "Organizá bloques y elegí ejercicios. Solo los administradores ven este borrador."}</p>
    {template && <label>Título de la plantilla<input maxLength={100} value={local.title ?? ""} disabled={publishing} onChange={event => edit({ ...local, title: event.target.value })}/></label>}
    <PlanBuilder plan={local.plan ?? null} disabled={publishing} onChange={plan => edit({ ...local, plan })}/>
    <label htmlFor="routine-text">{template ? "Observaciones de la plantilla" : "Observaciones de la rutina"}</label><textarea id="routine-text" maxLength={40000} rows={6} value={local.content} disabled={publishing} onChange={event => edit({ ...local, content: event.target.value })} placeholder="Indicaciones generales, descansos o notas complementarias…" aria-describedby="routine-help"/>
    <p id="routine-help">Observaciones complementarias y notas anteriores · Hasta 40.000 caracteres · Se conservan los saltos de línea.</p>
    {message && <p role={status === "error" || status === "conflict" ? "alert" : "status"}>{message}</p>}
    <div className="routine-actions">
      <button type="button" disabled={!unsaved || status === "saving" || status === "conflict" || publishing} onClick={() => void save()}>{status === "error" ? "Reintentar guardado" : "Guardar ahora"}</button>
      {(status === "error" || status === "conflict") && <button type="button" onClick={() => void compare()}>Comparar versión guardada</button>}
      {!template && <button className="routine-primary" type="button" disabled={unsaved || !["clean", "saved"].includes(status) || publishing || !saved.revision || (!saved.content.trim() && !hasExercises(saved.plan)) || (saved.content === published?.content && planKey(saved.plan) === planKey(published?.plan))} onClick={() => void publish()}>{publishing ? "Publicando…" : "Publicar rutina"}</button>}
    </div>
    {remote && <section className="routine-conflict"><h3>Versión guardada en el servidor</h3>{template && <p>{remote.title}</p>}<PlanView plan={remote.plan}/><pre>{remote.content || "Sin observaciones"}</pre><p>Tu borrador sigue arriba. Compará y combiná manualmente antes de elegir.</p><div className="routine-actions"><button type="button" onClick={() => { setSaved(remote); setRemote(null); setStatus(same(local, remote) ? "saved" : "dirty"); setMessage("Se guardará tu borrador sobre la revisión que acabás de comparar."); }}>Guardar mi borrador sobre esta revisión</button><button type="button" onClick={() => { if (!window.confirm("¿Descartar tu borrador local y usar la versión guardada?")) return; current.current = remote; setLocal(remote); setSaved(remote); setRemote(null); setStatus("clean"); setMessage(""); }}>Usar versión del servidor</button></div></section>}
    {!template && <>
      <p className="routine-publication-state" role="status">{published ? (local.content !== published.content || planKey(local.plan) !== planKey(published.plan)) ? "Hay cambios todavía sin publicar. El alumno sigue viendo la publicación anterior." : "El borrador coincide con la rutina publicada." : "Todavía no publicaste una rutina para este alumno."}</p>
      <details className="routine-preview"><summary>Última rutina publicada</summary>{published ? <><p>Publicada el {new Date(published.published_at).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}</p><PlanView plan={published.plan}/><pre>{published.content}</pre></> : <p>Sin publicación. El alumno verá un estado vacío.</p>}</details>
      <section className="routine-template-picker"><h3>Empezar desde una plantilla</h3>{templates.length ? <><label htmlFor="routine-template">Plantilla</label><select id="routine-template" value={selected} onChange={event => setSelected(event.target.value)}><option value="">Elegí una plantilla</option>{templates.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select><button type="button" disabled={!selected || publishing || status === "conflict"} onClick={applyTemplate}>Copiar al borrador</button></> : <p>Todavía no hay plantillas.</p>}<a href="/rutinas/plantillas">Gestionar plantillas</a></section>
    </>}
    <noscript>El autoguardado requiere JavaScript. No se realizarán cambios desde esta página.</noscript>
  </section>;
}
