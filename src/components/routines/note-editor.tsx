"use client";

import { useEffect, useRef, useState } from "react";
import { PlanBuilder } from "@/components/routines/plan-builder";
import { TextRoutineEditor } from "@/components/routines/text-routine-editor";
import { PlanView } from "@/components/routines/plan-view";
import { planKey, hasExercises, copyPlan } from "@/lib/routines/types";
import type { Note, Publication, Template } from "@/lib/routines/types";
import "./routine-editor.css";

type Status = "clean" | "dirty" | "saving" | "saved" | "error" | "conflict";
const same = (a: Note, b: Note) => a.content === b.content && a.title === b.title
  && (a.format ?? "blocks") === (b.format ?? "blocks")
  && (a.text_content ?? "") === (b.text_content ?? "")
  && JSON.stringify(a.mentions ?? []) === JSON.stringify(b.mentions ?? [])
  && planKey(a.plan) === planKey(b.plan);

export function NoteEditor({ id, initial, template = false, templates = [], publication = null }: {
  id: string; initial: Note; template?: boolean; templates?: Template[]; publication?: Publication | null;
}) {
  const normalizedInitial: Note = { ...initial, format: initial.format ?? "blocks", text_content: initial.text_content ?? "", mentions: initial.mentions ?? [] };
  const [local, setLocal] = useState(normalizedInitial);
  const [saved, setSaved] = useState(normalizedInitial);
  const [status, setStatus] = useState<Status>("clean");
  const [message, setMessage] = useState("");
  const [remote, setRemote] = useState<Note | null>(null);
  const [published, setPublished] = useState(publication);
  const [publishing, setPublishing] = useState(false);
  const [selected, setSelected] = useState("");
  const [availableTemplates, setAvailableTemplates] = useState(templates);
  const [moreTemplates, setMoreTemplates] = useState(templates.length === 200);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const current = useRef(local);
  const busy = useRef(false);
  const publishAttempt = useRef<{ revision: number; operation: string } | null>(null);
  const labels: Record<Status, string> = { clean: "Sin cambios", dirty: "Cambios pendientes de guardar", saving: "Guardando…", saved: "Borrador guardado", error: "Error de guardado", conflict: "Conflicto entre versiones" };
  const unsaved = !same(local, saved);
  const hasUnpublishedChanges = local.content !== (published?.content ?? "")
    || planKey(local.plan) !== planKey(published?.plan)
    || (local.format ?? "blocks") !== (published?.format ?? "blocks")
    || (local.text_content ?? "") !== (published?.text_content ?? "")
    || JSON.stringify(local.mentions ?? []) !== JSON.stringify(published?.mentions ?? []);
  const templatePicker = useRef<HTMLDetailsElement>(null);

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
        kind: template ? "template" : "draft", id, revision: saved.revision, content: snapshot.content, plan: snapshot.plan ?? null, title: snapshot.title, format: snapshot.format ?? "blocks", text_content: snapshot.text_content ?? "", mentions: snapshot.mentions ?? [], operation: crypto.randomUUID(),
      }) });
      const result = await response.json();
      if (!response.ok) { setStatus(result.conflict ? "conflict" : "error"); setMessage(result.message); return; }
      const confirmed: Note = {
        content: result.note.block_content ?? snapshot.content,
        plan: result.note.plan, revision: result.note.revision,
        format: result.note.format ?? snapshot.format ?? "blocks",
        text_content: result.note.text_content ?? snapshot.text_content ?? "",
        mentions: result.note.mentions ?? snapshot.mentions ?? [],
        ...(template ? { title: result.note.title } : {}),
      };
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
    if (busy.current || unsaved || !["saved", "clean"].includes(status) || !saved.revision || ((saved.format ?? "blocks") === "text" ? !(saved.text_content ?? "").trim() : !saved.content.trim() && !hasExercises(saved.plan))) return;
    busy.current = true; setPublishing(true); setMessage("");
    if (publishAttempt.current?.revision !== saved.revision) publishAttempt.current = { revision: saved.revision, operation: crypto.randomUUID() };
    try {
      const response = await fetch("/api/rutinas", { method: "POST", signal: AbortSignal.timeout(15000), headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "publish", id, revision: saved.revision, content: saved.content, plan: saved.plan ?? null, format: saved.format ?? "blocks", text_content: saved.text_content ?? "", mentions: saved.mentions ?? [], operation: publishAttempt.current.operation }) });
      const result = await response.json();
      if (!response.ok) { if (result.conflict) setStatus("conflict"); setMessage(result.message); return; }
      setPublished({ ...result.note, content: result.note.block_content ?? saved.content });
      setMessage("Rutina publicada. El alumno ya puede consultarla.");
    } catch { setMessage("No recibimos confirmación de publicación. Reintentá: no se duplicará la versión."); }
    finally { busy.current = false; setPublishing(false); }
  }

  function applyTemplate() {
    const chosen = availableTemplates.find(item => item.id === selected);
    if (!chosen || publishing || status === "conflict") return;
    if ((local.content || local.plan || (local.text_content ?? "").trim() || (local.mentions?.length ?? 0) > 0) && !window.confirm("¿Reemplazar el contenido del borrador con esta plantilla? La publicación actual se conserva.")) return;
    edit({ ...local, content: chosen.content, plan: chosen.plan ? copyPlan(chosen.plan) : null, format: chosen.format ?? "blocks", text_content: chosen.text_content ?? "", mentions: chosen.mentions ?? [] });
    if (templatePicker.current) {
      templatePicker.current.open = false;
      templatePicker.current.querySelector("summary")?.focus();
    }
  }

  return <section className="routine-editor routine-editor-compact" aria-label={template ? "Editor de plantilla" : "Editor de rutina"}>
    <header className="routine-editor-heading">
      <div>
        <h2>{template ? "Plantilla de rutina" : "Rutina del alumno"}</h2>
        <span role="status">{labels[status]}</span>
      </div>
      {!template && <button className="routine-primary" type="button" disabled={unsaved || !["clean", "saved"].includes(status) || publishing || !saved.revision || ((saved.format ?? "blocks") === "text" ? !(saved.text_content ?? "").trim() : !saved.content.trim() && !hasExercises(saved.plan)) || !hasUnpublishedChanges} onClick={() => void publish()}>{publishing ? "Publicando…" : "Publicar rutina"}</button>}
    </header>
    {!template && <>
      <p className="routine-publication-state" role="status">{published
        ? hasUnpublishedChanges ? "Cambios sin publicar. El alumno sigue viendo la versión anterior." : "Rutina publicada."
        : "Todavía no hay una rutina publicada."}</p>
      <div className="routine-quick-actions">
        <details className="routine-preview">
          <summary>Vista previa del borrador</summary>
          {(local.format ?? "blocks") === "text"
            ? <pre>{local.text_content}</pre>
            : <><PlanView plan={local.plan} />{local.content && <pre>{local.content}</pre>}</>}
          {!local.plan && !local.content && <p>Agregá ejercicios u observaciones para verlos acá.</p>}
        </details>
        {published && <details className="routine-preview">
          <summary>Última rutina publicada</summary>
          <p>Publicada el {new Date(published.published_at).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}</p>
          {(published.format ?? "blocks") === "text"
            ? <pre>{published.text_content}</pre>
            : <><PlanView plan={published.plan} />{published.content && <pre>{published.content}</pre>}</>}
        </details>}
        <details className="routine-template-picker" ref={templatePicker}>
          <summary>Usar plantilla</summary>
          {availableTemplates.length ? <><label htmlFor="routine-template">Plantilla</label><select id="routine-template" value={selected} onChange={event => setSelected(event.target.value)}><option value="">Elegí una plantilla</option>{availableTemplates.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select><button type="button" disabled={!selected || publishing || status === "conflict"} onClick={applyTemplate}>Copiar al borrador</button></> : <p>Todavía no hay plantillas.</p>}{moreTemplates && <button type="button" disabled={loadingTemplates} onClick={async () => {
  setLoadingTemplates(true);
  try {
    const response = await fetch(`/api/rutinas?templates=1&offset=${availableTemplates.length}`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    const result = await response.json();
    if (!response.ok) { setMessage(result.message); return; }
    setAvailableTemplates(previous => [...new Map([...previous, ...result.templates].map((t: Template) => [t.id, t])).values()]); setMoreTemplates(result.more);
  } catch { setMessage("No pudimos cargar más plantillas. Tu borrador se conserva."); } finally { setLoadingTemplates(false); }
}}>Mostrar más plantillas</button>}<a href="/rutinas/plantillas">Gestionar plantillas</a>
        </details>
      </div>
    </>}
    {message && <p role={status === "error" || status === "conflict" ? "alert" : "status"}>{message}</p>}
    {(status === "error" || status === "conflict" || unsaved) && <div className="routine-actions routine-save-actions">
      <button type="button" disabled={!unsaved || status === "saving" || status === "conflict" || publishing} onClick={() => void save()}>{status === "error" ? "Reintentar guardado" : "Guardar ahora"}</button>
      {(status === "error" || status === "conflict") && <button type="button" onClick={() => void compare()}>Comparar versión guardada</button>}
    </div>}
    {remote && <section className="routine-conflict"><h3>Versión guardada en el servidor</h3>{template && <p>{remote.title}</p>}{(remote.format ?? "blocks") === "text"
        ? <pre>{remote.text_content}</pre>
        : <><PlanView plan={remote.plan}/><pre>{remote.content || "Sin observaciones"}</pre></>}<p>Tu borrador sigue arriba. Compará y combiná manualmente antes de elegir.</p><div className="routine-actions"><button type="button" onClick={() => { setSaved(remote); setRemote(null); setStatus(same(local, remote) ? "saved" : "dirty"); setMessage("Se guardará tu borrador sobre la revisión que acabás de comparar."); }}>Guardar mi borrador sobre esta revisión</button><button type="button" onClick={() => { if (!window.confirm("¿Descartar tu borrador local y usar la versión guardada?")) return; current.current = remote; setLocal(remote); setSaved(remote); setRemote(null); setStatus("clean"); setMessage(""); }}>Usar versión del servidor</button></div></section>}
    {template && <label>Título de la plantilla<input maxLength={100} value={local.title ?? ""} disabled={publishing} onChange={event => edit({ ...local, title: event.target.value })} /></label>}
    <div className="routine-format-tabs" role="group" aria-label="Formato de rutina">
      <button type="button" aria-pressed={(local.format ?? "blocks") === "blocks"} disabled={publishing}
        onClick={() => edit({ ...local, format: "blocks" })}>Por bloques</button>
      <button type="button" aria-pressed={local.format === "text"} disabled={publishing}
        onClick={() => edit({ ...local, format: "text" })}>Texto libre</button>
    </div>
    {(local.format ?? "blocks") === "text"
      ? <TextRoutineEditor value={local.text_content ?? ""} mentions={local.mentions ?? []} disabled={publishing}
          onChange={(text_content, mentions) => edit({ ...local, text_content, mentions })} />
      : <><PlanBuilder plan={local.plan ?? null} disabled={publishing} onChange={plan => edit({ ...local, plan })} />
    <details className="routine-notes" open={!local.plan && !!local.content}>
      <summary>{template ? "Observaciones de la plantilla" : "Observaciones de la rutina"}</summary>
      <textarea aria-label={template ? "Observaciones de la plantilla" : "Observaciones de la rutina"} id="routine-text" maxLength={40000} rows={6} value={local.content} disabled={publishing} onChange={event => edit({ ...local, content: event.target.value })} placeholder="Indicaciones generales, descansos o notas complementarias…" aria-describedby="routine-help"/>
      <p id="routine-help">Las observaciones anteriores y sus saltos de línea se conservan.</p>
    </details></>}
    <noscript>El autoguardado requiere JavaScript. No se realizarán cambios desde esta página.</noscript>
  </section>;
}
